const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const { MongoClient } = require('mongodb');

const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqgpfrz.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();
    // const petCollection = client.db("petadoptionDB").collection("pets");

// collection 

    const assignmentCollection = client
      .db("assignmentDB")
      .collection("pets");
// get operation

app.get('/pets', async (req, res) => {
 const cursor=  assignmentCollection.find();
 const result= await cursor.toArray();
 res.send(result);
});

// for Mylist

app.get('/pets', async (req, res) => {
  try {
    const { email } = req.query;
    if (email) {
      const cursor = assignmentCollection.find({ email });
      const pets = await cursor.toArray();
      res.json(pets);
    } else {
      const cursor = assignmentCollection.find();
      const pets = await cursor.toArray();
      res.json(pets);
    }
  } catch (error) {
    console.error('Error fetching pets:', error);
    res.status(500).json({ error: 'Failed to fetch pets' });
  }
});


// post operation

// post pet form into database
      app.post("/pets", async (req, res) => {
        const newPet = req.body;
        console.log(newPet);
        const result = await assignmentCollection.insertOne(newPet);
        res.send(result);
      });


    app.get("/", (req, res) => {
      res.send("pet adoption hoise");
    });

    // Ping MongoDB deployment
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Close client connection
    // await client.close();
  }
}

run()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is running on port :${port}`);
    });
  })
  .catch(() => {
    console.dir;
  });




// const express = require("express");
// const cors = require("cors");
// require("dotenv").config();
// const jwt = require("jsonwebtoken");
// const cookieParser = require('cookie-parser');
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// const app = express();
// const port = process.env.PORT || 5000;

// // Middleware
// app.use(cors());
// app.use(express.json());


// // MongoDB URI
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqgpfrz.mongodb.net/?retryWrites=true&w=majority`;

// // Create a MongoClient
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   },
// });



// // Connect to MongoDB
// async function run() {
//   try {
//     // await client.connect();
//     const assignmentCollection = client
//       .db("assignmentDB")
//       .collection("pets");

//       app.post("/pets", async (req, res) => {
//         const handleSubmit = req.body;
//         console.log(handleSubmit);
//         const result = await assignmentCollection.insertOne(handleSubmit);
//         res.send(result);
//       });


   

//     app.get("/", (req, res) => {
//       res.send("pet adoption hocche!");
//     });

//     // Ping MongoDB deployment
//     // await client.db("admin").command({ ping: 1 });
//     console.log(
//       "Pinged your deployment. You successfully connected to MongoDB!"
//     );
//   } finally {
//     // Close client connection
//     // await client.close();
//   }
// }

// run()
//   .then(() => {
//     app.listen(port, () => {
//       console.log(`Server is running on port :${port}`);
//     });
//   })
//   .catch(() => {
//     console.dir;
//   });

// // Default route

// // Start server