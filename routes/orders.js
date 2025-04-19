const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User'); // Add User model for finding riders
const { isAuthenticated, authorize } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Create order (customer only) with automatic rider assignment
router.post('/', authorize('CUSTOMER'), async (req, res) => {
  try {
    const { items, customerAddress, customerPhone, paymentMethod } = req.body;
    
    console.log('Received order with payment method:', paymentMethod);
    
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
    
    // Calculate total amount from the provided item prices
    let totalAmount = 0;
    
    for (const item of items) {
      const { productId, quantity, price } = item;
      
      // Validate product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product with ID ${productId} not found`
        });
      }
      
      // Use the price that was passed in the request (already selected variant price)
      totalAmount += price * quantity;
      
      // Update stock
      const variant = product.variants.find(v => 
        v.color === item.color && v.size === item.size
      );
      
      if (variant) {
        variant.stock -= quantity;
        product.available_quantity -= quantity;
        await product.save();
      }
    }
    
    // Find an available rider - simple round-robin selection
    // In a real implementation, you'd want more sophisticated assignment logic
    // based on rider proximity, workload, etc.
    const availableRider = await User.findOne({ role: 'RIDER' });
    
    let riderInfo = {};
    if (availableRider) {
      riderInfo = {
        riderId: availableRider._id,
        riderName: availableRider.name,
        status: 'SHIPPED' // Immediately mark as shipped since a rider is assigned
      };
    } else {
      // No rider found, keep status as PAID
      riderInfo = {
        status: 'PAID' // Default status when no rider is available
      };
    }
    
    // Create the order with all details
    const order = await Order.create({
      customerId: req.user._id,
      customerName: req.user.name,
      customerAddress,
      customerPhone,
      items: items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        color: item.color,
        size: item.size,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl
      })),
      totalAmount,
      paymentMethod: paymentMethod || 'CARD',
      ...riderInfo // Add rider info if available
    });
    
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Order creation error:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Error creating order';
    if (error.name === 'ValidationError') {
      errorMessage = Object.values(error.errors).map(err => err.message).join(', ');
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: errorMessage || error.message
    });
  }
});

// Get current user's orders (customer only)
router.get('/me', authorize('CUSTOMER'), async (req, res) => {
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

// IMPORTANT: Get orders assigned to current rider (rider only)
// This must be placed BEFORE any route with parameters like /:id
router.get('/assigned', authorize('RIDER'), async (req, res) => {
  try {
    console.log("Fetching orders for rider:", req.user._id);
    
    // Debug current user
    console.log("Current user:", {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role
    });
    
    // Find orders assigned to this rider
    const orders = await Order.find({ riderId: req.user._id });
    
    console.log(`Found ${orders.length} orders for rider ${req.user.name}`);
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error("Error in fetching assigned orders:", error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assigned orders',
      error: error.message
    });
  }
});

// Auto-assign order to a rider (admin only or system)
router.post('/auto-assign', authorize('ADMIN'), async (req, res) => {
  try {
    // Get unassigned orders
    const unassignedOrders = await Order.find({ 
      riderId: { $exists: false },
      status: 'PAID'
    });
    
    if (unassignedOrders.length === 0) {
      return res.json({
        success: true,
        message: 'No unassigned orders found',
        assigned: 0
      });
    }
    
    // Find all available riders
    const riders = await User.find({ role: 'RIDER' });
    
    if (riders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No riders available in the system'
      });
    }
    
    // Simple round-robin assignment - in real app would be more sophisticated
    let assignedCount = 0;
    for (const order of unassignedOrders) {
      // Select a rider (basic round-robin)
      const selectedRider = riders[assignedCount % riders.length];
      
      // Assign the rider
      await Order.findByIdAndUpdate(order._id, {
        riderId: selectedRider._id,
        riderName: selectedRider.name,
        status: 'SHIPPED'
      });
      
      assignedCount++;
    }
    
    res.json({
      success: true,
      message: `Successfully assigned ${assignedCount} orders to riders`,
      assigned: assignedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error auto-assigning riders',
      error: error.message
    });
  }
});

// Get all orders (admin only)
router.get('/', authorize('ADMIN'), async (req, res) => {
  try {
    console.log("Admin fetching all orders...");
    const orders = await Order.find();
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error("Error in get all orders:", error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

// Get order by ID (for customers and admins)
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Ensure only the customer who placed the order or admin can access it
    if (req.user.role !== 'ADMIN' && order.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this order'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
});

// Assign a rider to an order (admin only)
router.put('/:id/assign', authorize('ADMIN'), async (req, res) => {
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
        status: 'SHIPPED', // Automatically change status to SHIPPED when rider is assigned
        updatedAt: Date.now()
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

// Update order status - allow both ADMIN and RIDER roles
router.put('/:id/status', authorize('RIDER', 'ADMIN'), async (req, res) => {
  try {
    const { status } = req.body;
    
    // Update the valid statuses to include only the necessary ones
    const validStatuses = ['PAID', 'SHIPPED', 'DELIVERED', 'UNDELIVERED'];
    
    // Validate status
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Find the order
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Different validation based on role
    if (req.user.role === 'RIDER') {
      // Check if order is assigned to this rider
      if (order.riderId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'This order is not assigned to you'
        });
      }
    }
    
    // Add logging for debugging
    console.log(`Updating order ${req.params.id} status from ${order.status} to ${status}`);
    
    // Update the status
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    
    console.log(`Order updated successfully to status: ${updatedOrder.status}`);
    
    res.json({
      success: true,
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
});

// Admin-specific route to update any order details
router.put('/:id/admin-update', authorize('ADMIN'), async (req, res) => {
  try {
    const { status, riderId, riderName } = req.body;
    
    // Find the order
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Create update object with only provided fields
    const updateData = { updatedAt: Date.now() };
    if (status) updateData.status = status;
    if (riderId) updateData.riderId = riderId;
    if (riderName) updateData.riderName = riderName;
    
    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating order',
      error: error.message
    });
  }
});

// Unassign a rider from an order (admin only)
router.put('/:id/unassign', authorize('ADMIN'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    // Update order to remove rider and set status back to PAID
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $unset: { riderId: "", riderName: "" },
        status: 'PAID', // Reset to PAID when a rider is unassigned
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      data: updatedOrder,
      message: 'Rider unassigned successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unassigning rider',
      error: error.message
    });
  }
});

// Add this route handler for assigning random riders
router.post('/:id/assign-rider', async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Find all riders in the system
    const riders = await User.find({ role: 'RIDER' });
    if (!riders || riders.length === 0) {
      return res.status(404).json({ message: 'No riders available in the system' });
    }
    
    // Select a random rider
    const randomIndex = Math.floor(Math.random() * riders.length);
    const selectedRider = riders[randomIndex];
    
    // Update the order with the selected rider
    order.riderId = selectedRider._id;
    order.riderName = selectedRider.name;
    order.status = 'ASSIGNED'; // Update status
    
    // Save the updated order
    await order.save();
    
    // Return the updated order
    res.json(order);
  } catch (error) {
    console.error('Error assigning rider:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
