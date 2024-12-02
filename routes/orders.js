// routes/orders.js
const express = require('express');
const Order = require('../models/Order');
const { authenticateToken } = require('../routes/jwt'); // Assuming this is for authentication
const router = express.Router();

// Route to create a new order
router.post('/orders', authenticateToken, async (req, res) => {
    try {
        console.log('Received Data:', req.body); // Log the data sent by Postman

      const orders = Array.isArray(req.body) ? req.body : [req.body];
  
      // Check for size limit
      if (orders.length > 5000) {
        return res.status(413).json({ message: 'Payload too large. Maximum 5000 records allowed.' });
      }
  
      // Save orders
      const savedOrders = await Order.insertMany(orders);
      res.status(201).json({ message: 'Orders created successfully', orders: savedOrders });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      if (error.code === 11000) { // Duplicate key error
        return res.status(400).json({ message: 'Order ID must be unique' });
      }
      console.error(error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  

// Route to get all orders
// Route to get orders by leadIds or all orders with pagination
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, leadIds } = req.query; // Accept leadIds query parameter
    console.log(req.query)
    let query = {}; // Default to fetch all orders

    if (leadIds) {
      const leadIdsArray = leadIds.split(','); // Convert leadIds string to array
      query.orderId = { $in: leadIdsArray }; // Filter orders based on leadIds
    }

    const orders = await Order.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .exec();

    const total = await Order.countDocuments(query); // Count filtered orders
    res.status(200).json({
      data: orders,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
