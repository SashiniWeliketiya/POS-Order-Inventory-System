const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Order = require('./models/Order'); // Model එක import කරගන්න

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.get('/', (req, res) => {
  res.send('POS Backend API is Running Successfully!');
});

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos-system';

// MongoDB Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
});
const Product = mongoose.model('Product', productSchema);

// Background Worker: Auto-Expire Reservations (Runs every 10s)
setInterval(async () => {
  try {
    const expiredOrders = await Order.find({
      status: 'RESERVED',
      expiresAt: { $lt: new Date() }
    });

    for (const order of expiredOrders) {
      order.status = 'EXPIRED';
      await order.save();

      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
      console.log(`[EXPIRED] Order ${order._id} auto-expired. Stock released.`);
    }
  } catch (err) {
    console.error('Error in expiration worker:', err);
  }
}, 10000);

// API Routes

// Get Products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Product
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    const newProduct = new Product({ name, price, stock });
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reserve Stock (5-Min Lock)
app.post('/api/orders/reserve', async (req, res) => {
  const { items } = req.body;

  try {
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { returnDocument: 'after' }
      );

      if (!product) {
        for (const rolledItem of orderItems) {
          await Product.findByIdAndUpdate(rolledItem.productId, { $inc: { stock: rolledItem.quantity } });
        }
        return res.status(400).json({ error: `Insufficient stock for item ${item.name || item.productId}` });
      }

      totalAmount += product.price * item.quantity;
      orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      });
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const order = new Order({
      items: orderItems,
      totalAmount,
      status: 'RESERVED',
      expiresAt
    });

    await order.save();
    res.status(201).json({ message: 'Order created & Stock Reserved', order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mock Payment API
app.post('/api/orders/pay', async (req, res) => {
  const { orderId, outcome, idempotencyKey } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'RESERVED') {
      return res.status(400).json({ error: `Order cannot be paid. Current status: ${order.status}` });
    }

    if (idempotencyKey && order.idempotencyKey === idempotencyKey) {
      return res.status(400).json({ error: 'Duplicate payment submission detected.' });
    }

    if (idempotencyKey) order.idempotencyKey = idempotencyKey;

    if (outcome === 'success') {
      order.status = 'PAID';
      await order.save();
      return res.json({ success: true, message: 'Payment Successful! Order Confirmed.', order });
    } else if (outcome === 'failure') {
      order.status = 'FAILED';
      await order.save();
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
      return res.json({ success: false, message: 'Payment Failed. Stock Restored.', order });
    } else if (outcome === 'timeout') {
      order.status = 'EXPIRED';
      await order.save();
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
      return res.json({ success: false, message: 'Payment Timed Out. Stock Restored.', order });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel Order
app.post('/api/orders/cancel', async (req, res) => {
  const { orderId } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (['CANCELLED', 'EXPIRED'].includes(order.status)) {
      return res.status(400).json({ error: 'Order is already closed.' });
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
    }

    order.status = 'CANCELLED';
    await order.save();

    res.json({ message: 'Order Cancelled Successfully. Stock restored.', order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Orders
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));