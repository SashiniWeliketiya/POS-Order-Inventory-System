const  mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, required: true }
    }
  ],
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['RESERVED', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED'],
    default: 'RESERVED'
  },
  idempotencyKey: { type: String, unique: true }, 
  expiresAt: { type: Date, required: true } 
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);