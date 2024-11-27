const express = require('express');
const Team = require('../models/Team'); // Import the Team model
const router = express.Router();
const { authenticateToken } = require('../routes/jwt');
const User = require('../models/user'); // Import the User model

// Route to create a new team
router.post('/teams', authenticateToken, async (req, res) => {
  try {
    const { teamId, teamName, teamLeaderEmail, capacity, memberEmails } = req.body;
    console.log(req.body)
    // Debugging logs
    console.log("Received fields:");
    console.log("teamId:", teamId);
    console.log("teamName:", teamName);
    console.log("teamLeaderEmail:", teamLeaderEmail);
    console.log("capacity:", capacity);
    console.log("memberEmails:", memberEmails);

    // Check for missing fields
    if (!teamId || !teamName || !teamLeaderEmail || !capacity || !memberEmails) {
      return res.status(400).json({ 
        message: 'All fields are required',
        missingFields: {
          teamId: !!teamId,
          teamName: !!teamName,
          teamLeaderEmail: !!teamLeaderEmail,
          capacity: !!capacity,
          memberEmails: !!memberEmails,
        },
      });
    }


    // Resolve Team Leader email to userId
    const teamLeader = await User.findOne({ email: teamLeaderEmail, role: 'TeamLeader' });
    if (!teamLeader) {
      return res.status(400).json({ message: 'Invalid team leader email or role.' });
    }

    // Resolve Member emails to userIds
    const members = await User.find({ email: { $in: memberEmails }, role: 'Member' });
    if (members.length !== memberEmails.length) {
      return res.status(400).json({ message: 'One or more member emails are invalid.' });
    }

    const membersList = members.map(member => member._id);

    const numMembers = membersList.length;

    // Create the team
    const newTeam = new Team({
      teamId,
      teamName,
      teamLeaderEmail,  // Add the teamLeaderEmail field here

      teamLeader: teamLeader._id, // Use userId of the team leader
      capacity,
      membersList,
      numMembers,
      userId: req.user.id, // Use userId from token
    });
    console.log('User ID from token:', req.user.id);

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
    const { teamName, teamLeaderEmail, capacity, memberEmails } = req.body;
    console.log('Received payload:', req.body);


    if (!teamName || !teamLeaderEmail || !capacity || !memberEmails) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Resolve Team Leader email to userId
    const teamLeader = await User.findOne({ email: teamLeaderEmail, role: 'TeamLeader' });
    if (!teamLeader) {
      return res.status(400).json({ message: 'Invalid team leader email or role.' });
    }

    // Resolve Member emails to userIds
    const members = await User.find({ email: { $in: memberEmails }, role: 'Member' });
    if (members.length !== memberEmails.length) {
      return res.status(400).json({ message: 'One or more member emails are invalid.' });
    }

    const membersList = members.map(member => member._id);

    // Update the team
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      {
        teamName,
        teamLeader: teamLeader._id,
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
