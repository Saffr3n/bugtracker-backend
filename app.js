const express = require('express');
const session = require('express-session');
const passport = require('passport');
const JSONStrategy = require('passport-json').Strategy;
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('morgan');
const createError = require('http-errors');
const User = require('./models/user');
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const projectsRouter = require('./routes/projects');
const ticketsRouter = require('./routes/tickets');
const commentsRouter = require('./routes/comments');

const app = express();

passport.use(
  new JSONStrategy({ usernameProp: 'email' }, (email, password, done) => {
    User.findOne({ email: new RegExp(`^${email}$`, 'i') }).exec(
      async (err, user) => {
        if (err) {
          return done(err);
        }

        if (!user || !(await bcrypt.compare(password, user.password))) {
          return done(null, false);
        }

        done(null, user);
      }
    );
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id).exec((err, user) => {
    done(err, user);
  });
});

mongoose.set('strictQuery', false);
main().catch((err) => console.log(err));
async function main() {
  await mongoose.connect(process.env.MONGO_URI);
}

app.use(
  cors({
    origin: 'http://localhost:8080',
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
  next(createError(404));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const error = { status: err.status || 500 };
  error.message = error.status === 500 ? 'Server error' : err.message;

  if (req.app.get('env') === 'development') {
    error.message = err.message || 'Unknown error';
    error.stack = err.stack;
  }

  res.status(error.status).json(error);
});

module.exports = app;
