//Connect to the MongoDB database
const { MongoClient, ServerApiVersion } = require('mongodb'); //import the mongodb package
const uri = process.env.ATLAS_URI;

let _db;
module.exports = {
    connectToServer: function(callback) {
        console.log("Attempting to connect");
        // Create a MongoClient with a MongoClientOptions object to set the Stable API version
        const client = new MongoClient(uri, {
        serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
        }
    });

    async function run() {
        try {
            // Connect the client to the server	(optional starting in v4.7)
            await client.connect();
            // Send a ping to confirm a successful connection
            await client.db("admin").command({ ping: 1 });
            console.log("Pinged your deployment. You successfully connected to MongoDB!");
            _db = client.db("SpeedDB");
            console.log("Successfully connected to SpeedDB database");
        } finally {
            // Ensures that the client will close when you finish/error
            //console.log("Closing the client")
            //await client.close();
        }
    }
    run().catch(console.dir);
    },

    getDB: function() {
        return _db;
    }
};