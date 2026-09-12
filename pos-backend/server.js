const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Database Connection String එක Direct සහ Env Variable දෙකෙන්ම check කිරීම
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://sashini:sashini123@cluster0.xxx.mongodb.net/pos_system?retryWrites=true&w=majority";

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    const db = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = db.connections[0].readyState;
    console.log("MongoDB Connected Successfully");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
  }
};

// Global Middleware එක හරහා හැම request එකකටම DB connect කරවීම
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Root Route Test එක
app.get('/', (req, res) => {
  res.send('POS Backend API is running successfully!');
});

// Sample Products API Endpoint
app.get('/api/products', async (req, res) => {
  try {
    // Database එකෙන් Products ගන්නා Route එක
    const products = await mongoose.connection.db.collection('products').find({}).toArray();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;