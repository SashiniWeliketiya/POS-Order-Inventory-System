const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware Setup
app.use(cors());
app.use(express.json());

// MongoDB Connection String (Environment Variable or Fallback)
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sashini:sashini123@cluster0.xxx.mongodb.net/pos_system?retryWrites=true&w=majority";

let isConnected = false;

// Serverless DB Connection Handler
const connectDB = async () => {
  if (isConnected) return;
  try {
    const db = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = db.connections[0].readyState;
    console.log("MongoDB Connected Successfully");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
};

// Global Connection Middleware
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Root Health Check Route
app.get('/', (req, res) => {
  res.send('POS Backend API is running successfully!');
});

// 1. GET ALL PRODUCTS
app.get('/api/products', async (req, res) => {
  try {
    const products = await mongoose.connection.db.collection('products').find({}).toArray();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. ADD NEW PRODUCT (POST)
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: "Name and price are required" });
    }

    const newProduct = {
      name,
      price: Number(price),
      stock: Number(stock) || 0,
      createdAt: new Date()
    };

    const result = await mongoose.connection.db.collection('products').insertOne(newProduct);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET ALL ORDERS (Optional - for history log)
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await mongoose.connection.db.collection('orders').find({}).toArray();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;