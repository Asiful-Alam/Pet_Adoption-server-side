// app.js

const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const { MongoClient } = require('mongodb');

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();
    const petCollection = client.db("petDB").collection("pets");

    app.post('/pets', async (req, res) => {
    
        const newPet = req.body;
        const result = await petCollection.insertOne(newPet);
        res.send(result);
    });

    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
  }
}

run().catch(console.error);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
