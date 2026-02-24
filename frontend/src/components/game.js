import './speed.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

export default function Game() {
    //variables
    const [currCards, setCurrCards] = useState(['A♠', 'K♥', 'Q♦', 'J♣', '10♦']); //player's hand
    const [currDeck, setCurrDeck] = useState([]); //player's deck to be drawn from
    const [opponentCards, setOpponentCards] = useState(['J♣', '10♦', '9♠', '9♥', '10♥']); //opponent's hand
    const [opponentsDeck, setOpponentsDeck] = useState([]); //opponent's deck to be drawn from
    const [selectedCard, setSelectedCard] = useState(null); //for mobile: selected card
    const [middleCardR, setMiddleCardR] = useState([]); //cards in the middle of the table
    const [middleCardL, setMiddleCardL] = useState([]); //cards in the middle of the table
    const [draggedCard, setDraggedCard] = useState(null); //track which card is being dragged
    const [staleMate, setStaleMate] = useState(false); //track number of stale mate turns
    const [staleMatePile, setStaleMatePile] = useState([]); //cards accumulated during stalemate
    const [opponentStaleMate, setOpponentStaleMate] = useState([]); //track opponent stalemate turns
    const [status, setStatus] = useState("Game started!"); //status of the game
    const [opponentName, setOpponentName] = useState('Opponent');
    const navigate = useNavigate();
    const cards = ['2♠', '3♠', '4♠', '5♠', '6♠', '7♠', '8♠', '9♠', '10♠',  'J♠', 'Q♠', 'K♠', 'A♠',
               '2♥', '3♥', '4♥', '5♥', '6♥', '7♥', '8♥', '9♥', '10♥', 'J♥', 'Q♥', 'K♥', 'A♥',
               '2♦', '3♦', '4♦', '5♦', '6♦', '7♦', '8♦', '9♦', '10♦', 'J♦', 'Q♦', 'K♦', 'A♦',
               '2♣', '3♣', '4♣', '5♣', '6♣', '7♣', '8♣', '9♣', '10♣', 'J♣', 'Q♣', 'K♣', 'A♣'];

    useEffect(() => {
        // Get opponent info from localStorage
        const players = JSON.parse(localStorage.getItem('players') || '[]');
        const myName = localStorage.getItem('playerName');
        const opponent = players.find(p => p.name !== myName);
        if (opponent) {
            setOpponentName(opponent.name);
        }

        socket.on('startState', (data) => {
            const opponent = players.find(p => p.name !== myName);
            console.log(`opponent data: ${JSON.stringify(opponent)}`);
            
            // Removed check for game start cards, moved to backend
            setCurrCards(data.playerHand);
            setOpponentCards(data.opponentHand);
            setMiddleCardR(Array.isArray(data.middleCards[0]) ? data.middleCards[0] : [data.middleCards[0]]);
            setMiddleCardL(Array.isArray(data.middleCards[1]) ? data.middleCards[1] : [data.middleCards[1]]);
            setCurrDeck(data.playerdeck);
            setOpponentsDeck(data.opponentdeck);
            setStaleMatePile(data.stalemateCardsR);
            setOpponentStaleMate(data.stalemateCardsL);
            
            console.log('Game Started - Stalemate Cards:');
            console.log('Your stalemate pile (Right):', data.stalemateCardsR);
            console.log('Opponent stalemate pile (Left):', data.stalemateCardsL);
        })

        // Listen for game over event - loser navigates to winner screen
        socket.on('gameOver', (data) => {
            if (!data.isWinner) {
                // This player lost, navigate to winner screen
                localStorage.setItem('gameResult', 'lost');
                //save results to database
                fetch ("http://localhost:5000/saveScore", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: localStorage.getItem('playerName'),
                        winOrLose: 'lose',
                        cardsLeft: currCards.length+currDeck.length,
                    })
                });
                navigate('/winner');
            }
            else {
                localStorage.setItem('gameResult', 'won');
                //save results to database
                fetch ("http://localhost:5000/saveScore", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: localStorage.getItem('playerName'),
                        winOrLose: 'win',
                        cardsLeft: 0,
                    })
                });
            }
        });

        socket.on('opponentDisconnected', (data) => {
            alert(data.message);
            navigate('/enterName');
        });

        socket.on('cardPlayed', (data) => {
            // Update game state with opponent's move
            console.log("cardPlayed received from:", data.playerName);
            console.log(`Opponent hand count: ${data.handCount}, deck count: ${data.deckCount}`);
            
            // Update opponent counts directly from the server data
            setOpponentCards(new Array(data.handCount).fill(null)); // Create placeholder array with correct length
            setOpponentsDeck(new Array(data.deckCount).fill(null)); // Create placeholder array with correct length
            
            // Update middle pile
            if(data.targetPile === "middle1"){
                setMiddleCardL(prevCards => [...prevCards, data.card]);
            } else {
                setMiddleCardR(prevCards => [...prevCards, data.card]);
            }
        });

        socket.on('opponentNoCards', (data) => {
            setStatus(data.message);
        });

        socket.on('stalemateFlipped', (data) => {
            // Update state with backend's authoritative state
            setMiddleCardL([data.middleCards[0]]);
            setMiddleCardR([data.middleCards[1]]);
            setOpponentStaleMate(data.stalemateCardsL);
            setStaleMatePile(data.stalemateCardsR);
            
            console.log('Stalemate flipped!');
            console.log('New middle left:', data.middleCards[0]);
            console.log('New middle right:', data.middleCards[1]);
            
            setStatus('New cards flipped!');
        });
        

        return () => {
            socket.off('gameOver');
            socket.off('opponentDisconnected');
            socket.off('cardPlayed');
            socket.off('opponentNoCards');
            socket.off('flipStalemate');
            socket.off('reshuffleStalemate');
        };
    }, [navigate, currCards, currDeck]);

    //randomize the deck of cards
    function shuffleDeck(cards) {
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1)); //pick a random index from 0 to i
            [cards[i], cards[j]] = [cards[j], cards[i]]; //swap elements cards[i] and cards[j]
        }
    }

    //track card being dragged and indicat a move is happening
    function handleDragStart(e, card) {
        setDraggedCard(card); //keep track of the dragged card
        e.dataTransfer.effectAllowed = 'move'; //tell the browser that you're moving the card
        e.dataTransfer.setData('text/plain', card); //set the data being dragged
    }

    //tells browser where is the drop is allowed
    function handleDragOver(e) {
        e.preventDefault(); //alow drops by preventing a refresh
        e.dataTransfer.dropEffect = 'move'; //indicate the card can be dropped here
    }

    //executes when a card is dropped into the middle pile
    //this is where to add game logic
    function handleDrop(e) {
        e.preventDefault();
        const card = e.dataTransfer.getData('text/plain'); //get the card being dropped
        const targetPile = e.target.id; //get the target pile id
        const targetCard = e.target.innerText; //get the target card value
        setStatus(`Attempting to play ${card} on ${targetCard}`);
        if (isValidMove(card, targetCard)) {
            //remove the card from the hand
            const cardsAfterPlay = currCards.filter(c => c !== card);
            setCurrCards(cardsAfterPlay); //update the hand
            
            // Calculate final counts after state updates
            let finalHandCount;
            let finalDeckCount;
            
            //update the hand and current deck
            if (currDeck.length > 0) { //check if there are cards left in the deck
                const newCard = currDeck[0]; //get the new card from the top of the deck
                const updatedDeck = currDeck.slice(1);  //get the updated deck
                setCurrDeck(updatedDeck);               //set the currDeck to the updated deck
                setCurrCards(prevCards => [...prevCards, newCard]);  //add the new card to the hand
                
                // Hand stays at 5 (we removed 1 but drew 1), deck decreases by 1
                finalHandCount = currCards.length; // Same as before (5)
                finalDeckCount = currDeck.length - 1; // Decreased by 1
            } else {
                // No cards to draw, hand decreases by 1, deck stays at 0
                finalHandCount = currCards.length - 1;
                finalDeckCount = 0;
            }
            
            if(targetPile ==="middle1"){
                setMiddleCardL(prevCards => {
                    const newPile = [...prevCards, card];
                    return newPile;
                });
            }else{
                setMiddleCardR(prevCards => {
                    const newPile = [...prevCards, card];
                    return newPile;
                });
            }
            
            // Send move to server with calculated final counts
            socket.emit('playCard', {
                card: card,
                targetCard: targetCard,
                targetPile: targetPile,
                playerName: localStorage.getItem('playerName'),
                handCount: finalHandCount,
                deckCount: finalDeckCount
            });
            
            // Check if you won (no cards left)
            if (currCards.length === 1) { // Will be 0 after state updates
                socket.emit('playerWon');
                navigate('/winner');
            }
        }
    }

    //signal to the player has no cards left to play in their hand
    function signalNoCards() {
        setStaleMate(true);
        socket.emit('noCards');
        setStatus('Waiting for opponent...');
    }

    // Mobile-friendly: click to select card
    function handleCardClick(card) {
        if (selectedCard === card) {
            setSelectedCard(null); // Deselect if clicking same card
        } else {
            setSelectedCard(card);
            setStatus(`Selected ${card}. Click a middle pile to play.`);
        }
    }

    // Mobile-friendly: click middle pile to play selected card
    function handleMiddlePileClick(e, targetPileId) {
        if (!selectedCard) {
            setStatus('Select a card from your hand first.');
            return;
        }

        const targetCard = e.target.innerText;
        if (isValidMove(selectedCard, targetCard)) {
            // Same logic as handleDrop
            const cardsAfterPlay = currCards.filter(c => c !== selectedCard);
            setCurrCards(cardsAfterPlay);
            
            let finalHandCount;
            let finalDeckCount;
            
            if (currDeck.length > 0) {
                const newCard = currDeck[0];
                const updatedDeck = currDeck.slice(1);
                setCurrDeck(updatedDeck);
                setCurrCards(prevCards => [...prevCards, newCard]);
                
                finalHandCount = currCards.length;
                finalDeckCount = currDeck.length - 1;
            } else {
                finalHandCount = currCards.length - 1;
                finalDeckCount = 0;
            }
            
            if(targetPileId === "middle1"){
                setMiddleCardL(prevCards => [...prevCards, selectedCard]);
            } else {
                setMiddleCardR(prevCards => [...prevCards, selectedCard]);
            }
            
            socket.emit('playCard', {
                card: selectedCard,
                targetCard: targetCard,
                targetPile: targetPileId,
                playerName: localStorage.getItem('playerName'),
                handCount: finalHandCount,
                deckCount: finalDeckCount
            });
            
            setSelectedCard(null);
            setStatus('Card played!');
            
            if (currCards.length === 1) {
                socket.emit('playerWon');
                navigate('/winner');
            }
        } else {
            setStatus(`Cannot play ${selectedCard} on ${targetCard}`);
        }
    }

    // Player declares they won
    function handleIWon() {
        socket.emit('playerWon');
        localStorage.setItem('gameResult', 'won');
        navigate('/winner');
    }

    function isValidMove(card, targetPile) {
        // Return true if the move is valid, false otherwise
        console.log("inside isValidMove")
        //since I'm haveing an issue with comparing 10s, here is my workaround
        let cardNum=''
        let targetPileNum=''
        let test10 = Array.from(card).slice(0,2)
        if (test10[0] === '1' && test10[1] === '0'){
            cardNum = '10'
        }else{
            cardNum= Array.from(card).slice(0,1)
        }
        test10 = Array.from(targetPile).slice(0,2)
        if (test10[0] === '1' && test10[1] === '0'){
            targetPileNum = '10'
        } else {
            targetPileNum = Array.from(targetPile).slice(0,1)
        }
        console.log("cardNum:", cardNum[0], "targetPileNum:", targetPileNum[0])
        if (cardNum[0] === 'A'){
            if (targetPileNum[0] === 'K' || parseInt(targetPileNum) === 2)
                return true;
            else{
                return false;
            }
        } else if(cardNum[0] === 'K'){
            if(targetPileNum[0] === 'A' || targetPileNum[0] === 'Q')
                return true;
            else{
                return false;
            }
        } else if (cardNum[0] === 'Q'){
            if (targetPileNum[0] === 'K' || targetPileNum[0] === 'J')
                return true;
            else{
                return false;
            }
        } else if (cardNum[0] === 'J'){
            if(targetPileNum[0] === 'Q' || targetPileNum === '10')
                return true;
            else{
                return false;
            }
        } else if (cardNum === '10'){
            if (targetPileNum[0] === 'J' || targetPileNum[0] === '9')
                return true;
            else{
                return false;
            }
        } else if (cardNum[0] === '2'){
            if (targetPileNum[0] === '3' || targetPileNum[0] === 'A')
                return true;
            else{
                return false;
            }
        } else{
            cardNum = parseInt(cardNum[0]);
            targetPileNum = parseInt(targetPileNum);
            if (cardNum === targetPileNum + 1 || cardNum === targetPileNum - 1) {
                console.log("valid move")
                return true;
            }else{
                console.log("invalid move")
                return false;
            }
        }
    }

    //initialize the game state
    useEffect(() => {
        socket.emit('gameStarted');
    }, []);

    return (
        <div>
            <h1>Speed Game</h1>
            <div className="opponent-table">
                <h2>Opponent's Card Count: {opponentCards.length + opponentsDeck.length}</h2>
                {opponentsDeck.length > 0 && <div className="card">{opponentsDeck.length}</div>}
                <div className="card" id="card1"></div>
                <div className="card" id="card2"></div>
                <div className="card" id="card3"></div>
                <div className="card" id="card4"></div>
                <div className="card" id="card5"></div>
            </div>

            <div className="middle-cards" id="center-pile" onDragOver={handleDragOver} onDrop={handleDrop} >
                <div 
                    className="card" 
                    id="middle1"
                    onClick={(e) => handleMiddlePileClick(e, 'middle1')}
                    style={{ cursor: selectedCard ? 'pointer' : 'default' }}
                >
                    {middleCardL[middleCardL.length-1]}
                </div>
                <div 
                    className="card" 
                    id="middle2"
                    onClick={(e) => handleMiddlePileClick(e, 'middle2')}
                    style={{ cursor: selectedCard ? 'pointer' : 'default' }}
                >
                    {middleCardR[middleCardR.length-1]}
                </div>
                
            </div>

            <div className="your-table" id="player-hand">
                {currCards.map((card, idx) => (
                    <div 
                        key={idx}
                        className="card" 
                        data-value={card}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, card)}
                        onClick={() => handleCardClick(card)}
                        style={{ 
                            cursor: 'pointer',
                            border: selectedCard === card ? '3px solid #007bff' : '1px solid #444',
                            boxShadow: selectedCard === card ? '0 0 10px rgba(0,123,255,0.5)' : 'none'
                        }}
                    >
                        {card}
                    </div>
                ))}
                <h2>Your Card Count: {currCards.length + currDeck.length}</h2>
                 {currDeck.length > 0 && <div className="card">{currDeck.length}</div>}
            </div>

            <div style={{ margin: '20px', textAlign: 'center' }}>
                <button onClick={signalNoCards} style={{ margin: '10px', padding: '10px 20px' }}>
                    No Cards To Play
                </button>

                <button 
                    onClick={handleIWon} 
                    style={{ 
                        margin: '10px', 
                        padding: '10px 20px', 
                        backgroundColor: '#4CAF50', 
                        color: 'white',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}
                >
                    I Won!
                </button>
            </div>
            <h1>{status}</h1>
        </div>
    );
}