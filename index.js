const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const jwt=require('jsonwebtoken')
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


// middleware for jwt

    // middlewares 
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }
    



    // user releted api 

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })
    // get all user for admin
  app.get('/users',verifyToken,verifyAdmin, async (req, res) => {
    console.log(req.headers);
    const result =await userCollection.find().toArray();
    res.send(result);
  })


// save user info into database
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
// admin delete releted apis
app.delete('/users/:id',verifyToken,verifyAdmin, async (req, res) => {
  const id =req.params.id;
  const query = {_id:new ObjectId(id) }
  const result = await userCollection.deleteOne(query);
  res.send(result);
})
  // admin api
app.patch('/users/admin/:id',verifyToken,verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updatedDoc = {
    $set: {
      role: 'admin',
    }
  };
  const result = await userCollection.updateOne(filter, updatedDoc);
  res.send(result);
});




    // user related api closed


    // Get all pets
    app.get('/pets', async (req, res) => {
      const cursor = assignmentCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // delete pet from admin
    app.delete('/pets/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentCollection.deleteOne(query);
      res.send(result);
    });
    // update pet info :admin
    // Update a pet
app.patch('/pets/:id', verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const updatedPet = req.body;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      name: updatedPet.name,
      age: updatedPet.age,
      shortDescription: updatedPet.shortDescription,      shortDescription: updatedPet.shortDescription,
      category: updatedPet.category,
      location: updatedPet.location,
      adopted: updatedPet.adopted
    },
  };
  try {
    const result = await assignmentCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    console.error("Error updating pet:", error);
    res.status(500).send({ message: "Failed to update pet" });
  }
});
// admin change adopted or not adopted




    
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

    // JWT releted api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

 

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
