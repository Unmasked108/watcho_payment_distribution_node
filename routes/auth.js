const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const router = express.Router();
const jwt=require("jsonwebtoken");
const { authenticateToken } = require('./jwt');

JWT_SECRET="679992956"
const tokenBlacklist = new Set();




  
// Register
router.post('/register', async (req, res) => {
  const { name, email, mobile, password } = req.body;
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const user = new User({
      name,
      email,
      mobile,
      password: await bcrypt.hash(password, 10),
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error', error: err });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
      // Find the user by email
      const user = await User.findOne({ email: email });
      
      if (!user) {
          // User not found
          return res.status(401).json({ message: "User not found. Please check your email." });
      }

      // Check if the password matches
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
          return res.status(401).json({ message: "Password is Incorrect" });
      }

      // Generate JWT token
      const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET);
      
      // Send success response
      res.status(200).json({
          token,
          id: user._id,
          role: user.role,
          username: user.name, // Include username in the response
          msg: "User login successfully"
      });
  } catch (err) {
      // Handle any unexpected errors
      res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});


router.post('/logout',authenticateToken, (req, res) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(400).send('Authorization header missing');
    }
  
    const token = req.headers.authorization.split(' ')[1];
    
    tokenBlacklist.add(token);
    
    
    res.status(200).send('Logged out successfully');
  });
module.exports = router;
