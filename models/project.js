const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  created: { type: Date, required: true, default: Date.now },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  // tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }]
});

ProjectSchema.virtual('url').get(function () {
  return `/projects/${this.id}`;
});

module.exports = mongoose.model('Project', ProjectSchema);
