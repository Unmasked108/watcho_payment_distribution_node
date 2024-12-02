const mongoose = require('mongoose');

const AllocationSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: false }, // Can be null if not allocated
  orderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }], // List of allocated order IDs
  status: { type: String, enum: ['Allocated', 'Success', 'Pending'], default: 'Allocated' }, // Status of allocation
  allocationDate: { type: Date, default: Date.now }, // Date of allocation
});

module.exports = mongoose.model('Allocation', AllocationSchema);
