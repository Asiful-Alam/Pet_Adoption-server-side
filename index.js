const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin:[ 
    'http://localhost:5173'
  ],
  credentials: true,
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqgpfrz.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    await client.connect();

    const petCollection = client.db("assignmentDB").collection("petlist");
    const donationCollection = client.db("assignmentDB").collection("donation");
    const assignmentCollection = client.db("assignmentDB").collection("pets");
    const userCollection = client.db("assignmentDB").collection("info");
    // const myCampaignsCollection = client.db("assignmentDB").collection("mycampaigns");

    // middleware for jwt

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // user releted api

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    // get all user for admin
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // save user info into database
    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // admin delete releted apis
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    // admin api
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // user related api closed

    // Get all pets
    app.get("/pets", async (req, res) => {
      const cursor = assignmentCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // delete pet from admin
    app.delete("/pets/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentCollection.deleteOne(query);
      res.send(result);
    });
    // update pet info :admin
    // Update a pet
    app.patch("/pets/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedPet = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: updatedPet.name,
          age: updatedPet.age,
          shortDescription: updatedPet.shortDescription,
          shortDescription: updatedPet.shortDescription,
          category: updatedPet.category,
          location: updatedPet.location,
          adopted: updatedPet.adopted,
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
    app.get("/donation", async (req, res) => {
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      try {
        const campaigns = await donationCollection
          .find({})
          .sort({ createdAt: -1 }) // Sort by date in descending order
          .skip(parseInt(skip))
          .limit(parseInt(limit))
          .toArray();
        res.send(campaigns);
      } catch (error) {
        console.error("Error fetching campaigns:", error);
        res.status(500).json({ error: "Failed to fetch campaigns" });
      }
    });

// get campaign aDMIN 
app.get('/donation', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (page - 1) * limit;

  try {
    const campaigns = await donationCollection
      .find({})
      .sort({ createdAt: -1 }) // Sort by date in descending order
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .toArray();
    res.send(campaigns);
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});
// delete campaign from admin
app.delete("/donation/:id", verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await donationCollection.deleteOne(query);
  res.send(result);
});


    // Get details of a specific donation campaign
    app.get("/donation/:id", async (req, res) => {
      const campaignId = req.params.id; // Retrieve the campaign ID from the request parameters

      try {
        const campaign = await donationCollection.findOne({
          _id: new ObjectId(campaignId),
        }); // Find the campaign by its ID in the donation collection
        if (!campaign) {
          return res.status(404).json({ message: "Campaign not found" }); // Return a 404 response if campaign is not found
        }
        res.json(campaign); // Send the campaign details as a JSON response
      } catch (error) {
        console.error("Error fetching campaign details:", error);
        res.status(500).json({ error: "Failed to fetch campaign details" }); // Return a 500 response if there's an error
      }
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
// my added pet
// Assuming you are using Express.js
app.get("/pets/:email", async (req, res) => {
  const userEmail = req.params.email;
  try {
    const pets = await assignmentCollection.find({ email: userEmail }).toArray();
    res.json(pets);
  } catch (error) {
    console.error("Error fetching pets:", error);
    res.status(500).json({ error: "Failed to fetch pets" });
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

    // Get campaign details created by a specific user
    app.get("/mycampaigns/:email", async (req, res) => {
      const userEmail = req.params.email;
      try {
        const campaigns = await donationCollection.find({ email: userEmail }).toArray();
        res.json(campaigns);
      } catch (error) {
        console.error("Error fetching user campaigns:", error);
        res.status(500).json({ error: "Failed to fetch user campaigns" });
      }
    });

    // JWT related API
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // Payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100); // Convert to smallest currency unit (e.g., cents)
  
      try {
          const paymentIntent = await stripe.paymentIntents.create({
              amount: amount,
              currency: "USD",
              payment_method_types: ['card'],
          });
          res.send({
              clientSecret: paymentIntent.client_secret,
          });
      } catch (error) {
          console.error("Error creating payment intent:", error);
          res.status(500).send({ error: "Failed to create payment intent" });
      }
  });
  

    // Update donation amount
    app.post("/update-donation/:id", async (req, res) => {
      const { id } = req.params;
      const { amount, email } = req.body;  // Include email in the request body
    
      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $inc: { donatedAmount: amount },
        };
    
        const result = await donationCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Campaign not found" });
        }
    
        const updatedCampaign = await donationCollection.findOne(filter);
    
        // Save the donation information along with the user's email
        await donationCollection.insertOne({
          campaignId: id,
          donatedAmount: amount,
          email,  // Save user's email with the donation
          createdAt: new Date()
        });
    
        res.send({ updatedAmount: updatedCampaign.donatedAmount });
      } catch (error) {
        console.error("Error updating donation amount:", error);
        res.status(500).send({ error: "Failed to update donation amount" });
      }
    });
    

    // Assuming you have already implemented routes to handle donations

// Get donations by user email
app.get("/mycampaigns/:email", async (req, res) => {
  const userEmail = req.params.email;
  try {
    // Retrieve donations associated with the user's email
    const donations = await donationCollection.find({ email: userEmail }).toArray();
    res.json(donations);
  } catch (error) {
    console.error("Error fetching user donations:", error);
    res.status(500).json({ error: "Failed to fetch user donations" });
  }
});


    // End
    app.get("/", (req, res) => {
      res.send("Pet adoption API is running.");
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

