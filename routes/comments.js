const express = require('express');
const { authCheck } = require('../helpers');
const comment = require('../controllers/comments');

const router = express.Router();

router.use(authCheck);
router.post('/', comment.create);
router.get('/', comment.list);
router.get('/:id', comment.details);
router.put('/:id', comment.edit);
router.delete('/:id', comment.delete);

module.exports = router;
