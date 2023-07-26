const mongoose = require('mongoose');

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
UserSchema.pre('deleteOne', { document: true, query: false }, async function () {
  const user = await this.populate('projects tickets comments').catch((err) => {
    throw err;
  });
  const { projects, tickets, comments } = user;
  const promises = [];

  promises.push(
    ...projects.map((project) => {
      const managerId = project.manager.toString();
      const update = { $pull: { users: user.id } };

      if (managerId === user.id) update.manager = null;

      return project.updateOne(update);
    }),
    ...tickets.map((ticket) => {
      const submitterId = ticket.submitter.toString();
      const update = { $pull: { devs: user.id } };

      if (submitterId === user.id) update.submitter = null;

      return ticket.updateOne(update);
    }),
    ...comments.map((comment) => comment.updateOne({ submitter: null }))
  );

  await Promise.all(promises).catch((err) => {
    throw err;
  });
});

module.exports = mongoose.model('User', UserSchema);
