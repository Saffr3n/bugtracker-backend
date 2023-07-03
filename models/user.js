const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: {
    type: String,
    required: true,
    enum: ['Admin', 'Project Manager', 'User'],
    default: 'User'
  },
  // profile_picture: { type: Buffer },
  registered: { type: Date, required: true, default: Date.now },
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }]
  // tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
  // comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
});

UserSchema.virtual('url').get(function () {
  return `/users/${this.id}`;
});

module.exports = mongoose.model('User', UserSchema);
