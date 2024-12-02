const express = require('express');
const LeadAllocation = require('../models/LeadAllocation');
const Team = require('../models/Team'); // Import the Team model
const router = express.Router();
const { authenticateToken } = require('../routes/jwt'); // Assuming this is for authentication

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

    // Use the MongoDB teamId
    const allocations = selectedMembers.map((member) => ({
      teamId: team._id, // Use the MongoDB-provided teamId
      memberId: member.id,
      leadIds: member.orderIds,
      allocatedTime: member.time,
      status: member.status,
    }));

    // Insert allocations into the database
    await LeadAllocation.insertMany(allocations);

    res.status(201).json({ message: 'Allocations saved successfully.' });
  } catch (err) {
    console.error('Error saving lead allocations:', err);
    res.status(500).json({ error: 'Failed to save lead allocations.' });
  }
});

module.exports = router;

// GET: Fetch allocations for a team
// GET: Fetch allocations for a team or a specific member
router.get('/lead-allocations', authenticateToken, async (req, res) => {
    try {
      const { teamId, date } = req.query;

        // Ensure req.user exists and has an `id` property
        const memberId = req.user && req.user.id;
        console.log("Received query:", req.query);
        console.log("Authenticated user ID:", memberId);

        // Ensure at least one of teamId or memberId is provided
        if (!teamId && !memberId) {
            return res.status(400).json({ error: 'Team ID or Member ID is required.' });
        }

        let query = {}; // Initialize the query object

        // Add teamId filter if provided
        if (teamId) {
            query.teamId = teamId;
        }

        // Add memberId filter if provided
        if (memberId) {
            query.memberId = memberId;
        }

        if (date) {
          query.allocatedTime = { $gte: new Date(date), $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)) };
        }

        console.log("Constructed query:", query);

        // Fetch allocations based on the constructed query
 const allocations = await LeadAllocation.find(query)
      .populate('memberId', 'name') // Populate the member name field
      .exec();
              console.log("Allocations found:", allocations);

        res.status(200).json(allocations);
    } catch (err) {
        console.error('Error fetching lead allocations:', err);
        res.status(500).json({ error: 'Failed to fetch lead allocations.' });
    }
});


module.exports = router;