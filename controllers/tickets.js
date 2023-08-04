const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const { normalizeDocument } = require('../helpers');
const Ticket = require('../models/ticket');
const User = require('../models/user');

const normalizeQuery = (query) => {
  const selectOpts = {};
  const selectDefaultFields = ['title', 'description', 'status', 'project', 'submitter', 'devs', 'comments', 'created'];
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
      case 'project':
        option.populate = { path: 'manager', select: 'email firstName lastName role' };
        break;
      case 'submitter':
      case 'devs':
        break;
      case 'comments':
        option.select = '-ticket';
        option.populate = { path: 'submitter', select: 'email firstName lastName role' };
        break;
      default:
        return;
    }

    populateOpts.push(option);
  });

  return { selectOpts, populateOpts };
};

exports.create = [
  body('title').isString().withMessage('Title must be of type String').trim().notEmpty().withMessage('Title is required'),
  body('description').isString().withMessage('Description must be of type String').trim().notEmpty().withMessage('Description is required'),
  body('project').isString().withMessage('Project must be of type String').trim().isMongoId().withMessage('Project must be a valid mongo id string'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { title, description, project } = req.body;

    if (req.user.role !== 'Admin' && !req.user.projects.map((project) => project.toString()).includes(project)) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const ticket = new Ticket({
      title,
      description,
      project,
      submitter: req.user.id
    });

    const saved = await ticket.save().catch((err) => next(err));
    if (!saved) return;

    res.status(200).json({
      status: 200,
      message: 'Ticket created',
      session: normalizeDocument(req.user),
      url: `/tickets/${ticket.id}`
    });
  }
];

exports.list = async (req, res, next) => {
  const { selectOpts, populateOpts } = normalizeQuery(req.query);
  const tickets = await Ticket.find()
    .select(selectOpts)
    .populate(populateOpts)
    .exec()
    .catch((err) => next(err));

  if (!tickets) return;

  res.status(200).json({
    status: 200,
    message: 'Tickets list retrieved',
    session: normalizeDocument(req.user),
    tickets: tickets.map((ticket) => normalizeDocument(ticket))
  });
};

exports.details = [
  param('id').isMongoId().withMessage('Ticket id must be a valid mongo id string'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { selectOpts, populateOpts } = normalizeQuery(req.query);
    const ticket = await Ticket.findById(req.params.id)
      .select(selectOpts)
      .populate(populateOpts)
      .exec()
      .catch((err) => next(err));

    if (ticket === undefined) return;
    if (!ticket) {
      const err = createError(404, 'Ticket not found');
      return next(err);
    }

    res.status(200).json({
      status: 200,
      message: 'Ticket details retrieved',
      session: normalizeDocument(req.user),
      ticket: normalizeDocument(ticket)
    });
  }
];

exports.edit = [
  param('id').isMongoId().withMessage('Ticket id must be a valid mongo id string'),
  body('password').isString().withMessage('Password must be of type String').trim().notEmpty().withMessage('Password is required'),
  body('title').optional().isString().withMessage('Title must be of type String').trim(),
  body('description').optional().isString().withMessage('Description must be of type String').trim(),
  body('status').optional().isBoolean().withMessage('Status must be of type Boolean'),
  body('devs').optional().isArray().withMessage('Devs must be an Array'),
  body('devs.*').isString('Devs entries must be of type String').trim().isMongoId().withMessage('Devs must consist of valid mongo id strings'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { title, description, status, devs, password } = req.body;
    const correctPassword = await bcrypt.compare(password, req.user.password).catch((err) => next(err));

    if (correctPassword === undefined) return;
    if (!correctPassword) {
      const err = createError(400, 'password: Incorrect password');
      return next(err);
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate('project submitter devs comments')
      .exec()
      .catch((err) => next(err));

    if (ticket === undefined) return;
    if (!ticket) {
      const err = createError(404, 'Ticket not found');
      return next(err);
    }
    if (req.user.role !== 'Admin' && req.user.id !== ticket.project.manager.toString() && req.user.id !== ticket.submitter.id && !ticket.devs.map((dev) => dev.id).includes(req.user.id)) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const updateOpts = {};

    if (title) {
      if (req.user.role !== 'Admin' && req.user.id !== ticket.project.manager.toString() && req.user.id !== ticket.submitter.id) {
        const err = createError(403, 'Only admin, project manager and ticket submitter can edit ticket title');
        return next(err);
      }
      updateOpts.title = title;
    }
    if (description) {
      if (req.user.role !== 'Admin' && req.user.id !== ticket.project.manager.toString() && req.user.id !== ticket.submitter.id) {
        const err = createError(403, 'Only admin, project manager and ticket submitter can edit ticket description');
        return next(err);
      }
      updateOpts.description = description;
    }
    if (status !== undefined) {
      if (req.user.role !== 'Admin' && req.user.id !== ticket.project.manager.toString() && !ticket.devs.map((dev) => dev.id).includes(req.user.id)) {
        const err = createError(403, 'Only admin, project manager and ticket devs can edit ticket status');
        return next(err);
      }
      updateOpts.status = status;
    }
    if (devs) {
      if (req.user.role !== 'Admin' && req.user.id !== ticket.project.manager.toString()) {
        const err = createError(403, 'Only admin and project manager can edit devs list');
        return next(err);
      }

      const oldDevIds = ticket.devs.map((dev) => dev.id);
      const newDevIds = devs;
      const oldDevs = ticket.devs.filter((oldDev) => !newDevIds.includes(oldDev.id));
      const newDevs = await User.find({ _id: { $in: newDevIds.filter((newDevId) => !oldDevIds.includes(newDevId)) } })
        .exec()
        .catch((err) => next(err));

      if (!newDevs) return;

      for (let i = 0; i < newDevs.length; i++) {
        if (!newDevs[i].projects.map((project) => project.toString()).includes(ticket.project.id)) {
          const err = createError(400, 'devs: User is not assigned to the project');
          return next(err);
        }
        if (newDevs[i].role === 'User') {
          const err = createError(400, 'devs: User is not a developer');
          return next(err);
        }
      }

      const promises = [];

      oldDevs.forEach((dev) => {
        if (dev.id === ticket.submitter.id) return;
        promises.push(dev.updateOne({ $pull: { tickets: ticket.id } }).exec());
      });

      newDevs.forEach((dev) => {
        if (dev.id === ticket.submitter.id) return;
        promises.push(dev.updateOne({ $push: { tickets: ticket.id } }).exec());
      });

      const updated = await Promise.all(promises).catch((err) => next(err));
      if (!updated) return;

      updateOpts.devs = newDevIds;
    }

    const updated = await ticket
      .updateOne(updateOpts)
      .exec()
      .catch((err) => next(err));

    if (!updated) return;

    res.status(200).json({
      status: 200,
      message: 'Ticket details updated',
      session: normalizeDocument(req.user)
    });
  }
];

exports.delete = [
  param('id').isMongoId().withMessage('Ticket id must be a valid mongo id string'),
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

    const ticket = await Ticket.findById(req.params.id)
      .populate('project')
      .exec()
      .catch((err) => next(err));

    if (ticket === undefined) return;
    if (!ticket) {
      const err = createError(404, 'Ticket not found');
      return next(err);
    }
    if (req.user.role !== 'Admin' && req.user.id !== ticket.project.manager.toString()) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const deleted = await ticket.deleteOne().catch((err) => next(err));
    if (!deleted) return;

    res.status(200).json({
      status: 200,
      message: 'Ticket deleted',
      session: normalizeDocument(req.user)
    });
  }
];
