const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: Boolean, default: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  submitter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  devs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  created: { type: Date, default: Date.now }
});
TicketSchema.pre('save', async function () {
  const ticket = await this.populate('project submitter').catch((err) => {
    throw err;
  });
  const { project, submitter } = ticket;

  await project
    .updateOne({ $push: { tickets: ticket.id } })
    .exec()
    .catch((err) => {
      throw err;
    });

  await submitter
    .updateOne({ $push: { tickets: ticket.id } })
    .exec()
    .catch((err) => {
      throw err;
    });
});
TicketSchema.pre('deleteOne', { document: true, query: false }, async function () {
  const ticket = await this.populate('project submitter devs comments').catch((err) => {
    throw err;
  });
  const { project, submitter, devs, comments } = ticket;

  const promises = [];
  promises.push(...[project, submitter, ...devs].map((doc) => doc.updateOne({ $pull: { tickets: ticket.id } }).exec()), ...comments.map((comment) => comment.deleteOne()));

  await Promise.all(promises).catch((err) => {
    throw err;
  });
});

module.exports = mongoose.model('Ticket', TicketSchema);
