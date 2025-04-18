const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { isAuthenticated, authorize } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(isAuthenticated, authorize('CUSTOMER'));

// Create order (Customer only endpoint)
router.post('/order', async (req, res) => {
  try {
    const { items, customerAddress, customerPhone } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    if (!customerAddress || !customerPhone) {
      return res.status(400).json({
        success: false,
        message: 'Customer address and phone are required'
      });
    }
    
    // Calculate total amount and validate products
    let totalAmount = 0;
    const processedItems = [];
    
    for (const item of items) {
      const { productId, color, size, quantity } = item;
      
      // Validate product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product with ID ${productId} not found`
        });
      }
      
      // Find the variant
      const variant = product.variants.find(v => 
        v.color === color && v.size === size
      );
      
      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Variant with color ${color} and size ${size} not found for product ${product.title}`
        });
      }
      
      // Check stock
      if (variant.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${product.title} in ${color}, ${size}`
        });
      }
      
      // Add to processed items
      processedItems.push({
        productId,
        productName: product.title,
        color,
        size,
        price: variant.price,
        quantity
      });
      
      // Add to total
      totalAmount += variant.price * quantity;
      
      // Update stock
      variant.stock -= quantity;
      product.available_quantity -= quantity;
      await product.save();
    }
    
    // Create the order
    const order = await Order.create({
      customerId: req.user._id,
      customerName: req.user.name,
      customerAddress,
      customerPhone,
      items: processedItems,
      totalAmount,
      status: 'PAID'
    });
    
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
});

// Get customer's orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.user._id });
    
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

module.exports = router;
