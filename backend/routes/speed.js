const express = require('express');
// This will help us connect to the database
const dbo = require('../db/connection');
//get the crypto module to hash passwords
const { ObjectId } = require('mongodb');

// router is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /record.
const recordRoutes = express.Router();

//Insert Routes Below Here:
//save name into sessions.name
recordRoutes.route("/saveName").post(async (req, res) => {
    try {
        console.log("/saveName executed"); //debugging
        req.session.name = req.body.name; //save name into sessions.body.name
        console.log(`Session name: ${req.session.name} | Input Name: ${req.body.name}`); //debugging
        res.json({saved: true});
        console.log("/saveName end"); //debugging
    } catch (err) {
        throw err;
    }
});

//saves the users score: name, win/lose, cards left
recordRoutes.route("/saveScore").post(async (req, res) => {
    try {
        
        let score = {
            name: req.body.name,
            winOrLose: req.body.winOrLose,
            cardsLeft: req.body.cardsLeft,
        }

        let db_connect = await dbo.getDB("SpeedDB"); //connect to the database
        const saveScore = await db_connect //add the score to the scores collection
            .collection("scores")
            .insertOne(score);
        res.json({recorded: true});
    } catch (err) {
        throw err;
    }
});

//return the all the scores
recordRoutes.route("/getScores").get(async (req, res) => {
    try {
        console.log("/getScores executed");
        const db_connect = dbo.getDB("SpeedDB"); //connect to the db
        
        if (!db_connect) { //check if db connection is available
            console.error("Database connection not available in getScores");
            return res.status(500).json({ error: "Database connection not available" });
        }
        console.log("Fetching scores for :", req.session.name);
        const scores = await db_connect.collection("scores").find({name: req.session.name}).toArray(); //access the scores collection and get all the scores for the current session name
        console.log("/getScores ended");
        return res.json(scores);
    } catch (err) {
        console.error("Error in /getScores:", err);
        return res.status(500).json({ error: err.message });
    }
});

//return name
recordRoutes.route("/getName").post(async (req, res) => {
    try {
        console.log("/getName executed"); //debugging
        res.json({name: req.session.name});
    } catch (err) {
        throw err;
    }
});

module.exports = recordRoutes;