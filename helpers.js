const mongoose = require('mongoose');
const createError = require('http-errors');

exports.authCheck = (req, res, next) => {
  if (req.isUnauthenticated()) {
    return next(createError(401));
  }

  return next();
};

exports.normalizeDocument = (doc) => {
  if (Array.isArray(doc)) {
    const array = [];
    doc.forEach((entry) => {
      array.push(this.normalizeDocument(entry));
    });
    return array;
  }
  if (doc instanceof mongoose.Types.ObjectId) return doc.toString();
  if (doc instanceof Date) return doc.toISOString();
  if (typeof doc !== 'object') return doc;

  const document = doc instanceof mongoose.Document ? doc.toObject() : doc;
  document.id = document._id;
  delete document._id;
  delete document.__v;
  delete document.password;

  Object.keys(document).forEach((key) => {
    document[key] = this.normalizeDocument(document[key]);
  });

  return document;
};
