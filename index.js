const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;



// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173",
      "https://full-project-pet.web.app",
      "https://full-project-pet.firebaseapp.com"
    ],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqgpfrz.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // await client.connect();

    const petCollection = client.db("assignmentDB").collection("petlist");
    const donationCollection = client.db("assignmentDB").collection("donation");
    const assignmentCollection = client.db("assignmentDB").collection("pets");
    const userCollection = client.db("assignmentDB").collection("info");
    const adoptCollection = client.db("assignmentDB").collection("adoptions");
    const paymentCollection = client.db("assignmentDB").collection("payment");
    const myCampaignsCollection = client.db("assignmentDB").collection("mycampaigns");

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

    app.get("/adoption-requests", async (req, res) => {
       
      try {

        const allAdoptionRequests = await adoptCollection.find({}).toArray()
        const finallyAdoptionRequests = []
        
        for (const val of allAdoptionRequests) {
          const petInfo = await assignmentCollection.findOne({ _id: new ObjectId(val.petId) });
          console.log(petInfo.email, req.query.user)
          if (petInfo && petInfo.email == req.query.user && petInfo.status=="APPLIED") {
            finallyAdoptionRequests.push(val);
          }
        }
        
        res.send(finallyAdoptionRequests);
      } catch (error) {
        console.error("Error fetching adoption requests:", error);
        res.status(500).json({ error: "Failed to fetch adoption requests" });
      }
    });
    
  app.patch("/adoption-requests/:id", async (req, res) => {
    const requestId = req.params.id;
    const { status } = req.body;

    try {
        const result = await assignmentCollection.updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status } }
        );
        res.send(result);
    } catch (error) {
        console.error("Error updating adoption status:", error);
        res.status(500).json({ error: "Failed to update adoption status" });
    }
});

     

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
      const cursor = assignmentCollection.find({status: "POSTED"});
      const result = await cursor.toArray();
      res.send(result);
    });

    //get  allpetdetails
   
// Get details of a specific pet
app.get("/pets/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const pet = await assignmentCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!pet) {
      return res.status(404).json({ message: "Pet not found" });
    }
    res.json(pet);
  } catch (error) {
    console.error("Error fetching pet details:", error);
    res.status(500).json({ error: "Failed to fetch pet details" });
  }
});
// Get pets by user email
app.get("/mypets/:email", async (req, res) => {
  const userEmail = req.params.email;
  console.log("Fetching my pet for specific user:", 
    userEmail);
  try {
    const pets = await assignmentCollection
      .find({ email: userEmail })
      .toArray();
    res.json(pets);
    console.log("Found campaigns:", pets);
  } catch (error) {
    console.error("Error fetching pets:", error);
    res.status(500).json({ error: "Failed to fetch pets" });
  }
});
  // Delete pet from user dashboard
  app.delete("/pets/:id", async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await assignmentCollection.deleteOne(query);
    res.send(result);
  });
 // Update a pet
app.put('/pets/:id', async (req, res) => {
  const id = req.params.id;
  const { name, category, image, adopted } = req.body;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      name: name,
      category: category,
      image: image,
      adopted: adopted
    }
  };
  try {
    const result = await assignmentCollection.updateOne(filter, updateDoc);
    if (result.modifiedCount === 1) {
      res.status(200).send({ message: 'Pet updated successfully' });
    } else {
      res.status(404).send({ message: 'Pet not found' });
    }
  } catch (error) {
    console.error('Error updating pet:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});


    // Add a new adoption request
    app.post("/adoption", async (req, res) => {
      const adoptionData = req.body;
      // petId
      try {
        const result = await client
          .db("assignmentDB")
          .collection("adoptions")
          .insertOne(adoptionData);
        await assignmentCollection.updateOne({_id: new ObjectId(req.body.petId)},
        {$set:{status:"APPLIED"}});
    
        res.send(result);
      } catch (error) {
        console.error("Error creating adoption request:", error);
        res.status(500).json({ error: "Failed to create adoption request" });
      }
    });
    

    // GET adoption requests by user email
    app.get("/adoption/:email", async (req, res) => {
      const userEmail = req.params.email;
      console.log("Fetching adoption requests for user:", userEmail);
      try {
        const adoptionRequests = await client
          .db("assignmentDB")
          .collection("adoptions")
          .find({ userEmail })
          .toArray();
          const finallyAdoptionRequests = []
        
        for (const val of adoptionRequests) {
          const petInfo = await assignmentCollection.findOne({ _id: new ObjectId(val.petId) });
          
          if (petInfo && petInfo.status=="APPROVED") {
            finallyAdoptionRequests.push({...val,status: "APPROVED"});
          }

          else if (petInfo && petInfo.status=="REJECTED") {
            finallyAdoptionRequests.push({...val,status: "REJECTED"});
          }

          else{
            finallyAdoptionRequests.push(val)
          }
        }
        res.json(finallyAdoptionRequests);
      } catch (error) {
        console.error("Error fetching adoption requests:", error);
        res.status(500).json({ message: "Internal server error" });
      }
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
    app.get("/donation", async (req, res) => {
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
   // delete donation from admin
   app.delete("/donation/:id", verifyToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await donationCollection.deleteOne(query);
    res.send(result);
  });
// Backend route for updating donation details FOR ADMIN
// app.put("/donation/:id", verifyToken, verifyAdmin, async (req, res) => {
//   const id = req.params.id;
//   const updatedDonation = req.body;

//   try {
//     const result = await donationCollection.updateOne(
//       { _id: ObjectId(id) },
//       { $set: updatedDonation }
//     );

//     if (result.modifiedCount === 1) {
//       res.json({ message: "Donation updated successfully" });
//     } else {
//       res.status(404).json({ error: "Donation not found or no changes made" });
//     }
//   } catch (error) {
//     console.error("Error updating donation:", error);
//     res.status(500).json({ error: "Failed to update donation" });
//   }
// });

// admin donation paused button
// app.put("/donation/:id/pause", verifyToken, verifyAdmin, async (req, res) => {
//   const id = req.params.id;
//   const { isPaused } = req.body;
//   try {
//     const result = await donationCollection.updateOne(
//       { _id: new ObjectId(id) },
//       { $set: { isPaused: isPaused } }
//     );
//     res.json({ message: "Donation status updated successfully" });
//   } catch (error) {
//     console.error("Error updating donation status:", error);
//     res.status(500).json({ error: "Failed to update donation status" });
//   }
// });



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
   // Add a new pet
app.post("/pets", async (req, res) => {
  const newPet = req.body;
  newPet.status = "POSTED"
  try {
    const result = await assignmentCollection.insertOne(newPet);
    res.send(result);
  } catch (error) {
    console.error("Error adding pet:", error);
    res.status(500).json({ error: "Failed to add pet" });
  }
});

    // my added pet

    // app.get("/pets/:email", async (req, res) => {
    //   const userEmail = req.params.email;
    //   try {
    //     const pets = await assignmentCollection
    //       .find({ email: userEmail })
    //       .toArray();
    //     res.json(pets);
    //   } catch (error) {
    //     console.error("Error fetching pets:", error);
    //     res.status(500).json({ error: "Failed to fetch pets" });
    //   }
    // });

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
      console.log("Fetching campaigns for user:", userEmail);
      try {
        const campaigns = await donationCollection
          .find({ email: userEmail })
          .toArray();
        console.log("Found campaigns:", campaigns);
        res.json(campaigns);
      } catch (error) {
        console.error("Error fetching user campaigns:", error);
        res.status(500).json({ error: "Failed to fetch user campaigns" });
      }
    });
    // Update a donation campaign
// app.patch("/donation/:id", async (req, res) => {
//   const campaignId = req.params.id;
//   const updatedData = req.body;

//   try {
//     const result = await donationCollection.updateOne(
//       { _id: ObjectId(campaignId) },
//       { $set: updatedData }
//     );
//     if (result.modifiedCount > 0) {
//       res.json({ message: "Campaign updated successfully" });
//     } else {
//       res.status(404).json({ error: "Campaign not found" });
//     }
//   } catch (error) {
//     console.error("Error updating campaign:", error);
//     res.status(500).json({ error: "Failed to update campaign" });
//   }
// });
// PUT route to update a donation
// Update a donation
// Update a donation
app.put('/donation/:id', async (req, res) => {
  const id = req.params.id;
  const { maxDonation, lastDate, email } = req.body;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      maxDonation: maxDonation,
      lastDate: lastDate,
      email: email
    }
  };
  try {
    const result = await donationCollection.updateOne(filter, updateDoc);
    if (result.modifiedCount === 1) {
      res.status(200).send({ message: 'Donation updated successfully' });
    } else {
      res.status(404).send({ message: 'Donation not found' });
    }
  } catch (error) {
    console.error('Error updating donation:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});
// display donation into that _id
app.get('/donation/:id/donators', async (req, res) => {
  const campaignId = req.params.id;
  try {
    // Assuming you have a database collection named 'donations' with a field 'campaignId'
    const donations = await Donation.find({ campaignId });
    res.json({ donators: donations });
  } catch (error) {
    console.error('Error fetching donators:', error);
    res.status(500).json({ error: 'Failed to fetch donators' });
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
  const { price, email } = req.body;
  const amount = parseInt(price * 100); // Convert to smallest currency unit (e.g., cents)

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "USD",
      payment_method_types: ["card"],
    });

    // Save payment details into database
    const payment = {
      amount: price,
      email: email,
      createdAt: new Date(),
      // You can include more payment details here as needed
    };

    await paymentCollection.insertOne(payment);

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
  const { amount, email } = req.body; // Include email in the request body
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
      email, // Save user's email with the donation
      createdAt: new Date(),
    });

    res.send({ updatedAmount: updatedCampaign.donatedAmount });
  } catch (error) {
    console.error("Error updating donation amount:", error);
    res.status(500).send({ error: "Failed to update donation amount" });
  }
});


    // Assuming you have already implemented routes to handle donations

    // Get donations by user email
    // app.get("/mycampaigns/:email", async (req, res) => {
    //   const userEmail = req.params.email;
    //   try {
    //     // Retrieve donations associated with the user's email
    //     const donations = await donationCollection.find({ email: userEmail }).toArray();
    //     res.json(donations);
    //   } catch (error) {
    //     console.error("Error fetching user donations:", error);
    //     res.status(500).json({ error: "Failed to fetch user donations" });
    //   }
    // });

// Fetch donations by user email
app.get("/userpayment/:email", async (req, res) => {
  const { email } = req.params;
  try {
    const donations = await paymentCollection.find({ email }).toArray();
    res.send(donations);
  } catch (error) {
    console.error("Error fetching donations:", error);
    res.status(500).send({ error: "Failed to fetch donations" });
  }
});


// Process refund
app.post('/refund/:donationId', async (req, res) => {
  const { donationId } = req.params;
  try {
    // Logic to process the refund
    const result = await paymentCollection.deleteOne({ _id: new ObjectId(donationId) });
    if (result.deletedCount === 1) {
      res.status(200).send({ success: true });
    } else {
      res.status(404).send({ error: "Donation not found" });
    }
  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});


//     // Create a refund with Stripe
//     const refund = await stripe.refunds.create({
//       payment_intent: donation.paymentIntentId,
//     });

//     // Remove the donation from the database
//     await paymentCollection.deleteOne({ _id: new ObjectId(donationId) });

//     res.send({ success: true, refund });
//   } catch (error) {
//     console.error("Error processing refund:", error);
//     res.status(500).send({ error: "Failed to process refund" });
//   }
// });

    
    // Get donations by user email
    app.get("/donation/:email", async (req, res) => {
      const userEmail = req.params.email;
      try {
        const donations = await donationCollection
          .find({ email: userEmail })
          .toArray();
        res.json(donations);
      } catch (error) {
        console.error("Error fetching user donations:", error);
        res.status(500).json({ error: "Failed to fetch user donations" });
      }
    });



//     // POST endpoint to handle adoption requests
// app.post('/adoptionRequests', async (req, res) => {
//   try {
//       const { petId, petName, petImage, userName, userEmail, phone, address } = req.body;
      
//       const adoptionRequest = new AdoptionRequest({
//           petId,
//           petName,
//           petImage,
//           userName,
//           userEmail,
//           phone,
//           address
//       });
      
//       await adoptionRequest.save();
  
//       res.status(201).json({ message: 'Adoption request submitted successfully' });
//   } catch (error) {
//       console.error('Error submitting adoption request:', error);
//       res.status(500).json({ error: 'Internal server error' });
//   }
// });

    // End
    app.get("/", (req, res) => {
      res.send("Pet adoption API is running.");
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
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
