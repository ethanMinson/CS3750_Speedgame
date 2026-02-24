//Basic backend server setup with connection to routes
require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors'); //cors to allow cross origin
const dbo = require('./db/connection');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const port = 5000;

const session = require("express-session");
const MongoStore = require("connect-mongo");

//setup of cards needs to be done in backend for multiplayer games, so that both players have the same deck
//if deck is shuffled in frontend, each player will have a different deck, and hand so the game won't work properly
//I(Ethan) am implementing the card deck here and then it will be sent to the clients when the game starts
const cards = ['2♠', '3♠', '4♠', '5♠', '6♠', '7♠', '8♠', '9♠', '10♠',  'J♠', 'Q♠', 'K♠', 'A♠',
               '2♥', '3♥', '4♥', '5♥', '6♥', '7♥', '8♥', '9♥', '10♥', 'J♥', 'Q♥', 'K♥', 'A♥',
               '2♦', '3♦', '4♦', '5♦', '6♦', '7♦', '8♦', '9♦', '10♦', 'J♦', 'Q♦', 'K♦', 'A♦',
               '2♣', '3♣', '4♣', '5♣', '6♣', '7♣', '8♣', '9♣', '10♣', 'J♣', 'Q♣', 'K♣', 'A♣'];

//activate cors and express.json
app.use(cors({ //specify cors which is optional
        origin: ["http://localhost:3000", "http://YOUR_IP:3000"] ,
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        credentials: true,
        optionsSuccessStatus: 204,
        allowedHeaders: ["Content-Type", "Authorization"]
    }
));
app.use(session({
        secret: 'keyboard cat',
        saveUninitialized: false,
        resave: false,
        store: MongoStore.create({
            mongoUrl: process.env.ATLAS_URI
        })
    }
));

app.use(express.json());
app.use(require("./routes/Speed")); //import the bank routes

app.get('/', (req, res) => {
    res.send('Hello World!');
});

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://YOUR_IP:3000"] ,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Game rooms storage
const rooms = new Map();
const waitingPlayers = [];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Player joins with their name
    socket.on('joinGame', (playerName) => {
        socket.playerName = playerName;
        console.log(`${playerName} (${socket.id}) wants to join`);

        // Check if there's a waiting player
        if (waitingPlayers.length > 0) {
            const opponent = waitingPlayers.shift();
            const roomId = `room-${socket.id}`;

            // Create room with both players
            const room = {
                id: roomId,
                players: [
                    { id: opponent.id, name: opponent.playerName, ready: false },
                    { id: socket.id, name: playerName, ready: false }
                ],
                winner: null,
                playAgainVotes: {},
                gameInitialized: false,
                noCardsVotes: {}
            };

            rooms.set(roomId, room);

            // Join both players to the room
            opponent.join(roomId);
            socket.join(roomId);

            opponent.roomId = roomId;
            socket.roomId = roomId;

            // Notify both players that game is ready
            io.to(roomId).emit('gameReady', {
                roomId: roomId,
                players: room.players
            });

            console.log(`Room ${roomId} created with ${opponent.playerName} and ${playerName}`);
        } else {
            // Add player to waiting list
            waitingPlayers.push(socket);
            socket.emit('waiting', 'Waiting for opponent...');
            console.log(`${playerName} is waiting for an opponent`);
        }
    });

    // Start the game countdown
    socket.on('startGame', () => {
        const roomId = socket.roomId;
        if (roomId) {
            io.to(roomId).emit('gameStarting', 'Game starting...');
            console.log(`Game starting in room ${roomId}`);
        }
    });

    socket.on('gameStarted', () => {
        const roomId = socket.roomId;
        if (!roomId) return;
        
        const room = rooms.get(roomId);
        if (!room) return;
        
        // Only initialize the game once per room
        if (room.gameInitialized) {
            console.log(`Game already initialized for room ${roomId}, ignoring duplicate request`);
            return;
        }
        
        room.gameInitialized = true;
        
        let playerHand = [];
        let opponentHand = [];
        let middleCards = [];
        let playerdeck = [];
        let opponentdeck = [];
        let stalemateCardsR = [];
        let stalemateCardsL = [];
        
        // Shuffle the deck
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1)); //pick a random index from 0 to i
            [cards[i], cards[j]] = [cards[j], cards[i]]; //swap elements cards[i] and cards[j]
        }
        
        // Dealing cards to players
        for(let i=0; i<30; i++){
            if(i%2==0){
                playerdeck.push(cards[i]);
            } else {
                opponentdeck.push(cards[i]);
            }
        }
        for(let i=30; i<40; i++){
            if(i%2==0){
                playerHand.push(cards[i]);
            } else{
                opponentHand.push(cards[i]);
            }
        }
        for(let i=40; i<50; i++){
            if(i%2==0){
                stalemateCardsL.push(cards[i]);
            } else{
                stalemateCardsR.push(cards[i]);
            }
        }
        middleCards.push(cards[50]);
        middleCards.push(cards[51]);

        // Store game state in room for tracking
        room.gameState = {
            middleCards: middleCards,
            middleCardsL: [middleCards[0]],
            middleCardsR: [middleCards[1]],
            stalemateCardsL: stalemateCardsL,
            stalemateCardsR: stalemateCardsR
        };

        // Get both players in the room
        const player1 = room.players[0];
        const player2 = room.players[1];

        // Sends the initial game state to player 1
        io.to(player1.id).emit('startState', {
            playerId: player1.id,
            playerHand: playerHand,
            opponentHand: opponentHand,
            middleCards: middleCards,
            playerdeck: playerdeck,
            opponentdeck: opponentdeck,
            stalemateCardsL: stalemateCardsL,
            stalemateCardsR: stalemateCardsR
        });

        // Sends the initial game state to player 2
        io.to(player2.id).emit('startState', {
            playerId: player2.id,
            playerHand: opponentHand,
            opponentHand: playerHand,
            middleCards: middleCards,
            playerdeck: opponentdeck,
            opponentdeck: playerdeck,
            stalemateCardsL: stalemateCardsL,
            stalemateCardsR: stalemateCardsR
        });
        
        console.log(`Initial deck sent to room ${roomId}`);
        console.log(`Player 1 stalemate: L=${stalemateCardsL}, R=${stalemateCardsR}`);
        console.log(`Player 2 stalemate: L=${stalemateCardsL}, R=${stalemateCardsR}`);
    });

    // Handle no cards signal
    socket.on('noCards', () => {
        const roomId = socket.roomId;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.noCardsVotes[socket.id] = true;
            
            // Notify opponent
            socket.to(roomId).emit('opponentNoCards', {
                message: 'Opponent has no available cards to play'
            });
            
            const allVoted = room.players.every(p => room.noCardsVotes[p.id]);
            if (allVoted) {
                const state = room.gameState;
                
                // Check if ANY stalemate pile is empty - trigger reshuffle first
                if (state.stalemateCardsR.length === 0 || state.stalemateCardsL.length === 0) {
                    
                    // Get middle cards except the top one from each pile
                    const leftCards = state.middleCardsL.slice(0, -1);
                    const rightCards = state.middleCardsR.slice(0, -1);
                    
                    // Shuffle the left stalemate cards
                    for (let i = leftCards.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [leftCards[i], leftCards[j]] = [leftCards[j], leftCards[i]];
                    }
                    
                    // Shuffle the right stalemate cards
                    for (let i = rightCards.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [rightCards[i], rightCards[j]] = [rightCards[j], rightCards[i]];
                    }
                    
                    // Append shuffled cards to the front of existing stalemate piles
                    state.stalemateCardsL = [...leftCards, ...state.stalemateCardsL];
                    state.stalemateCardsR = [...rightCards, ...state.stalemateCardsR];
                    
                    // Keep only the top card in each middle pile
                    state.middleCardsL = state.middleCardsL.length > 0 ? [state.middleCardsL[state.middleCardsL.length - 1]] : [];
                    state.middleCardsR = state.middleCardsR.length > 0 ? [state.middleCardsR[state.middleCardsR.length - 1]] : [];
                    console.log('Reshuffling stalemate piles due to empty pile');
                }
                
                // Flip cards from stalemate to middle
                if (state.stalemateCardsR.length > 0) {
                    const topCard = state.stalemateCardsR.pop();
                    state.middleCardsR.push(topCard);
                }
                if (state.stalemateCardsL.length > 0) {
                    const topCard = state.stalemateCardsL.pop();
                    state.middleCardsL.push(topCard);
                }
                
                // Send updated state to both players
                const currentMiddleCards = [
                    state.middleCardsL[state.middleCardsL.length - 1],
                    state.middleCardsR[state.middleCardsR.length - 1]
                ];
                
                io.to(roomId).emit('stalemateFlipped', {
                    middleCards: currentMiddleCards,
                    stalemateCardsL: state.stalemateCardsL,
                    stalemateCardsR: state.stalemateCardsR
                });
                
                console.log('Stalemate flipped - Middle cards:', currentMiddleCards);                
                // Reset votes
                room.noCardsVotes = {};
            }
        }
    });

    // Add new socket event for card plays
    socket.on('playCard', (data) => {
        const roomId = socket.roomId;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            const state = room.gameState;
            
            // Track which pile was played to based on DOM ID
            if (data.targetPile === "middle1") {
                state.middleCardsL.push(data.card);
            } else if (data.targetPile === "middle2") {
                state.middleCardsR.push(data.card);
            }
            
            // Broadcast move to ONLY the other player (not the sender)
            socket.to(roomId).emit('cardPlayed', {
                playerId: socket.id,
                playerName: data.playerName,
                card: data.card,
                targetCard: data.targetCard,
                targetPile: data.targetPile,
                handCount: data.handCount,    // Pass through the player's hand count
                deckCount: data.deckCount     // Pass through the player's deck count
            });
            
            console.log('Stalemate cards L: ', state.stalemateCardsL);
            console.log('Stalemate cards R: ', state.stalemateCardsR);
            console.log('Middle cards L: ', state.middleCardsL);
            console.log('Middle cards R: ', state.middleCardsR);
        }
    });

    // Player declares they won
    socket.on('playerWon', () => {
        const roomId = socket.roomId;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.winner = socket.id;

            // Send winner info to both players
            room.players.forEach(player => {
                const isWinner = player.id === socket.id;
                io.to(player.id).emit('gameOver', {
                    winner: socket.playerName,
                    loser: room.players.find(p => p.id !== socket.id).name,
                    isWinner: isWinner
                });
            });
        }
    });

    // Player votes on play again
    socket.on('playAgainVote', (vote) => {
        const roomId = socket.roomId;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.playAgainVotes[socket.id] = vote;

            // If anyone votes no, end game immediately (doesn't really work but whatever i'm too lazy to fix)
            if (vote === 'no') {
                io.to(roomId).emit('endGame');
                
                // Disconnect all players in the room
                room.players.forEach(player => {
                    const playerSocket = io.sockets.sockets.get(player.id);
                    if (playerSocket) {
                        playerSocket.leave(roomId);
                        playerSocket.roomId = null;
                        // Disconnect the socket
                        playerSocket.disconnect(true);
                    }
                });
                rooms.delete(roomId);
                return;
            }

            // Notify the room about the vote
            socket.to(roomId).emit('opponentVoted', {
                vote: vote,
                playerName: socket.playerName
            });

            // Check if both players have voted yes
            const votes = Object.values(room.playAgainVotes);
            if (votes.length === 2 && votes.every(v => v === 'yes')) {
                // Both said yes - restart game
                room.playAgainVotes = {};
                room.gameInitialized = false;//game wasn't reinitializing when playing again, testing fix
                io.to(roomId).emit('restartGame');
                console.log(`Room ${roomId} restarting game`);
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Remove from waiting list if present
        const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id);
        if (waitingIndex > -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }

        // Handle room cleanup
        const roomId = socket.roomId;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            
            // Notify opponent that player disconnected
            socket.to(roomId).emit('opponentDisconnected', {
                message: `${socket.playerName} disconnected`
            });

            // Clean up room
            rooms.delete(roomId);
        }
    });
});

server.listen(port, '0.0.0.0', () => { //listens for requests on port 5000 from all network interfaces
    console.log(`Server is running on port ${port}`);
    console.log(`Access locally at: http://localhost:${port}`);
    console.log(`Access from network at: http://YOUR_IP:${port}`);
    dbo.connectToServer(function(err) {
        if (err) {
            console.err(err);
        }
    });
    console.log(`Socket.IO server is running and accepting connections`);
})