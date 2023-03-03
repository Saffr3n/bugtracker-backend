const passport = require('passport');
const createError = require('http-errors');

exports.signin = (req, res, next) => {
  passport.authenticate('json', (err, user) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return next(createError(400, 'Incorrect email or password'));
    }

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }

      res.status(200).json({
        status: 200,
        message: 'Signed in'
      });
    });
  })(req, res, next);
};

exports.signout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    res.status(200).json({
      status: 200,
      message: 'Signed out'
    });
  });
};

exports.session = (req, res) => {
  res.status(200).json({
    status: 200,
    message: 'Authorized'
  });
};
