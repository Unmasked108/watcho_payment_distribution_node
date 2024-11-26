const express = require('express');
const Team = require('../models/Team'); // Import the Team model
const router = express.Router();
const { authenticateToken } = require('../routes/jwt');

// Route to create a new team
router.post('/teams', authenticateToken,async (req, res) => {
  try {
    const { teamId, teamName, teamLeader, capacity, membersList } = req.body;

    if (!teamId || !teamName || !teamLeader || !capacity || !membersList) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const numMembers = membersList.length;

    const newTeam = new Team({
      teamId,
      teamName,
      teamLeader,
      capacity,
      membersList,
      numMembers,
      userId: req.user.id, // Use userId from token

    });

    await newTeam.save();
    res.status(201).json({ message: 'Team created successfully', team: newTeam });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Route to get all teams
// Route to get a specific team by MongoDB _id
router.get('/teams',authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      // Admin can fetch all teams
      const teams = await Team.find();
      res.status(200).json(teams);
    } else {
      // Regular user can fetch only their own teams
      const userId = req.user.id;
      const teams = await Team.find({ userId });
      res.status(200).json(teams);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Route to update a team's details
// Route to update a team's details
router.put('/teams/:id', async (req, res) => {
  try {
    const teamId = req.params.id; // MongoDB _id
    const { teamName, teamLeader, capacity, membersList } = req.body;

    if (!teamName || !teamLeader || !capacity || !membersList) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      {
        teamName,
        teamLeader,
        capacity,
        membersList,
        numMembers: membersList.length, // Update numMembers automatically
      },
      { new: true } // Return the updated document
    );

    if (!updatedTeam) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.status(200).json({ message: 'Team updated successfully', team: updatedTeam });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
