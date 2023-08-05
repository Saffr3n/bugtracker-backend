const express = require('express');
const session = require('express-session');
const passport = require('passport');
const JSONStrategy = require('passport-json').Strategy;
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('morgan');
const createError = require('http-errors');
const { normalizeDocument } = require('./helpers');
const User = require('./models/user');
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const projectsRouter = require('./routes/projects');
const ticketsRouter = require('./routes/tickets');
const commentsRouter = require('./routes/comments');

const app = express();

passport.use(
  new JSONStrategy({ usernameProp: 'email' }, async (email, password, done) => {
    const user = await User.findOne({ email: new RegExp(`^${email}$`, 'i') })
      .exec()
      .catch((err) => done(err));

    if (user === undefined) return;
    if (!user) return done(null, false);

    const correctPassword = await bcrypt.compare(password, user.password).catch((err) => done(err));

    if (correctPassword === undefined) return;
    if (!correctPassword) return done(null, false);

    return done(null, user);
  })
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id)
    .exec()
    .catch((err) => done(err));

  if (user === undefined) return;
  if (!user) return done(null, false);

  return done(null, user);
});

mongoose.set('strictQuery', false);
main().catch((err) => console.log(err));
async function main() {
  await mongoose.connect(process.env.MONGO_URI);
}

app.use(
  cors({
    origin: process.env.ORIGIN,
    credentials: true,
    optionsSuccessStatus: 200
  })
);

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      sameSite: 'strict'
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(logger('dev'));

app.use('/users', usersRouter);
app.use('/projects', projectsRouter);
app.use('/tickets', ticketsRouter);
app.use('/comments', commentsRouter);
app.use('/', indexRouter);

app.use((req, res, next) => {
  const err = createError(404, 'Path not found');
  return next(err);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const error = {
    status: err.status || err.code || 500,
    message: err.message || err.msg || 'Unknown error',
    session: normalizeDocument(req.user) || {}
  };

  if (req.app.get('env') === 'development') {
    error.stack = err.stack;
  } else if (error.status >= 500) {
    error.status = 500;
    error.message = 'Server error';
  }

  res.status(error.status).json(error);
});

module.exports = app;
