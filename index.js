require("dotenv").config();
const express = require("express");

const cors = require("cors");

const fetch = require("node-fetch");

const { MongoClient, ObjectId } = require("mongodb");

const app = express();

const port = process.env.PORT || 8080;
const uri = process.env.URI;
const client = new MongoClient(uri);

app.use(cors());
app.use(express.json());

async function getData() {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/users");
    const data = await response.json();

    const users = data.map((user) => ({
      _id: new ObjectId(),
      name: user.name,
      email: user.email,
      street: user.address.street,
      city: user.address.city,
    }));
    return users;
  } catch (error) {
    console.error(error);
    return { error: "Error fetching data from external API" };
  }
}

app.post("/api/fill", async (req, res) => {
  let userData;
  let userCollection;
  let addressCollection;

  try {
    const con = await client.connect();

    const collection1 = con.db("users").collection("info");
    const collection2 = con.db("users").collection("address");
    const infoCount = await collection1.countDocuments();
    const addressCount = await collection2.countDocuments();
    if (infoCount > 0 || addressCount > 0) {
      res.status(400).send({ error: "Collections contain data" });
      return;
    }

    userData = await getData();
    userCollection = userData.map((user) => {
      const objectId = new ObjectId();
      return {
        _id: objectId,
        name: user.name,
        email: user.email,
      };
    });
    addressCollection = userData.map((user, index) => {
      return {
        _id: userCollection[index]._id,
        street: user.street,
        city: user.city,
      };
    });
    await collection1.insertMany(userCollection);
    await collection2.insertMany(addressCollection);
    await con.close();
  } catch (error) {
    console.error(error);
    res.send({ error: "Error connecting to MongoDB or inserting data" });
    return;
  }
  res.send(userData);
});

app.post("/api/users", async (req, res) => {
  const userInfo = {
    name: req.body.name,
    email: req.body.email,
    _id: new ObjectId(),
  };
  const userAddress = {
    street: req.body.street,
    city: req.body.city,
    _id: userInfo._id,
  };
  try {
    const con = await client.connect();
    const infoData = await con
      .db("users")
      .collection("info")
      .insertOne(userInfo);
    const addressData = await con
      .db("users")
      .collection("address")
      .insertOne(userAddress);
    await con.close();
    res.status(200).send({ infoData, addressData });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ message: "An error occurred while processing your request" });
  }
});

app.listen(port, () => {
  console.log(`works on this ${port} port`);
});
