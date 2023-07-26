const passport = require('passport');
const createError = require('http-errors');

exports.signin = (req, res, next) => {
  passport.authenticate('json', (err, user) => {
    if (err) return next(err);
    if (!user) {
      const err = createError(400, 'Incorrect email or password');
      return next(err);
    }

    req.login(user, (err) => {
      if (err) return next(err);

      res.status(200).json({
        status: 200,
        message: 'Signed in',
        session: req.user
      });
    });
  })(req, res, next);
};

exports.signout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    res.status(200).json({
      status: 200,
      message: 'Signed out',
      session: null
    });
  });
};

exports.session = (req, res) => {
  res.status(200).json({
    status: 200,
    message: 'Authorized',
    session: req.user
  });
};
