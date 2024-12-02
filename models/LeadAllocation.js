const mongoose = require('mongoose');

const LeadAllocationSchema = new mongoose.Schema({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  leadIds: {
    type: [String], // Lead/Order IDs allocated to the member
    required: true,
  },
  allocatedTime: {
    type: String, // Time of allocation
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Pending',
  },
});

module.exports = mongoose.model('LeadAllocation', LeadAllocationSchema);
