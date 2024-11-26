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

    console.log('User role:', req.user.role);


    if (req.user.role === 'admin') {
      // Admin can fetch all teams
      const teams = await Team.find();
      res.status(200).json(teams);
      console.log("teams:" ,teams)
      
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
router.put('/teams/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id;
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
        numMembers: membersList.length,
      },
      { new: true }
    );

    if (!updatedTeam) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.status(200).json({ message: 'Team updated successfully', team: updatedTeam });
  } catch (error) {
    console.error(error); // Log the error
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route to delete a team
router.delete('/teams/:id', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.id; // MongoDB custom teamId
    console.log('Team ID:', teamId);
    
    // Use teamId for querying the team document
    const deletedTeam = await Team.findOneAndDelete({ teamId: teamId });
    console.log('Deleting team with teamId:', teamId);

    if (!deletedTeam) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.status(200).json({ message: 'Team deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;
