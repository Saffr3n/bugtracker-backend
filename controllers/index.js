const passport = require('passport');
const createError = require('http-errors');
const User = require('../models/user');

exports.signin = (req, res, next) => {
  passport.authenticate('json', async (err, user) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return next(createError(400, 'Incorrect email or password'));
    }

    const _user = await User.findById(user)
      .select('role')
      .exec()
      .catch((err) => next(err));

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }

      res.status(200).json({
        status: 200,
        message: 'Signed in',
        user: _user
      });
    });
  })(req, res, next);
};

exports.signout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    res.status(401).json({
      status: 401,
      message: 'Signed out'
    });
  });
};

exports.session = async (req, res, next) => {
  const user = await User.findById(req.session.passport.user)
    .select('role')
    .exec()
    .catch((err) => next(err));

  res.status(200).json({
    status: 200,
    message: 'Authorized',
    user
  });
};
