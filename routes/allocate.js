const express = require('express');
const Order = require('../models/Order');
const Team = require('../models/Team');
const Allocation = require('../models/Allocation');
const { authenticateToken } = require('../routes/jwt'); // Authentication middleware
const router = express.Router();
const moment = require('moment'); // For date manipulation
const mongoose = require('mongoose');
const LeadAllocation = require('../models/LeadAllocation');
const Result = require('../models/Results');
// Route to allocate orders and store allocation data
router.post('/allocate-orders', authenticateToken, async (req, res) => {
  try {
    const { allocationDate,allocations } = req.body;

console.log("Teams 6to be allocated" , req.body)

if (!allocationDate || !allocations || allocations.length === 0) {
  return res.status(400).json({ message: 'allocationDate and allocations are required' });
}
// Declare and initialize teamIds
const teamIds = allocations.map((allocation) => allocation.teamId);

    const parsedAllocationDate = new Date(allocationDate);
    if (isNaN(parsedAllocationDate)) {
      return res.status(400).json({ message: 'Invalid allocationDate format' });
    }

    const allocationDateStart = new Date(parsedAllocationDate);
    allocationDateStart.setUTCHours(0, 0, 0, 0);

    console.log('Normalized allocation start date:', allocationDateStart);


    // Process each allocation
    for (const allocation of allocations) {
      const { teamId, orders, amount } = allocation;

      const team = await Team.findOne({ teamId });
      if (!team) {
        return res.status(404).json({ message: `Team with ID ${teamId} not found` });
      }

      // Update payment received
      team.paymentRecieved = (team.paymentRecieved || 0) + amount;
      await team.save();

      // Allocate orders (dummy logic)
      console.log(`Allocated ${orders} orders to team ${team.teamName}`);
    }

    // Resolve teamIds to ObjectIds
    const teams = await Team.find({ teamId: { $in: teamIds } });
    const teamObjectIds = teams.map((team) => team._id);

    if (teamObjectIds.length === 0) {
      return res.status(400).json({ message: 'No valid teams found for allocation.' });
    }

    console.log('Resolved team ObjectIds:', teamObjectIds);


    // Fetch already allocated order IDs for the current date
    const allocatedOrderIds = await Allocation.aggregate([
      { $match: { allocationDate: allocationDateStart } },
      { $unwind: '$orderIds' },
      { $group: { _id: null, allocatedIds: { $addToSet: '$orderIds' } } },
    ]).then(result => (result[0]?.allocatedIds || []));

    console.log('Already allocated order IDs for date:', allocationDateStart, allocatedOrderIds);

    // Fetch pending orders for reallocation
    const pendingOrders = await Allocation.findOne({
      allocationDate: allocationDateStart,
      status: 'Pending',
    });

    const pendingOrderIds = pendingOrders ? pendingOrders.orderIds : [];
    console.log('Pending orders for reallocation:', pendingOrderIds);

    // Combine already allocated and pending orders
    const excludedOrderIds = [...allocatedOrderIds, ...pendingOrderIds];

    // Fetch eligible orders for allocation
    const orders = await Order.find({
      _id: { $nin: excludedOrderIds },
      state: 'new', // Only consider orders in "new" state
      createdAt: { $gte: allocationDateStart, $lt: new Date(allocationDateStart).setUTCHours(23, 59, 59, 999) },
    });

    console.log('Orders eligible for allocation:', orders);

    if (orders.length === 0 && pendingOrderIds.length === 0) {
      return res.status(200).json({
        message: 'All leads are already allocated, and no pending orders are available for reallocation.',
      });
    }

    // const teams = await Team.find();
    const teamAllocations = await Allocation.aggregate([
      { $match: { allocationDate: allocationDateStart } }, // Only today's allocations
      { $group: { _id: '$teamId', count: { $sum: { $size: '$orderIds' } } } },
    ]).then(results =>
      results.reduce((acc, cur) => {
        acc[cur._id] = cur.count;
        return acc;
      }, {})
    );

    console.log('Current team allocations:', teamAllocations);

    let orderIndex = 0;
    const unallocatedOrders = [];
    const newAllocations = [];

    // Allocate both eligible and pending orders
    const allOrdersToAllocate = [...orders, ...pendingOrderIds.map(id => ({ _id: id }))];
    let orderPromises = []; // Declare and initialize orderPromises

    teams.forEach(team => {
      const allocatedOrders = [];
      const currentAllocation = teamAllocations[team._id?.toString()] || 0; // Current allocation for the team
      let remainingCapacity = (team.capacity || 0) - currentAllocation;

  // Find the allocation entry for this team
  const allocationEntry = allocations.find(a => a.teamId === team.teamId);
  const specifiedAllocation = allocationEntry?.orders || 0;

      console.log(
        `Allocating orders to team: ${team.teamName}, Remaining Capacity: ${remainingCapacity}`
      );
        // Only allocate up to the specified amount
  let ordersToAllocate = Math.min(remainingCapacity, specifiedAllocation);
  while (ordersToAllocate > 0 && orderIndex < allOrdersToAllocate.length) {
    const currentOrder = allOrdersToAllocate[orderIndex];

    allocatedOrders.push(currentOrder._id);
    // Persist the state change directly in the database
    orderPromises.push(
      Order.updateOne(
        { _id: currentOrder._id },
        { $set: { state: 'old', teamId: team._id } }
      )
    );

    console.log(`Allocated order ID: ${currentOrder._id} to team: ${team.teamName}`);

    ordersToAllocate--;
    remainingCapacity--;
    orderIndex++;
  }

      // Create allocation record for the team if there are allocated orders
      if (allocatedOrders.length > 0) {
        const allocationEntry = allocations.find(a => a.teamId === team.teamId);
  const paymentGivenToday = allocationEntry?.amount || 0; // Get payment amount for this allocation

  newAllocations.push({
    teamId: team._id,
    orderIds: allocatedOrders,
    status: 'Allocated',
    allocationDate: allocationDateStart,
    PaymentGivenToday: paymentGivenToday, // Add payment field
  });
  
      }
    });

// Wait for all the promises to resolve
await Promise.all(orderPromises);

    // Track unallocated orders
    for (let i = orderIndex; i < allOrdersToAllocate.length; i++) {
      unallocatedOrders.push(allOrdersToAllocate[i]._id);
    }

    console.log('Unallocated orders due to full team capacity:', unallocatedOrders);

    // Save unallocated orders (set to Pending)
    if (unallocatedOrders.length > 0) {
      if (pendingOrders) {
        pendingOrders.orderIds = unallocatedOrders;
        await pendingOrders.save();
      } else {
        await Allocation.create({
          teamId: null,
          orderIds: unallocatedOrders,
          status: 'Pending',
          allocationDate: allocationDateStart,
        });
      }
    }

    // Save new allocations
    if (newAllocations.length > 0) {
      await Allocation.insertMany(newAllocations);
    }

    // Update orders in the database
    await Promise.all(orders.map(order => order.save()));

    res.status(200).json({
      message: 'Orders allocated successfully',
      allocations: newAllocations,
      pendingOrders: unallocatedOrders,
    });

    console.log('Final Allocations:', newAllocations);
  } catch (error) {
    console.error('Error allocating orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




router.post('/unallocate', authenticateToken, async (req, res) => {
  try {
    const { teamId, allocationDate } = req.body;

    console.log('Unallocate Request:', req.body);

    // Validate request data
    if (!teamId || !allocationDate) {
      return res.status(400).json({ message: 'Team ID and allocation date are required' });
    }

    // Resolve teamId to ObjectId
    const team = await Team.findOne({ teamId });
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const resolvedTeamId = team._id; // Use ObjectId for further queries

    const date = new Date(allocationDate);

    // Remove from Allocation
    const allocation = await Allocation.findOneAndDelete({
      teamId: resolvedTeamId, // Use ObjectId
      allocationDate: {
        $gte: new Date(date.setHours(0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59)),
      },
    });

    if (allocation) {
      const orderIds = allocation.orderIds;

      // Remove from Lead Allocation
      await LeadAllocation.deleteMany({ teamId: resolvedTeamId, leadIds: { $in: orderIds } });

      // Remove from Results
      await Result.deleteMany({ orderId: { $in: orderIds } });

      // Update orders to reset state
      await Order.updateMany(
        { _id: { $in: orderIds } },
        { $set: { state: 'new', status: 'Pending' } }
      );

      return res.status(200).json({ message: 'Orders unallocated successfully' });
    } else {
      return res.status(404).json({ message: 'No allocation found for the specified date and team' });
    }
  } catch (err) {
    console.error('Error during unallocation:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
});

// Route to get all allocations
// Route to get allocation data
// Route to get allocation data// Route to get allocation data
router.get('/allocate-orders', authenticateToken, async (req, res) => {
  try {
    const { teamId, startDate, endDate } = req.query;

    console.log('Incoming request to /allocate-orders');
    console.log('Query parameters:', req.query);

    // Validate teamId format
    if (teamId && !mongoose.Types.ObjectId.isValid(teamId)) {
      console.error('Invalid teamId format:', teamId);
      return res.status(400).json({ message: 'Invalid teamId format' });
    }

    // Handle startDate and endDate
    let startOfDay, endOfDay;

    if (startDate && endDate) {
      // If startDate and endDate are provided in the query, use them
      startOfDay = new Date(startDate);
      endOfDay = new Date(endDate);
    } else {
      // If no date range is provided, default to today
      const now = new Date();
      startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0); // Set to start of the day (00:00:00)

      endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999); // Set to end of the day (23:59:59)
    }

    // Convert startOfDay and endOfDay to UTC to avoid time zone issues
    startOfDay = new Date(Date.UTC(startOfDay.getFullYear(), startOfDay.getMonth(), startOfDay.getDate(), 0, 0, 0));
    endOfDay = new Date(Date.UTC(endOfDay.getFullYear(), endOfDay.getMonth(), endOfDay.getDate(), 23, 59, 59, 999));

    // Build the query
    const query = {
      allocationDate: { $gte: startOfDay, $lte: endOfDay },
      teamId: { $ne: null }, // Exclude records with no teamId (Pending allocations)
      ...(teamId && { teamId }), // Add teamId to query if provided
    };

    console.log('MongoDB query:', query);

    // Fetch allocations and populate team and order details
    const allocations = await Allocation.find(query)
      .populate('teamId', 'teamId teamName') // Include `teamId` and `teamName` in the populated data
      .populate('orderIds') // Populating the orders allocated to the team
      .exec();

    console.log('Allocations fetched:', allocations);

    // Add calculated fields for leadsAllocated and leadsCompleted
    const result = allocations.map((allocation) => {
      const orderIds = allocation.orderIds;

      // Assuming orderIds is populated and contains an array of order objects
      const leadsAllocated = orderIds.length;
      const leadsCompleted = orderIds.filter(order => order.paymentStatus === 'Paid').length;

      return {
        ...allocation.toObject(),
        leadsAllocated, // Add the allocated leads count
        leadsCompleted, // Add the completed leads count
      };
    });

    // Send the modified allocations with the additional counts
    res.status(200).json(result);
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
