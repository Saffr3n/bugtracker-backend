const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],
  created: { type: Date, default: Date.now }
});
ProjectSchema.pre('save', async function () {
  const project = await this.populate('manager').catch((err) => {
    throw err;
  });
  const { manager } = project;

  await manager
    .updateOne({ $push: { projects: project.id } })
    .exec()
    .catch((err) => {
      throw err;
    });
});
ProjectSchema.pre('deleteOne', { document: true, query: false }, async function () {
  const project = await this.populate('manager users tickets').catch((err) => {
    throw err;
  });
  const { manager, users, tickets } = project;
  users.push(manager);

  const promises = [];
  promises.push(...users.map((user) => user.updateOne({ $pull: { projects: project.id } }).exec()), ...tickets.map((ticket) => ticket.deleteOne()));

  await Promise.all(promises).catch((err) => {
    throw err;
  });
});

module.exports = mongoose.model('Project', ProjectSchema);
