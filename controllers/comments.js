// const { body, validationResult } = require('express-validator');
// const createError = require('http-errors');

exports.create = (req, res) => {
  res.send('Comment create\n');
};

exports.list = (req, res) => {
  res.send('Comment list\n');
};

exports.details = (req, res) => {
  res.send('Comment details\n');
};

exports.edit = (req, res) => {
  res.send('Comment edit\n');
};

exports.delete = (req, res) => {
  res.send('Comment delete\n');
};
