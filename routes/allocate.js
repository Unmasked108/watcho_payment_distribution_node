const express = require('express');
const Order = require('../models/Order');
const Team = require('../models/Team');
const Allocation = require('../models/Allocation');
const { authenticateToken } = require('../routes/jwt'); // Authentication middleware
const router = express.Router();
const moment = require('moment'); // For date manipulation
const mongoose = require('mongoose');

// Route to allocate orders and store allocation data
router.post('/allocate-orders', authenticateToken, async (req, res) => {
    try {
    //   const orders = await Order.find({ status: 'Pending' });
      const orders = await Order.find();  // Comment out status filter for testing

      const teams = await Team.find();
  
      let orderIndex = 0;
      const unallocatedOrders = [];
  
      // Sort teams by capacity
      teams.sort((a, b) => (b.capacity || 0) - (a.capacity || 0));
  
      const allocations = [];
      teams.forEach(team => {
        const allocatedOrders = [];
        let remainingCapacity = team.capacity || 0;
  
        console.log(`Allocating orders to team: ${team.teamName}, Capacity: ${remainingCapacity}`);
  
        while (remainingCapacity > 0 && orderIndex < orders.length) {
          const currentOrder = orders[orderIndex];
          
          // Allocate the order to this team
          allocatedOrders.push(currentOrder._id);
          currentOrder.status = 'Allocated'; // Mark order as allocated
          currentOrder.teamId = team._id; // Assign the team to the order
          
          console.log(`Allocated order ID: ${currentOrder.orderId} to team: ${team.teamName}`);
          
          remainingCapacity--; // Decrease remaining capacity
          orderIndex++; // Move to the next order
        }
  
        // Create allocation record for the team if there are allocated orders
        if (allocatedOrders.length > 0) {
          allocations.push({
            teamId: team._id,
            orderIds: allocatedOrders,
            status: 'Allocated',
            allocationDate: new Date(),
          });
        }
  
        // Log allocated orders for debugging
        console.log(`Allocated Orders for Team ${team.teamName}:`, allocatedOrders);
      });
  
      // Track unallocated orders (orders that couldn't be allocated)
      for (let i = orderIndex; i < orders.length; i++) {
        unallocatedOrders.push(orders[i]._id);
        orders[i].status = 'Pending'; // Still pending
      }
  
      // Save allocations to the database
      await Allocation.insertMany(allocations);
  
      // Save unallocated orders (if any)
      if (unallocatedOrders.length > 0) {
        await Allocation.create({
          teamId: null, // No team allocated
          orderIds: unallocatedOrders,
          status: 'Pending',
          allocationDate: new Date(),
        });
      }
  
      // Update orders in the database
      await Promise.all(orders.map(order => order.save()));
  
      res.status(200).json({
        message: 'Orders allocated successfully',
        allocations,
      });
  
      // Logging allocations to verify
      console.log('Final Allocations:', allocations);
    } catch (error) {
      console.error('Error allocating orders:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });
  

// Route to get all allocations
// Route to get allocation data

router.get('/allocate-orders', authenticateToken, async (req, res) => {
  try {
    const { teamId } = req.query;

    console.log('Incoming request to /allocate-orders');
    console.log('Query parameters:', req.query);

    // Validate teamId format
    if (teamId && !mongoose.Types.ObjectId.isValid(teamId)) {
      console.error('Invalid teamId format:', teamId);
      return res.status(400).json({ message: 'Invalid teamId format' });
    }

    const query = teamId ? { teamId } : {}; // Filter by teamId if provided

    console.log('MongoDB query:', query);

    const allocations = await Allocation.find(query)
      .populate('teamId')
      .populate('orderIds')
      .exec();

    console.log('Allocations fetched:', allocations);

    res.status(200).json(allocations);
  } catch (error) {
    console.error('Error fetching allocations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

  
router.get('/history-data', authenticateToken, async (req, res) => {
    try {
        const { date } = req.query;

        // Validate and parse the date
        if (!date) {
            return res.status(400).json({ message: 'Date query parameter is required.' });
        }
        const searchDate = moment(date, 'YYYY-MM-DD').startOf('day');
        const nextDay = moment(searchDate).add(1, 'day');

        // Fetch allocations for the requested date
        const allocations = await Allocation.find({
            allocationDate: {
                $gte: searchDate.toDate(),
                $lt: nextDay.toDate(),
            },
        })
            .populate('teamId')
            .populate('orderIds')
            .exec();

        // Combine data
        const combinedData = allocations.map(allocation => {
            return allocation.orderIds.map(order => ({
                orderId: order.orderId,
                assignedTeams: allocation.teamId ? allocation.teamId.teamName : 'Unassigned',
                allocatedDate: allocation.allocationDate,
                completionDate: order.updatedAt ? order.updatedAt : null, // Set to null initially
                completionStatus: order.status,
            }));
        }).flat();

        res.status(200).json(combinedData);
    } catch (error) {
        console.error('Error fetching history data:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}); 
  

module.exports = router;
