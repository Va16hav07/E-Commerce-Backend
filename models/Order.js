const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  size: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  imageUrl: {
    type: String
  }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerAddress: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String,
    required: true
  },
  items: {
    type: [OrderItemSchema],
    required: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['PAID', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'NOT_DELIVERED', 'CANCELLED'],
    default: 'PAID'
  },
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  riderName: {
    type: String
  },
  deliveryAddress: {
    type: String
  },
  paymentMethod: {
    type: String,
    enum: ['CARD', 'COD', 'WALLET', 'card', 'cod', 'wallet'],  // Added lowercase options
    default: 'CARD'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', OrderSchema);
