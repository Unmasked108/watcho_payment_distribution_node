const express = require('express');
const LeadAllocation = require('../models/LeadAllocation');
const Team = require('../models/Team'); // Import the Team model
const router = express.Router();
const { authenticateToken } = require('../routes/jwt'); // Assuming this is for authentication
const User = require('../models/user');
const Results = require('../models/Results');
const Order = require('../models/Order');

// POST: Save lead allocations
router.post('/lead-allocations', async (req, res) => {
  try {
    const { selectedMembers } = req.body;

    console.log('Request body:', req.body);

    if (!selectedMembers || selectedMembers.length === 0) {
      return res.status(400).json({ error: 'No members selected for allocation.' });
    }

    // Fetch the team from the database using the provided teamId
    const team = await Team.findOne({ teamId: selectedMembers[0].teamId });

    if (!team) {
      return res.status(404).json({ error: 'Team not found.' });
    }

       // Fetch already allocated leads for this team
       const existingAllocations = await LeadAllocation.find({ teamId: team._id });
       const allocatedLeadIds = new Set(
         existingAllocations.flatMap((allocation) => allocation.leadIds)
       );
   
       // Filter out already allocated leads
       const allocations = selectedMembers.map((member) => {
         const unallocatedLeads = member.orderIds.filter(
           (orderId) => !allocatedLeadIds.has(orderId) // Check against allocated leads
         );
   
         return {
           teamId: team._id,
           memberId: member.id,
           leadIds: unallocatedLeads, // Only allocate unallocated leads
           allocatedTime: member.time,
           date: new Date(),
           status: member.status,
         };
       });
   

    // Insert allocations into the database
    await LeadAllocation.insertMany(allocations);

      // Save all leads in the Results collection
    // Compare and map with existing Results data
const results = [];
for (const allocation of allocations) {
  for (const leadId of allocation.leadIds) {
    const member = await User.findById(allocation.memberId); // Fetch member details
    const order = await Order.findById(leadId); // Fetch order details

    if (!order) {
      console.warn(`Order with ID ${leadId} not found.`);
      continue; // Skip if order is not found
    }

    const orderType = order.coupon ? 149 : 299; // Check coupon value

    // Check if the order already exists in the Results schema
    const existingResult = await Results.findOne({ orderId: leadId });

    if (existingResult) {
      // Update existing result
      existingResult.teamId = team._id;
      existingResult.memberName = member.name;
      existingResult.completionDate = allocation.date; // Update completion date
      existingResult.orderType = orderType; // Update orderType
      await existingResult.save();

      console.log(`Updated existing result for order ID: ${leadId}`);
    } else {
      // Create a new result if it doesn't exist
      results.push({
        orderId: leadId,
        teamId: team._id,
        teamName: team.teamName,
        memberId: allocation.memberId,
        memberName: member.name,
        paymentStatus: 'Unpaid',
        orderType, // Save orderType based on coupon
        completionDate: allocation.date, // Use the same date as LeadAllocation
      });
    }
  }
}

// Batch save all new results
if (results.length > 0) {
  await Results.insertMany(results);
}

console.log('Results saved:', results);

    res.status(201).json({ message: 'Allocations saved successfully.' });
  } catch (err) {
    console.error('Error saving lead allocations:', err);
    res.status(500).json({ error: 'Failed to save lead allocations.' });
  }
});  

router.post('/orders-allocated', async (req, res) => {
  try {
    const { teamId, date } = req.body;

    // Validate teamId
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'teamId is required.',
      });
    }

    // Default date to today if not provided
    const today = new Date();
    const queryDate = date ? new Date(date) : new Date(today.toISOString().split('T')[0]);

    // Create two separate Date objects for start and end of the day
    const startOfDay = new Date(queryDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(queryDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Query the database
    const count = await LeadAllocation.countDocuments({
      teamId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });
    console.log(count)

    res.status(200).json({
      success: true,
      count,
      message: `Total orders allocated for team ${teamId} on ${queryDate.toDateString()}`,
    });
  } catch (error) {
    console.error('Error fetching orders allocated:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching orders allocated.',
    });
  }
});




// GET: Fetch allocations for a team
// GET: Fetch allocations for a team or a specific member
const moment = require('moment'); // Ensure you have moment.js installed
router.get('/lead-allocations', authenticateToken, async (req, res) => {
  try {
    const { teamId, date } = req.query;
    const memberId = req.user && req.user.id;

    console.log("Received query:", req.query);
    console.log("Authenticated user ID:", memberId);

    if (!teamId && !memberId) {
      return res.status(400).json({ error: 'Team ID or Member ID is required.' });
    }

    let query = {};

    if (teamId) {
      query.teamId = teamId;
    }

    if (memberId) {
      query.memberId = memberId;
    }

    let searchDate, nextDay;

    // Handle date filtering
    if (date) {
      searchDate = moment(date, 'YYYY-MM-DD').startOf('day'); // Parse and normalize to start of the day
      nextDay = moment(searchDate).add(1, 'day'); // Add one day
    } else {
      // Default to current date if no date is provided
      const now = moment();
      searchDate = now.startOf('day');
      nextDay = moment(searchDate).add(1, 'day');
    }

    query.date = {
      $gte: searchDate.toDate(), // Greater than or equal to start of the day
      $lt: nextDay.toDate(), // Less than the start of the next day
    };

    console.log("Constructed query:", query);

    const allocations = await LeadAllocation.find(query)
      .populate('memberId', 'name')
      .exec();

    console.log("Allocations found:", allocations);

    res.status(200).json(allocations);
  } catch (err) {
    console.error('Error fetching lead allocations:', err);
    res.status(500).json({ error: 'Failed to fetch lead allocations.' });
  }
});



module.exports = router;