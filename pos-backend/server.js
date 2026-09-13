const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let cachedPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is missing in Vercel Environment Variables!");
  }

  if (!cachedPromise) {
    const opts = {
      bufferCommands: true,
      serverSelectionTimeoutMS: 5000,
    };
    cachedPromise = mongoose.connect(MONGO_URI, opts).then((m) => m);
  }

  try {
    await cachedPromise;
  } catch (e) {
    cachedPromise = null;
    throw e;
  }

  return mongoose.connection;
};

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection middleware error:', err);
    return res.status(500).json({ error: 'Database Connection Failed: ' + err.message });
  }
});

app.get('/', (req, res) => {
  res.send('POS Backend API is Running Successfully!');
});

// --- SCHEMAS & MODELS ---
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
});
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ['RESERVED', 'COMPLETED', 'CANCELLED', 'EXPIRED'], default: 'RESERVED' },
  createdAt: { type: Date, default: Date.now, expires: 300 }
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

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

// 2. Get All Orders (Order Audit Log එක සදහා)
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Add New Product
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    const parsedPrice = Number(price);
    const parsedStock = Number(stock);

    if (!name || isNaN(parsedPrice) || isNaN(parsedStock)) {
      return res.status(400).json({ 
        error: 'Invalid input data: Please provide a valid Name, Price, and Stock quantity.' 
      });
    }

    const product = new Product({ name, price: parsedPrice, stock: parsedStock });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Reserve Stock
app.post('/api/orders/reserve', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = Number(quantity);

    if (!productId || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Please provide a valid product and quantity to reserve' });
    }

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

// 5. Complete Order (Payment Simulation)
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

// 6. Cancel Order (Restores Stock)
app.post('/api/orders/cancel', async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order || order.status !== 'RESERVED') {
      return res.status(400).json({ error: 'Order cannot be cancelled' });
    }

    // Restore stock back to product
    await Product.findByIdAndUpdate(order.productId, { $inc: { stock: order.quantity } });
    
    order.status = 'CANCELLED';
    await order.save();

    res.json({ message: 'Order cancelled and stock restored!', order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;