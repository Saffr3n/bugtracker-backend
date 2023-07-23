const mongoose = require('mongoose');
const Project = require('./project');
const Ticket = require('./ticket');
const Comment = require('./comment');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: {
    type: String,
    required: true,
    enum: ['Admin', 'Project Manager', 'Developer', 'User'],
    default: 'User'
  },
  // profile_picture: { type: Buffer },
  registered: { type: Date, required: true, default: Date.now },
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }]
});
UserSchema.pre('deleteOne', async function () {
  const user = await this.model
    .findOne(this.getFilter())
    .exec()
    .catch((err) => {
      throw err;
    });

  if (!user) return;

  await Project.updateMany({ manager: user.id }, { manager: null })
    .exec()
    .catch((err) => {
      throw err;
    });

  await Project.updateMany({ users: user.id }, { $pull: { users: user.id } })
    .exec()
    .catch((err) => {
      throw err;
    });

  await Ticket.updateMany({ submitter: user.id }, { submitter: null })
    .exec()
    .catch((err) => {
      throw err;
    });

  await Ticket.updateMany({ devs: user.id }, { $pull: { devs: user.id } })
    .exec()
    .catch((err) => {
      throw err;
    });

  await Comment.updateMany({ submitter: user.id }, { submitter: null })
    .exec()
    .catch((err) => {
      throw err;
    });
});

module.exports = mongoose.model('User', UserSchema);
