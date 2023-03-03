const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('morgan');
const createError = require('http-errors');
const indexRouter = require('./routes/index');

const app = express();

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

app.use(express.json());
app.use(logger('dev'));

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
