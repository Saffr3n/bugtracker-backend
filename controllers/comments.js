const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const { normalizeDocument } = require('../helpers');
const Comment = require('../models/comment');

const normalizeQuery = (query) => {
  const selectOpts = {};
  const selectDefaultFields = ['content', 'ticket', 'submitter', 'created'];
  const selectFields = query.select ? query.select.split(' ') : selectDefaultFields;

  selectFields.forEach((field) => {
    if (!selectDefaultFields.includes(field)) return;
    selectOpts[field] = 1;
  });

  const populateOpts = [];
  const populateFields = query.populate ? query.populate.split(' ') : [];

  populateFields.forEach((field) => {
    const option = { path: field };

    switch (field) {
      case 'ticket':
        option.populate = [
          { path: 'project', select: 'title' },
          { path: 'submitter', select: 'email firstName lastName role' }
        ];
        break;
      case 'submitter':
        break;
      default:
        return;
    }

    populateOpts.push(option);
  });

  return { selectOpts, populateOpts };
};

exports.create = [
  body('content').isString().withMessage('Content must be of type String').trim().notEmpty().withMessage('Content is required'),
  body('ticket').isString().withMessage('Ticket must be of type String').trim().isMongoId().withMessage('Ticket must be a valid mongo id string'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { content, ticket } = req.body;

    if (req.user.role !== 'Admin' && !req.user.tickets.map((ticket) => ticket.toString()).includes(ticket)) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const comment = new Comment({
      content,
      ticket,
      submitter: req.user.id
    });

    const saved = await comment.save().catch((err) => next(err));
    if (!saved) return;

    res.status(200).json({
      status: 200,
      message: 'Comment created',
      session: normalizeDocument(req.user),
      url: `/comments/${comment.id}`
    });
  }
];

exports.list = async (req, res, next) => {
  const { selectOpts, populateOpts } = normalizeQuery(req.query);
  const comments = await Comment.find()
    .select(selectOpts)
    .populate(populateOpts)
    .exec()
    .catch((err) => next(err));

  if (!comments) return;

  res.status(200).json({
    status: 200,
    message: 'Comments list retrieved',
    session: normalizeDocument(req.user),
    comments: comments.map((comment) => normalizeDocument(comment))
  });
};

exports.details = [
  param('id').isMongoId().withMessage('Comment id must be a valid mongo id string'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { selectOpts, populateOpts } = normalizeQuery(req.query);
    const comment = await Comment.findById(req.params.id)
      .select(selectOpts)
      .populate(populateOpts)
      .exec()
      .catch((err) => next(err));

    if (comment === undefined) return;
    if (!comment) {
      const err = createError(404, 'Comment not found');
      return next(err);
    }

    res.status(200).json({
      status: 200,
      message: 'Comment details retrieved',
      session: normalizeDocument(req.user),
      comment: normalizeDocument(comment)
    });
  }
];

exports.edit = [
  param('id').isMongoId().withMessage('Comment id must be a valid mongo id string'),
  body('password').isString().withMessage('Password must be of type String').trim().notEmpty().withMessage('Password is required'),
  body('content').isString().withMessage('Content must be of type String').trim().notEmpty().withMessage('Content is required'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { content, password } = req.body;
    const correctPassword = await bcrypt.compare(password, req.user.password).catch((err) => next(err));

    if (correctPassword === undefined) return;
    if (!correctPassword) {
      const err = createError(400, 'password: Incorrect password');
      return next(err);
    }

    if (req.user.role !== 'Admin' && !req.user.comments.map((comment) => comment.toString()).includes(req.params.id)) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const comment = await Comment.findById(req.params.id)
      .exec()
      .catch((err) => next(err));

    if (comment === undefined) return;
    if (!comment) {
      const err = createError(404, 'Comment not found');
      return next(err);
    }

    const updated = await comment
      .updateOne({ content })
      .exec()
      .catch((err) => next(err));

    if (!updated) return;

    res.status(200).json({
      status: 200,
      message: 'Comment details updated',
      session: normalizeDocument(req.user)
    });
  }
];

exports.delete = [
  param('id').isMongoId().withMessage('Comment id must be a valid mongo id string'),
  body('password').isString().withMessage('Password must be of type String').trim().notEmpty().withMessage('Password is required'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const correctPassword = await bcrypt.compare(req.body.password, req.user.password).catch((err) => next(err));

    if (correctPassword === undefined) return;
    if (!correctPassword) {
      const err = createError(400, 'password: Incorrect password');
      return next(err);
    }

    if (req.user.role !== 'Admin' && !req.user.comments.map((comment) => comment.toString()).includes(req.params.id)) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const comment = await Comment.findById(req.params.id)
      .exec()
      .catch((err) => next(err));

    if (comment === undefined) return;
    if (!comment) {
      const err = createError(404, 'Comment not found');
      return next(err);
    }

    const deleted = await comment.deleteOne().catch((err) => next(err));
    if (!deleted) return;

    res.status(200).json({
      status: 200,
      message: 'Comment deleted',
      session: normalizeDocument(req.user)
    });
  }
];
