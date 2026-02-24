import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function EnterName() {
    //Variables
    const [status, setStatus] = useState(""); //status of session
    const [form, setForm] = useState({ //hold record data
        name: "",
    });
    const [waiting, setWaiting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Socket connection error handling
        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setStatus('Failed to connect to server. Check your connection.');
            setWaiting(false);
        });

        socket.on('connect', () => {
            console.log('Socket connected successfully');
        });

        // Listen for game ready event
        socket.on('waiting', (message) => {
            setWaiting(true);
            setStatus(message);
        });

        socket.on('gameReady', (data) => {
            setStatus('Opponent found! Starting game...');
            localStorage.setItem('roomId', data.roomId);
            localStorage.setItem('players', JSON.stringify(data.players));
            localStorage.setItem('playerName', form.name);
            
            // Navigate to game after countdown
            let countdown = 3;
            const countdownInterval = setInterval(() => {
                setStatus(`Game starting in ${countdown}...`);
                countdown--;
                
                if (countdown < 0) {
                    clearInterval(countdownInterval);
                    socket.emit('startGame');
                    navigate('/game');
                }
            }, 1000);
        });

        socket.on('opponentDisconnected', (data) => {
            setStatus(data.message + ' - Please enter your name again to find a new opponent.');
            setWaiting(false);
            socket.disconnect();
        });

        // Cleanup listeners on unmount
        return () => {
            socket.off('connect_error');
            socket.off('connect');
            socket.off('waiting');
            socket.off('gameReady');
            socket.off('opponentDisconnected');
        };
    }, [navigate, form.name]);

    //update the form based on user input
    function updateForm(jsonObj) {
        return setForm((prevJsonObj) => { //take the previous state of the form
            return { ...prevJsonObj, ...jsonObj }; //return a new object that contains the previous state and the new state
        })
    }

    //Connect to socket and join game
    async function saveName(e) {
        try {
            e.preventDefault();
            //check if the name is empty
            if (form.name === "") {
                setStatus("Input cannot be empty");
                return;
            }

            setStatus("Connecting to game server...");
            
            // Connect to socket and join game
            if (!socket.connected) {
                socket.connect();
            }

            fetch("http://localhost:5000/saveName", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name: form.name })
            });

            socket.emit('joinGame', form.name);
            
        } catch (err) {
            setStatus("Error connecting to server");
            console.error(err);
        }
    }

    return (
        <div className="enter-container">
            <form className="enter-form" onSubmit={saveName}>
                <label>Enter Name</label>
                <input
                    type="text"
                    id="name"
                    value={form.name}
                    onChange={(e) => updateForm({ name: e.target.value })}
                    disabled={waiting}
                />
                <button type="submit" className="btn" disabled={waiting}>
                    {waiting ? 'Waiting...' : 'Join Game'}
                </button>
                <p className="enter-status">{status}</p>
            </form>
        </div>
    );
}