const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const User = require('../models/user');

exports.create = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email is not valid'),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password is less than 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = createError(
        400,
        errors
          .array()
          .reduce((filteredErrors, currentError) => {
            if (
              !filteredErrors.find((err) => err.param === currentError.param)
            ) {
              filteredErrors.push(currentError);
            }
            return filteredErrors;
          }, [])
          .map((err) => err.msg)
          .join('. ')
      );
      return next(err);
    }

    const foundUser = await User.findOne({
      email: new RegExp(`^${req.body.email}$`, 'i')
    })
      .exec()
      .catch((err) => next(err));

    if (foundUser) {
      return next(createError(400, 'User already exists'));
    }

    const hash = await bcrypt
      .hash(req.body.password, 10)
      .catch((err) => next(err));

    const user = new User({
      email: req.body.email,
      password: hash,
      firstName: req.body.firstName,
      lastName: req.body.lastName
    });

    await user.save().catch((err) => next(err));

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }

      res.status(200).json({
        status: 200,
        message: 'Signed up'
      });
    });
  }
];

exports.list = (req, res) => {
  res.send('User list\n');
};

exports.details = (req, res) => {
  res.send('User details\n');
};

exports.edit = (req, res) => {
  res.send('User edit\n');
};

exports.delete = (req, res) => {
  res.send('User delete\n');
};

exports.projects = (req, res) => {
  res.send('User projects\n');
};

exports.tickets = (req, res) => {
  res.send('User tickets\n');
};

exports.comments = (req, res) => {
  res.send('User comments\n');
};
