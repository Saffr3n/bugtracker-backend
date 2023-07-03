const { body, validationResult } = require('express-validator');
const createError = require('http-errors');
const User = require('../models/user');
const Project = require('../models/project');

exports.create = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim(),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = createError(400, errors.errors[0].msg);
      return next(err);
    }

    const uid = req.session.passport.user;

    const project = new Project({
      title: req.body.title,
      description: req.body.description,
      manager: uid
    });

    await project.save().catch((err) => next(err));
    await User.findByIdAndUpdate(uid, { $push: { projects: project.id } });

    res.status(200).json({
      status: 200,
      message: 'Project created'
    });
  }
];

exports.list = async (req, res, next) => {
  const user = await User.findById(req.session.passport.user)
    .exec()
    .catch((err) => next(err));

  res.send(user.projects);
};

exports.details = (req, res) => {
  res.send('Project details\n');
};

exports.edit = (req, res) => {
  res.send('Project edit\n');
};

exports.delete = (req, res) => {
  res.send('Project delete\n');
};

exports.tickets = (req, res) => {
  res.send('Project tickets\n');
};
