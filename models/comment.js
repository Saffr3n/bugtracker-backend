const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  created: { type: Date, required: true, default: Date.now },
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  submitter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

CommentSchema.virtual('url').get(function () {
  return `/comments/${this.id}`;
});

module.exports = mongoose.model('Comment', CommentSchema);
