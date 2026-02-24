import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function Winner() {
    //variables
    const [winnerName, setWinnerName] = useState("");
    const [loserName, setLoserName] = useState("");
    const [isWinner, setIsWinner] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Listen for game over event from socket
        socket.on('gameOver', (data) => {
            setWinnerName(data.winner);
            setLoserName(data.loser);
            setIsWinner(data.isWinner);
        });

        // Check if we have game result in localStorage
        const gameResult = localStorage.getItem('gameResult');
        const playerName = localStorage.getItem('playerName');
        const players = JSON.parse(localStorage.getItem('players') || '[]');
        const opponent = players.find(p => p.name !== playerName);

        if (gameResult === 'won') {
            setWinnerName(playerName);
            setLoserName(opponent ? opponent.name : 'Opponent');
            setIsWinner(true);
        } else if (gameResult === 'lost') {
            setWinnerName(opponent ? opponent.name : 'Opponent');
            setLoserName(playerName);
            setIsWinner(false);
        }

        // Navigate to scores after 3 seconds
        const timer = setTimeout(() => {
            navigate('/scores');
        }, 3000);

        return () => {
            clearTimeout(timer);
            socket.off('gameOver');
        };
    }, [navigate]);

    return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
            {isWinner ? (
                <>
                    <h1 style={{ color: '#4CAF50', fontSize: '48px' }}>YOU WON!</h1>
                    <h2 style={{ fontSize: '36px' }}>Winner: {winnerName}</h2>
                    <h3 style={{ fontSize: '24px', color: '#999' }}>Loser: {loserName}</h3>
                </>
            ) : (
                <>
                    <h1 style={{ color: '#f44336', fontSize: '48px' }}>YOU LOST</h1>
                    <h2 style={{ fontSize: '36px' }}>Winner: {winnerName}</h2>
                    <h3 style={{ fontSize: '24px', color: '#999' }}>Loser: {loserName}</h3>
                </>
            )}
            <p style={{ marginTop: '30px', fontSize: '18px' }}>Redirecting to scores...</p>
        </div>
    );
}