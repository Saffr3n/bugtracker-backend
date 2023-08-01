const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Project Manager', 'Developer', 'User'], default: 'User' },
  // profile_picture: { type: Buffer },
  projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  registered: { type: Date, default: Date.now }
});
UserSchema.pre('deleteOne', { document: true, query: false }, async function () {
  const user = await this.populate('projects tickets comments').catch((err) => {
    throw err;
  });
  const { projects, tickets, comments } = user;

  const promises = [];
  promises.push(
    ...projects.map((project) => {
      const updateOpts = { $pull: { users: user.id } };
      const managerId = project.manager.toString();
      if (managerId === user.id) updateOpts.manager = null;
      return project.updateOne(updateOpts).exec();
    }),
    ...tickets.map((ticket) => {
      const updateOpts = { $pull: { devs: user.id } };
      const submitterId = ticket.submitter.toString();
      if (submitterId === user.id) updateOpts.submitter = null;
      return ticket.updateOne(updateOpts).exec();
    }),
    ...comments.map((comment) => comment.updateOne({ submitter: null }).exec())
  );

  await Promise.all(promises).catch((err) => {
    throw err;
  });
});

module.exports = mongoose.model('User', UserSchema);
