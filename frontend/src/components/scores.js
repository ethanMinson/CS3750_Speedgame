import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function Scores() {
    //variables
    const [scores, setScores] = useState([]); //array to hold scores
    const [waitingForOpponent, setWaitingForOpponent] = useState(false);
    const [opponentVote, setOpponentVote] = useState(null);
    const [myVote, setMyVote] = useState(null);
    const [countdown, setCountdown] = useState(3);
    const [showCountdown, setShowCountdown] = useState(false);
    const navigate = useNavigate();

    // Fetch all scores from database
    useEffect(() => {
        // Listen for opponent's vote
        socket.on('opponentVoted', (data) => {
            setOpponentVote(data.vote);
            if (data.vote === 'yes') {
                setWaitingForOpponent(false);
            }
        });

        // Listen for game restart
        socket.on('restartGame', () => {
            setWaitingForOpponent(false);
            setShowCountdown(true);
            
            // Show countdown before restarting
            let count = 3;
            setCountdown(count);
            
            const countdownInterval = setInterval(() => {
                count--;
                setCountdown(count);
                
                if (count <= 0) {
                    clearInterval(countdownInterval);
                    navigate('/game');
                }
            }, 1000);
        });

        // Listen for game end
        socket.on('endGame', () => {
            setWaitingForOpponent(false);
            alert('Game ended. Returning to home screen.');
            localStorage.clear();
            socket.disconnect();
            setTimeout(() => {
                navigate('/enterName');
            }, 2000);
        });

        socket.on('opponentDisconnected', () => {
            alert('Opponent disconnected');
            localStorage.clear();
            navigate('/enterName');
        });

        // Fetch scores from database (optional)
        async function fetchData() {
            try {
                console.log("Fetching scores for:", localStorage.getItem('playerName'));
                const response = await fetch("http://localhost:5000/getScores", {
                    method: 'GET',
                    headers: {'Content-Type': 'application/json'},
                    credentials: "include",
                });
                if (!response.ok) {
                    console.error('Failed to fetch scores', response.status);
                    return;
                }

                const data = await response.json();
                
                if (!Array.isArray(data)) {
                    console.error('Unexpected scores response', data);
                    return;
                }

                const mapped = data.map(item => ({
                    name: item.name || "N/A",
                    winOrLose: item.winOrLose || "N/A",
                    cardsLeft: item.cardsLeft || "0"
                }));
                setScores(mapped);
            } catch (err) {
                console.error("Error fetching scores:", err);
            }
        }
        fetchData();

        return () => {
            socket.off('opponentVoted');
            socket.off('restartGame');
            socket.off('endGame');
            socket.off('opponentDisconnected');
        };
    }, [navigate]);

    function goHome() {
        setMyVote('no');
        socket.emit('playAgainVote', 'no');
    }

    function playAgain() {
        setMyVote('yes');
        setWaitingForOpponent(true);
        socket.emit('playAgainVote', 'yes');
    }

    return (
        <div className="scores-container">
            {showCountdown && countdown > 0 ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                    <h1 style={{ fontSize: '36px', marginBottom: '20px' }}>Game Starting...</h1>
                    <div style={{ fontSize: '72px', fontWeight: 'bold', color: '#4CAF50', margin: '30px' }}>
                        {countdown}
                    </div>
                </div>
            ) : (
                <>
                    <div>
                        <h2>Game Results</h2>
                        <p style={{ fontSize: '18px', margin: '20px' }}>
                            {localStorage.getItem('playerName') || 'Player'}
                        </p>

                        {scores.length > 0 && (
                            <table className="table" style={{ margin: '20px auto', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Win/Lose</th>
                                        <th style={{ border: '1px solid #ddd', padding: '8px' }}>Cards Left</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scores.map((s, i) => (
                                        <tr key={i}>
                                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{s.winOrLose}</td>
                                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{s.cardsLeft}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div style={{ marginTop: '30px' }}> 
                        <h2>Play Again?</h2>
                        
                        {myVote === null ? (
                            <div>
                                <button 
                                    onClick={playAgain}
                                    style={{
                                        margin: '10px',
                                        padding: '15px 30px',
                                        fontSize: '18px',
                                        backgroundColor: '#4CAF50',
                                        color: 'white',
                                        border: 'none',
                                        cursor: 'pointer',
                                        borderRadius: '5px'
                                    }}
                                >
                                    Yes
                                </button>
                                <button 
                                    onClick={goHome}
                                    style={{
                                        margin: '10px',
                                        padding: '15px 30px',
                                        fontSize: '18px',
                                        backgroundColor: '#f44336',
                                        color: 'white',
                                        border: 'none',
                                        cursor: 'pointer',
                                        borderRadius: '5px'
                                    }}
                                >
                                    No
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p style={{ fontSize: '16px', color: '#666' }}>
                                    You voted: <strong>{myVote.toUpperCase()}</strong>
                                </p>
                                {waitingForOpponent && (
                                    <p style={{ fontSize: '16px', color: '#4CAF50', marginTop: '10px' }}>
                                        Waiting for opponent's input...
                                    </p>
                                )}
                                {opponentVote && (
                                    <p style={{ fontSize: '16px', color: '#666', marginTop: '10px' }}>
                                        Opponent voted: <strong>{opponentVote.toUpperCase()}</strong>
                                    </p>
                                )}
                                {myVote === 'yes' && opponentVote === 'yes' && !showCountdown && (
                                    <p style={{ fontSize: '18px', color: '#4CAF50', fontWeight: 'bold', marginTop: '10px' }}>
                                        Starting new game...
                                    </p>
                                )}
                                {(myVote === 'no' || opponentVote === 'no') && opponentVote !== null && (
                                    <p style={{ fontSize: '18px', color: '#f44336', fontWeight: 'bold', marginTop: '10px' }}>
                                        Game ended. Returning to home...
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}