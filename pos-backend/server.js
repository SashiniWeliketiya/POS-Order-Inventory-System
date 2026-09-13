const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Global variable to cache the DB connection in Vercel Serverless
let cachedDb = null;

const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not defined in environment variables!");
  }

  // Connect without buffering to prevent 10000ms timeouts on serverless functions
  cachedDb = await mongoose.connect(MONGO_URI, {
    bufferCommands: false,
  });

  console.log('MongoDB Connected Successfully');
  return cachedDb;
};

// Middleware to ensure DB is connected on every API request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection middleware error:', err);
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
});

// Root Health Check Route
app.get('/', (req, res) => {
  res.send('POS Backend API is Running Successfully!');
});

// Product Schema & Model
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
});
const Product = mongoose.model('Product', productSchema);

// Order Schema & Model (Stock Reservation Logic)
const orderSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ['RESERVED', 'COMPLETED', 'EXPIRED'], default: 'RESERVED' },
  createdAt: { type: Date, default: Date.now, expires: 300 } // Auto-expire after 5 minutes
});
const Order = mongoose.model('Order', orderSchema);

// --- API ROUTES ---

// 1. Get All Products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add New Product
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({ error: 'All fields (name, price, stock) are required' });
    }
    const product = new Product({ name, price: Number(price), stock: Number(stock) });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Reserve Stock (Concurrency-Safe)
app.post('/api/orders/reserve', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = Number(quantity);

    // Atomic update to prevent race conditions
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(400).json({ error: 'Insufficient stock or product not found' });
    }

    const order = new Order({ productId, quantity: qty });
    await order.save();

    res.status(201).json({ message: 'Stock reserved successfully', order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Complete Order (Payment Gateway Simulation)
app.post('/api/orders/complete', async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order || order.status !== 'RESERVED') {
      return res.status(400).json({ error: 'Invalid or expired order' });
    }

    order.status = 'COMPLETED';
    await order.save();

    res.json({ message: 'Payment successful, order completed!', order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Local Development Server Listener
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;