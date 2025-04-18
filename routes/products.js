const express = require('express');
const Product = require('../models/Product');
const { isAuthenticated, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all products (public)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// Get product by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// Create new product (Admin only)
router.post('/', isAuthenticated, authorize('ADMIN'), async (req, res) => {
  try {
    const { title, description, price, image, category, sizes, colors, variants, available_quantity } = req.body;
    
    // Validate required fields
    if (!title || !description || !price || !image || !category || !variants) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, description, price, image, category, and variants'
      });
    }
    
    // Calculate available quantity from variants if not provided
    let totalQuantity = available_quantity;
    if (!totalQuantity) {
      totalQuantity = variants.reduce((sum, variant) => sum + variant.stock, 0);
    }
    
    const product = await Product.create({
      title,
      description,
      price,
      image,
      category,
      sizes: sizes || [],
      colors: colors || [],
      variants: variants || [],
      available_quantity: totalQuantity,
      rating: 0
    });
    
    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// Update product (Admin only)
router.put('/:id', isAuthenticated, authorize('ADMIN'), async (req, res) => {
  try {
    const { variants } = req.body;
    
    // If variants are being updated, recalculate available_quantity
    if (variants) {
      req.body.available_quantity = variants.reduce((sum, variant) => sum + variant.stock, 0);
    }
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

// Delete product (Admin only)
router.delete('/:id', isAuthenticated, authorize('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

module.exports = router;
