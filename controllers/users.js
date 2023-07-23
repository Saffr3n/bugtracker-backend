const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const User = require('../models/user');

exports.create = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Email is not valid'),
  body('password').trim().notEmpty().withMessage('Password is required').isLength({ min: 8 }).withMessage('Password is less than 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = createError(400, errors.array()[0].msg);
      return next(err);
    }

    const { email, password, firstName, lastName } = req.body;
    const foundUser = await User.findOne({ email: new RegExp(`^${email}$`, 'i') })
      .exec()
      .catch((err) => next(err));

    if (foundUser) {
      const err = createError(400, 'User already exists');
      return next(err);
    }

    let user = new User({
      email,
      password: await bcrypt.hash(password, parseInt(process.env.SALT, 10)).catch((err) => next(err)),
      firstName,
      lastName
    });

    await user.save().catch((err) => next(err));

    user = user.toObject();
    user.id = user._id.toString();
    delete user._id;
    delete user.password;
    delete user.__v;

    req.login(user, (err) => {
      if (err) return next(err);

      res.status(200).json({
        status: 200,
        message: 'Signed up',
        session: req.user
      });
    });
  }
];

exports.list = async (req, res, next) => {
  const requesterRole = req.user.role;

  if (requesterRole !== 'Admin' && requesterRole !== 'Project Manager') {
    const err = createError(403, 'Access denied');
    return next(err);
  }

  const users = (
    await User.find()
      .select('-password -__v')
      .exec()
      .catch((err) => next(err))
  ).map((doc) => {
    const user = doc.toObject();

    user.id = user._id.toString();
    delete user._id;

    return user;
  });

  res.status(200).json({
    status: 200,
    message: 'Users list retrieved',
    session: req.user,
    users
  });
};

exports.details = [
  param('id').isMongoId().withMessage('Invalid user id'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = createError(400, errors.array()[0].msg);
      return next(err);
    }

    const userId = req.params.id;
    let user = await User.findById(userId)
      .select('-password -__v')
      .exec()
      .catch((err) => next(err));

    if (!user) {
      const err = createError(404, 'User not found');
      return next(err);
    }

    user = user.toObject();
    user.id = user._id.toString();
    delete user._id;

    res.status(200).json({
      status: 200,
      message: 'User details retrieved',
      session: req.user,
      user
    });
  }
];

exports.edit = [
  param('id').isMongoId().withMessage('Invalid user id'),
  body('email').trim().optional().isEmail().withMessage('Email is not valid'),
  body('password').trim().optional().isLength({ min: 8 }).withMessage('Password is less than 8 characters'),
  body('firstName').trim(),
  body('lastName').trim(),
  body('role').trim().optional().isIn(['Admin', 'Project Manager', 'Developer', 'User']).withMessage('Invalid user role'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = createError(400, errors.array()[0].msg);
      return next(err);
    }

    const requester = req.user;
    const userId = req.params.id;

    if (requester.role !== 'Admin' && requester.id !== userId) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    const { email, password, firstName, lastName, role } = req.body;
    const update = {};

    if (email) update.email = email;
    if (password) update.password = await bcrypt.hash(password, parseInt(process.env.SALT, 10)).catch((err) => next(err));
    if (firstName) update.firstName = firstName;
    if (lastName) update.lastName = lastName;
    if (role && requester.role === 'Admin') update.role = role;

    let user = await User.findByIdAndUpdate(userId, update, { fields: '-password -__v', new: true })
      .exec()
      .catch((err) => next(err));

    if (!user) {
      const err = createError(404, 'User not found');
      return next(err);
    }

    user = user.toObject();
    user.id = user._id.toString();
    delete user._id;

    if (requester.id === userId) req.user = user;

    res.status(200).json({
      status: 200,
      message: 'User details updated',
      session: req.user,
      user
    });
  }
];

exports.delete = [
  param('id').isMongoId().withMessage('Invalid user id'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = createError(400, errors.array()[0].msg);
      return next(err);
    }

    const requester = req.user;
    const userId = req.params.id;

    if (requester.role !== 'Admin' && requester.id !== userId) {
      const err = createError(403, 'Access denied');
      return next(err);
    }

    if (requester.role === 'Admin' && requester.id === userId) {
      const err = createError(403, 'Cannot delete admin');
      return next(err);
    }

    await User.deleteOne({ _id: userId })
      .exec()
      .catch((err) => next(err));

    res.status(200).json({
      status: 200,
      message: 'User deleted',
      session: requester.role === 'Admin' ? req.user : null
    });
  }
];
