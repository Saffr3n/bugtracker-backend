const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const { normalizeDocument } = require('../helpers');
const Project = require('../models/project');
const User = require('../models/user');

const normalizeQuery = (query) => {
  const selectOpts = {};
  const selectDefaultFields = ['title', 'description', 'manager', 'users', 'tickets', 'created'];
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
      case 'manager':
      case 'users':
        break;
      case 'tickets':
        option.select = '-project';
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
  body('description').optional().isString().withMessage('Description must be of type String').trim(),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    if (req.user.role !== 'Admin' && req.user.role !== 'Project Manager') {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const { title, description } = req.body;
    const project = new Project({
      title,
      description: description || '',
      manager: req.user.id
    });

    const saved = await project.save().catch((err) => next(err));
    if (!saved) return;

    res.status(200).json({
      status: 200,
      message: 'Project created',
      session: normalizeDocument(req.user),
      url: `/projects/${project.id}`
    });
  }
];

exports.list = async (req, res, next) => {
  const { selectOpts, populateOpts } = normalizeQuery(req.query);
  const projects = await Project.find()
    .select(selectOpts)
    .populate(populateOpts)
    .exec()
    .catch((err) => next(err));

  if (!projects) return;

  res.status(200).json({
    status: 200,
    message: 'Projects list retrieved',
    session: normalizeDocument(req.user),
    projects: projects.map((project) => normalizeDocument(project))
  });
};

exports.details = [
  param('id').isMongoId().withMessage('Project id must be a valid mongo id string'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { selectOpts, populateOpts } = normalizeQuery(req.query);
    const project = await Project.findById(req.params.id)
      .select(selectOpts)
      .populate(populateOpts)
      .exec()
      .catch((err) => next(err));

    if (project === undefined) return;
    if (!project) {
      const err = createError(404, 'Project not found');
      return next(err);
    }

    res.status(200).json({
      status: 200,
      message: 'Project details retrieved',
      session: normalizeDocument(req.user),
      project: normalizeDocument(project)
    });
  }
];

exports.edit = [
  param('id').isMongoId().withMessage('Project id must be a valid mongo id string'),
  body('password').isString().withMessage('Password must be of type String').trim().notEmpty().withMessage('Password is required'),
  body('title').optional().isString().withMessage('Title must be of type String').trim(),
  body('description').optional().isString().withMessage('Description must be of type String').trim(),
  body('manager').optional().isString().withMessage('Manager must be of type String').trim().isMongoId().withMessage('Manager must be a valid mongo id string'),
  body('users').optional().isArray().withMessage('Users must be an Array'),
  body('users.*').isString().withMessage('Users entries must be of type String').trim().isMongoId().withMessage('Users must consist of valid mongo id strings'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { title, description, manager, users, password } = req.body;
    const correctPassword = await bcrypt.compare(password, req.user.password).catch((err) => next(err));

    if (correctPassword === undefined) return;
    if (!correctPassword) {
      const err = createError(400, 'password: Incorrect password');
      return next(err);
    }

    const project = await Project.findById(req.params.id)
      .populate('users tickets')
      .exec()
      .catch((err) => next(err));

    if (project === undefined) return;
    if (!project) {
      const err = createError(404, 'Project not found');
      return next(err);
    }
    if (req.user.role !== 'Admin' && req.user.id !== project.manager.toString()) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const updateOpts = {};

    if (title) updateOpts.title = title;
    if (description) updateOpts.description = description;
    if (users) {
      const oldUserIds = project.users.map((user) => user.id);
      const newUserIds = users;
      const oldUsers = project.users.filter((oldUser) => !newUserIds.includes(oldUser.id));
      const newUsers = await User.find({ _id: { $in: newUserIds.filter((newUserId) => !oldUserIds.includes(newUserId)) } })
        .exec()
        .catch((err) => next(err));

      if (!newUsers) return;

      const promises = [];

      oldUsers.forEach((user) => {
        const userUpdateOpts = { $pull: { projects: project.id } };
        project.tickets.forEach((ticket) => {
          const devIds = ticket.devs.map((dev) => dev.toString());
          if (!devIds.includes(user.id)) return;
          promises.push(ticket.updateOne({ $pull: { devs: user.id } }).exec());
          if (user.id === ticket.submitter.toString()) return;
          userUpdateOpts.$pull.tickets = ticket.id;
        });
        promises.push(user.updateOne(userUpdateOpts).exec());
      });

      newUsers.forEach((user) => {
        promises.push(user.updateOne({ $push: { projects: project.id } }).exec());
      });

      const updated = await Promise.all(promises).catch((err) => next(err));
      if (!updated) return;

      updateOpts.users = newUserIds;
    }
    if (manager && manager !== req.user.id) {
      const newManagerId = manager;
      const oldManagerId = req.user.id;
      const newManager = await User.findById(newManagerId)
        .exec()
        .catch((err) => next(err));

      if (newManager === undefined) return;
      if (!newManager) {
        const err = createError(404, 'User you are trying to appoint to a project manager position not found');
        return next(err);
      }
      if (newManager.role !== 'Admin' && newManager.role !== 'Project Manager') {
        const err = createError(400, 'manager: User is not a project manager');
        return next(err);
      }

      const oldUserIds = project.users.map((user) => user.id);
      const newUserIds = updateOpts.users;

      if ((newUserIds && !newUserIds.includes(newManagerId)) || (!newUserIds && !oldUserIds.includes(newManagerId))) {
        const err = createError(400, 'manager: User is not assigned to the project');
        return next(err);
      }

      updateOpts.manager = newManagerId;
      updateOpts.users = newUserIds ? [oldManagerId, ...newUserIds.filter((userId) => userId !== newManagerId)] : [oldManagerId, ...oldUserIds.filter((userId) => userId !== newManagerId)];
    }

    const updated = await project
      .updateOne(updateOpts)
      .exec()
      .catch((err) => next(err));

    if (!updated) return;

    res.status(200).json({
      status: 200,
      message: 'Project details updated',
      session: normalizeDocument(req.user)
    });
  }
];

exports.delete = [
  param('id').isMongoId().withMessage('Project id must be a valid mongo id string'),
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

    const project = await Project.findById(req.params.id)
      .exec()
      .catch((err) => next(err));

    if (project === undefined) return;
    if (!project) {
      const err = createError(404, 'Project not found');
      return next(err);
    }
    if (req.user.role !== 'Admin' && req.user.id !== project.manager.toString()) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const deleted = await project.deleteOne().catch((err) => next(err));
    if (!deleted) return;

    res.status(200).json({
      status: 200,
      message: 'Project deleted',
      session: normalizeDocument(req.user)
    });
  }
];
