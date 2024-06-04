const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const port = process.env.PORT || 5000;

// Middleware
const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqgpfrz.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
  try {
    await client.connect();

    const petCollection = client.db("assignmentDB").collection("petlist");
    const donationCollection = client.db("assignmentDB").collection("donation");
    const assignmentCollection = client.db("assignmentDB").collection("pets");
    const userCollection = client.db("assignmentDB").collection("info");

    // user releted api
    app.post('/users', async (req, res) => {
      const user = req.body;
     
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

  




    // user related api closed


    // Get all pets
    app.get('/pets', async (req, res) => {
      const cursor = assignmentCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get donation form
    app.get('/donation', async (req, res) => {
      const cursor = donationCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Add a new pet
    app.post("/pets", async (req, res) => {
      const newPet = req.body;
      try {
        const result = await assignmentCollection.insertOne(newPet);
        res.send(result);
      } catch (error) {
        console.error("Error adding pet:", error);
        res.status(500).json({ error: "Failed to add pet" });
      }
    });

    // Add a new donation campaign
    app.post("/donation", async (req, res) => {
      const newCampaign = req.body;
      try {
        const result = await donationCollection.insertOne(newCampaign);
        res.send(result);
      } catch (error) {
        console.error("Error creating donation campaign:", error);
        res.status(500).json({ error: "Failed to create donation campaign" });
      }
    });

 

// end
    app.get("/", (req, res) => {
      res.send("Pet adoption API is running.");
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
