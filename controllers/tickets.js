// const { body, validationResult } = require('express-validator');
// const createError = require('http-errors');

exports.create = (req, res) => {
  res.send('Ticket create\n');
};

exports.list = (req, res) => {
  res.send('Ticket list\n');
};

exports.details = (req, res) => {
  res.send('Ticket details\n');
};

exports.edit = (req, res) => {
  res.send('Ticket edit\n');
};

exports.delete = (req, res) => {
  res.send('Ticket delete\n');
};
