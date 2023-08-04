const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  submitter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created: { type: Date, default: Date.now }
});
CommentSchema.pre('save', async function () {
  const comment = await this.populate('submitter ticket').catch((err) => {
    throw err;
  });
  const { ticket, submitter } = comment;

  await ticket
    .updateOne({ $push: { comments: comment.id } })
    .exec()
    .catch((err) => {
      throw err;
    });

  await submitter
    .updateOne({ $push: { comments: comment.id } })
    .exec()
    .catch((err) => {
      throw err;
    });
});
CommentSchema.pre('deleteOne', { document: true, query: false }, async function () {
  const comment = await this.populate('ticket submitter').catch((err) => {
    throw err;
  });
  const { ticket, submitter } = comment;

  await ticket
    .updateOne({ $pull: { comments: comment.id } })
    .exec()
    .catch((err) => {
      throw err;
    });

  await submitter
    .updateOne({ $pull: { comments: comment.id } })
    .exec()
    .catch((err) => {
      throw err;
    });
});

module.exports = mongoose.model('Comment', CommentSchema);
