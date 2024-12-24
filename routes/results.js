const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken } = require('../routes/jwt');
const Results = require('../models/Results');
const Team = require('../models/Team');
const Order = require('../models/Order');
const User = require('../models/user');

const router = express.Router();

router.get('/results', authenticateToken, async (req, res) => {
  try {
    const { date, paidStatus, teamName } = req.query;
    console.log('User role:', req.user.role);
    console.log('Date filter:', date);
    console.log('Paid Status:', paidStatus);
    console.log('Team Name:', teamName);

    let filter = {};

    // Apply filters based on user role
    if (req.user.role === 'Admin') {
      if (date) {
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        filter.completionDate = { $gte: startOfDay, $lte: endOfDay };
      }
      if (teamName) {
        const team = await Team.findOne({ teamName }).select('_id');
        if (team) {
          filter.teamId = team._id;
        }
      }
    } else if (req.user.role === 'TeamLeader') {
      const teamIds = await Team.find({ teamLeader: req.user.id }).select('_id');
      filter.teamId = { $in: teamIds.map((team) => team._id) };

      if (date) {
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        filter.completionDate = { $gte: startOfDay, $lte: endOfDay };
      }
      if (teamName) {
        const team = await Team.findOne({ teamName }).select('_id');
        if (team) {
          filter.teamId = team._id;
        }
      }
    } else {
      filter.memberId = req.user.id;

      if (date) {
        const startOfDay = new Date(date);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        filter.completionDate = { $gte: startOfDay, $lte: endOfDay };
      }
    }

    // Apply paid status filter
    if (paidStatus) {
      filter.paymentStatus = paidStatus;
    }

    // Fetch results data
    let results = await Results.find(filter)
      .populate({
        path: 'orderId',
        select: 'orderId status paymentStatus link',
      })
      .populate({ path: 'teamId', select: 'teamName' })
      .populate({ path: 'memberName', select: 'name' });

    console.log('Raw results fetched from database:', results);

    // Transform results
    const transformedResults = await Promise.all(
      results.map(async (result) => {
        const team = result.teamId
          ? await Team.findById(result.teamId).select('teamName')
          : null;

        const order = result.orderId
          ? await Order.findById(result.orderId).select('orderId paymentStatus coupon')
          : null;

        return {
          resultId: result._id,
          orderId: order?.orderId || null,
          orderLink: result.orderId?.link || null,
          coupon: order?.coupon || null,
          paymentStatus: order?.paymentStatus || null,
          teamId: result.teamId || null,
          teamName: team?.teamName || null,
          memberName: result.memberName || null,
          profitBehindOrder: result.profitBehindOrder != null ? result.profitBehindOrder : null,
          membersProfit: result.membersProfit != null ? result.membersProfit : null,
          completionDate: result.completionDate || null,
        };
      })
    );

    console.log('Transformed results to be sent:', transformedResults);

    res.status(200).json(transformedResults);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});





module.exports = router;
