const express = require('express');
const Team = require('../models/Team'); // Import the Team model
const router = express.Router();
const { authenticateToken } = require('../routes/jwt');
const User = require('../models/user'); // Import the User model

// Route to create a new team
router.post('/teams', authenticateToken, async (req, res) => {
  try {
    const { teamId, teamName, teamLeaderEmail, capacity, memberEmails } = req.body;

    // Debugging logs
    console.log("Received fields:", { teamId, teamName, teamLeaderEmail, capacity, memberEmails });

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

    // Map members to include both ID and name
    const membersList = members.map(member => ({
      userId: member._id,
      name: member.name,
    }));

    const numMembers = membersList.length;

    // Create the team
    const newTeam = new Team({
      teamId,
      teamName,
      teamLeaderEmail,
      teamLeader: teamLeader._id, // Use userId of the team leader
      capacity,
      memberEmails, // Include memberEmails in the newTeam object

      membersList, // Save the membersList with userId and name
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
// Route to get all teams
// Route to get all teams
router.get('/teams', authenticateToken, async (req, res) => {
  try {
    console.log('User role:', req.user.role);

    let teams;

    if (req.user.role === 'admin') {
      // Admin can fetch all teams
      teams = await Team.find().populate({
        path: 'membersList.userId', // Populate userId to get member details
        select: 'name', // Include only the name field
      });
    } else if (req.user.role === 'TeamLeader') {
      teams = await Team.find({ teamLeader: req.user.id })
        .populate({
          path: 'membersList.userId',
          select: '_id name',
        })
        .populate({
          path: 'teamLeader',
          select: 'name', // Include the Team Leader's name
        });
    } else {
      // Regular user can fetch only their own teams
      const userId = req.user.id;
      teams = await Team.find({ userId }).populate({
        path: 'membersList.userId',
        select: 'name',
      });
    }

    // Transform the populated data to include the member names
    teams = teams.map(team => {
      const membersList = team.membersList.map(member => ({
        userId: member.userId._id, // Keep userId
        name: member.userId.name, // Include the member name
      }));
      return {
        ...team.toObject(),
        membersList,
        teamLeaderName: team.teamLeader?.name || 'Unknown Leader', // Add teamLeaderName
      };
    });

    res.status(200).json(teams);
    console.log("teams:", teams);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});




// Route to update a team's details
// Route to update a team's details
// Route to update a team's details
router.put('/teams/:teamId', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.teamId;  // The frontend teamId
    const { teamName, teamLeaderEmail, capacity, memberEmails } = req.body;

    console.log('Received payload:', req.body);

    // Check for missing fields
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

    // Map members to include userId and name
    const membersList = members.map(member => ({
      userId: member._id,
      name: member.name,
    }));

    // Find the team by frontend teamId, not MongoDB _id
    const team = await Team.findOne({ teamId: teamId });

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Update the team
    team.teamName = teamName;
    team.teamLeader = teamLeader._id;
    team.capacity = capacity;
    team.membersList = membersList;
    team.numMembers = membersList.length;

    // Save the updated team to the database
    await team.save();

    // Populate the updated team with member names
    const populatedTeam = await Team.findOne({ teamId: teamId }).populate({
      path: 'membersList.userId',
      select: 'name',
    });

    // Transform the populated data
    const responseTeam = {
      ...populatedTeam.toObject(),
      membersList: populatedTeam.membersList.map(member => ({
        userId: member.userId._id,
        name: member.userId.name,
      })),
    };

    res.status(200).json({ message: 'Team updated successfully', team: responseTeam });
  } catch (error) {
    console.error(error); // Log the error
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/teams/:teamId', authenticateToken, async (req, res) => {
  try {
    const teamId = req.params.teamId;  // The frontend teamId
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
