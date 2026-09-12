require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');

const Product = require('./models/Product');
const Order = require('./models/Order');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_system')
  .then(() => console.log('MongoDB Connected successfully!'))
  .catch(err => console.error(err));


app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    const result = products.map(p => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      totalStock: p.stock,
      availableStock: p.stock - p.reservedStock
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/reserve', async (req, res) => {
  try {
    const { items, idempotencyKey } = req.body;
    let totalAmount = 0;

    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey });
      if (existingOrder) {
        return res.json(existingOrder);
      }
    }

    for (let item of items) {
      // Atomic Update (Atomic operations keep it concurrency-safe even without explicit transactions)
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          $expr: { $gte: [{ $subtract: ["$stock", "$reservedStock"] }, item.quantity] }
        },
        { $inc: { reservedStock: item.quantity } },
        { returnDocument: 'after' }
      );

      if (!updatedProduct) {
        return res.status(400).json({ error: `Insufficient stock for product ID: ${item.productId}` });
      }

      totalAmount += updatedProduct.price * item.quantity;
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const order = new Order({
      items,
      totalAmount,
      status: 'RESERVED',
      idempotencyKey,
      expiresAt
    });

    await order.save();
    res.status(201).json({ message: "Stock reserved for 5 minutes!", order });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/orders/pay', async (req, res) => {
  try {
    const { orderId, paymentOutcome } = req.body;

    const order = await Order.findById(orderId);
    if (!order || order.status !== 'RESERVED') {
      return res.status(400).json({ error: 'Invalid order status or order not found' });
    }

    if (paymentOutcome === 'success') {
      order.status = 'PAID';
      await order.save();

      for (let item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity, reservedStock: -item.quantity }
        });
      }
      return res.json({ message: 'Payment successful! Order completed.', order });

    } else if (paymentOutcome === 'failure' || paymentOutcome === 'timeout') {
      order.status = paymentOutcome === 'failure' ? 'FAILED' : 'EXPIRED';
      await order.save();

      for (let item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { reservedStock: -item.quantity }
        });
      }
      return res.json({ message: `Payment ${paymentOutcome}. Stock released!`, order });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



cron.schedule('* * * * *', async () => {
  try {
    const expiredOrders = await Order.find({
      status: 'RESERVED',
      expiresAt: { $lt: new Date() }
    });

    for (let order of expiredOrders) {
      order.status = 'EXPIRED';
      await order.save();

      for (let item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { reservedStock: -item.quantity }
        });
      }
      console.log(`Order ${order._id} expired and stock released.`);
    }
  } catch (err) {
    console.error('Error in Cron Job:', err);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));