const { body, validationResult } = require('express-validator');
const createError = require('http-errors');
const mongoose = require('mongoose');
const User = require('../models/user');
const Project = require('../models/project');
const Ticket = require('../models/ticket');

exports.create = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('project').trim().notEmpty().withMessage('Project reference is required'),

  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const err = createError(
        400,
        errors
          .array()
          .reduce((filteredErrors, currentError) => {
            if (!filteredErrors.find((err) => err.param === currentError.param)) {
              filteredErrors.push(currentError);
            }
            return filteredErrors;
          }, [])
          .map((err) => err.msg)
          .join('. ')
      );
      return next(err);
    }

    const uid = req.session.passport.user;

    const ticket = new Ticket({
      title: req.body.title,
      description: req.body.description,
      project: req.body.project,
      submitter: uid
    });

    await ticket.save().catch((err) => next(err));
    await User.findByIdAndUpdate(uid, { $push: { tickets: ticket.id } });
    await Project.findByIdAndUpdate(ticket.project, { $push: { tickets: ticket.id } });

    res.status(200).json({
      status: 200,
      message: 'Ticket created',
      ticket: { _id: ticket.id, url: ticket.url }
    });
  }
];

exports.list = async (req, res, next) => {
  const tickets = await Ticket.find()
    .select(['title', 'description', 'status', 'project', 'submitter', 'created'])
    .populate('project', 'title')
    .populate('submitter', ['firstName', 'lastName'])
    .exec()
    .catch((err) => next(err));

  res.status(200).json({
    status: 200,
    message: 'Tickets list retrieved',
    tickets
  });
};

exports.details = async (req, res, next) => {
  try {
    const id = mongoose.Types.ObjectId(req.params.id);
    const ticket = await Ticket.findById(id).exec.catch((err) => next(err));

    res.status(200).json({
      status: 200,
      message: 'Ticket details retrieved',
      ticket
    });
  } catch {
    createError(400, 'Incorrect ID');
  }
};

exports.edit = (req, res) => {
  res.send('Ticket edit\n');
};

exports.delete = (req, res) => {
  res.send('Ticket delete\n');
};
