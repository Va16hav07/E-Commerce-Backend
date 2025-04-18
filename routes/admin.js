const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { isAuthenticated, authorize } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(isAuthenticated, authorize('ADMIN'));

// Add product (Admin only endpoint)
router.post('/product', async (req, res) => {
  try {
    const { title, description, price, image, category, sizes, colors, variants, available_quantity } = req.body;
    
    // Validate required fields
    if (!title || !description || !price || !image || !category || !variants || !available_quantity) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, description, price, image, category, variants, and available_quantity'
      });
    }
    
    // Create product
    const product = await Product.create({
      title,
      description,
      price,
      image,
      category,
      sizes: sizes || [],
      colors: colors || [],
      variants: variants || [],
      available_quantity,
      rating: 0
    });
    
    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding product',
      error: error.message
    });
  }
});

// Get all orders (Admin dashboard)
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find();
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

// Assign rider to order
router.put('/orders/:id/assign', async (req, res) => {
  try {
    const { riderId, riderName } = req.body;
    
    if (!riderId || !riderName) {
      return res.status(400).json({
        success: false,
        message: 'Rider ID and name are required'
      });
    }
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        riderId,
        riderName,
        status: 'SHIPPED'
      },
      { new: true, runValidators: true }
    );
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning rider',
      error: error.message
    });
  }
});

module.exports = router;
