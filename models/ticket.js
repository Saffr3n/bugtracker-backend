const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: Boolean, required: true, default: true },
  created: { type: Date, required: true, default: Date.now },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  submitter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  devs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
});

TicketSchema.virtual('url').get(function () {
  return `/tickets/${this.id}`;
});

module.exports = mongoose.model('Ticket', TicketSchema);
