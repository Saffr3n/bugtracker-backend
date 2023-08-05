const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const { normalizeDocument } = require('../helpers');
const User = require('../models/user');

const normalizeQuery = (query) => {
  const selectOpts = {};
  const selectDefaultFields = ['email', 'firstName', 'lastName', 'role', 'projects', 'tickets', 'comments', 'registered'];
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
      case 'projects':
        option.populate = { path: 'manager', select: 'email firstName lastName role' };
        break;
      case 'tickets':
        option.populate = [
          { path: 'project', select: 'title' },
          { path: 'submitter', select: 'email firstName lastName role' }
        ];
        break;
      case 'comments':
        option.select = '-submitter';
        option.populate = { path: 'ticket', select: 'title status', populate: { path: 'project', select: 'title' } };
        break;
      default:
        return;
    }

    populateOpts.push(option);
  });

  return { selectOpts, populateOpts };
};

exports.create = [
  body('email').isString().withMessage('Email must be of type String').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email'),
  body('password').isString().withMessage('Password must be of type String').trim().notEmpty().withMessage('Password is required').isLength({ min: 8 }).withMessage('Password is less than 8 characters'),
  body('firstName').isString().withMessage('First name must be of type String').trim().notEmpty().withMessage('First name is required'),
  body('lastName').isString().withMessage('Last name must be of type String').trim().notEmpty().withMessage('Last name is required'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { email, password, firstName, lastName } = req.body;
    const foundUser = await User.findOne({ email: new RegExp(`^${email}$`, 'i') })
      .exec()
      .catch((err) => next(err));

    if (foundUser === undefined) return;
    if (foundUser) {
      const err = createError(400, 'email: User already exists');
      return next(err);
    }

    const hash = await bcrypt.hash(password, parseInt(process.env.SALT, 10)).catch((err) => next(err));
    if (!hash) return;

    const user = new User({
      email,
      password: hash,
      firstName,
      lastName
    });

    const saved = await user.save().catch((err) => next(err));
    if (!saved) return;

    req.login(user, (err) => {
      if (err) return next(err);

      res.status(200).json({
        status: 200,
        message: 'Signed up',
        session: normalizeDocument(req.user),
        url: `/users/${user.id}`
      });
    });
  }
];

exports.list = async (req, res, next) => {
  const { selectOpts, populateOpts } = normalizeQuery(req.query);
  const users = await User.find()
    .select(selectOpts)
    .populate(populateOpts)
    .exec()
    .catch((err) => next(err));

  if (!users) return;

  res.status(200).json({
    status: 200,
    message: 'Users list retrieved',
    session: normalizeDocument(req.user),
    users: users.map((user) => normalizeDocument(user))
  });
};

exports.details = [
  param('id').isMongoId().withMessage('User id must be a valid mongo id string'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { selectOpts, populateOpts } = normalizeQuery(req.query);
    const user = await User.findById(req.params.id)
      .select(selectOpts)
      .populate(populateOpts)
      .exec()
      .catch((err) => next(err));

    if (user === undefined) return;
    if (!user) {
      const err = createError(404, 'User not found');
      return next(err);
    }

    res.status(200).json({
      status: 200,
      message: 'User details retrieved',
      session: normalizeDocument(req.user),
      user: normalizeDocument(user)
    });
  }
];

exports.edit = [
  param('id').isMongoId().withMessage('User id must be a valid mongo id string'),
  body('email').optional().isString().withMessage('Email must be of type String').trim().isEmail().withMessage('Invalid email'),
  body('password').isObject().withMessage('Password must be of type Object -> { old: "currentPassword", new?: "newPassword" }'),
  body('password.old').isString().withMessage('Current password must be of type String').trim().notEmpty().withMessage('Current password is required'),
  body('password.new').optional().isString().withMessage('New password must be of type String').trim().isLength({ min: 8 }).withMessage('New password is less than 8 characters'),
  body('firstName').optional().isString().withMessage('First name must be of type String').trim(),
  body('lastName').optional().isString().withMessage('Last name must be of type String').trim(),
  body('role').optional().isString().withMessage('User role must be of type String').trim().isIn(['Admin', 'Project Manager', 'Developer', 'User']).withMessage('Invalid user role -> "Admin | Project Manager | Developer | User"'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErr = errors.array()[0];
      const err = createError(400, `${validationErr.param}: ${validationErr.msg}`);
      return next(err);
    }

    const { email, password, firstName, lastName, role } = req.body;
    const correctPassword = await bcrypt.compare(password.old, req.user.password).catch((err) => next(err));

    if (correctPassword === undefined) return;
    if (!correctPassword) {
      const err = createError(400, 'password.old: Incorrect password');
      return next(err);
    }

    if (req.user.role !== 'Admin' && req.user.id !== req.params.id) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const user =
      req.user.id === req.params.id
        ? req.user
        : await User.findById(req.params.id)
            .exec()
            .catch((err) => next(err));

    if (user === undefined) return;
    if (!user) {
      const err = createError(404, 'User not found');
      return next(err);
    }

    const updateOpts = {};

    if (email) updateOpts.email = email;
    if (firstName) updateOpts.firstName = firstName;
    if (lastName) updateOpts.lastName = lastName;
    if (password.new) {
      const hash = await bcrypt.hash(password.new, parseInt(process.env.SALT, 10)).catch((err) => next(err));
      if (!hash) return;
      updateOpts.password = hash;
    }
    if (role) {
      if (req.user.role !== 'Admin') {
        const err = createError(403, 'Only admin can edit user role');
        return next(err);
      }
      if (req.user.id === req.params.id) {
        const err = createError(403, 'Admin cannot edit their own user role');
        return next(err);
      }
      updateOpts.role = role;
    }

    const updated = await user
      .updateOne(updateOpts)
      .exec()
      .catch((err) => next(err));

    if (!updated) return;

    res.status(200).json({
      status: 200,
      message: 'User details updated',
      session: normalizeDocument(req.user)
    });
  }
];

exports.delete = [
  param('id').isMongoId().withMessage('User id must be a valid mongo id string'),
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

    if (req.user.role !== 'Admin' && req.user.id !== req.params.id) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const user =
      req.user.id === req.params.id
        ? req.user
        : await User.findById(req.params.id)
            .exec()
            .catch((err) => next(err));

    if (user === undefined) return;
    if (!user) {
      const err = createError(404, 'User not found');
      return next(err);
    }
    if (user.role === 'Admin') {
      const err = createError(403, 'Cannot delete admin');
      return next(err);
    }

    const deleted = await user.deleteOne().catch((err) => next(err));
    if (!deleted) return;

    res.status(200).json({
      status: 200,
      message: 'User deleted',
      session: req.user.role === 'Admin' ? normalizeDocument(req.user) : {}
    });
  }
];
