const { body, validationResult } = require('express-validator');
const createError = require('http-errors');
const mongoose = require('mongoose');
const User = require('../models/user');
const Project = require('../models/project');
const Ticket = require('../models/ticket');

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
      message: 'Project created',
      url: project.url
    });
  }
];

exports.list = async (req, res, next) => {
  const projects = await Project.find()
    .select(['title', 'description', 'manager', 'created'])
    .populate('manager', ['firstName', 'lastName'])
    .exec()
    .catch((err) => next(err));

  res.send(projects);
};

exports.details = async (req, res, next) => {
  try {
    const id = mongoose.Types.ObjectId(req.params.id);
    const project = await Project.findById(id)
      .populate('manager')
      .populate('users')
      .populate('tickets')
      .exec()
      .catch((err) => next(err));

    res.send(project);
  } catch {
    next(createError(400, 'Incorrect id'));
  }
};

exports.edit = (req, res) => {
  res.send('Project edit\n');
};

exports.delete = (req, res) => {
  res.send('Project delete\n');
};
