const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  teamId: { type: String, required: true, unique: true },  // Custom teamId
  teamName: { type: String, required: true },
  teamLeader: { type: String, required: true },
  capacity: { type: Number, required: true },
  membersList: { type: [String], required: true },
  numMembers: { type: Number, required: true, default: 0 }, 
  userId: { type: String, ref: 'User', required: true }, // Reference to User as String

});

module.exports = mongoose.model('Team', TeamSchema);
