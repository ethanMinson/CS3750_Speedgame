import { io } from 'socket.io-client';

// Connect to backend server
const socket = io('http://localhost:5000', { //change localhost to your IP if testing on different computers
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 10000,
    transports: ['websocket', 'polling']
});

export default socket;
