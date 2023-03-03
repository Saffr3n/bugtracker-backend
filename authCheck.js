const createError = require('http-errors');

module.exports = (req, res, next) => {
  if (req.isUnauthenticated()) {
    return next(createError(401));
  }

  next();
};
