const express = require('express');
const authCheck = require('../authCheck');
const user = require('../controllers/users');

const router = express.Router();

router.post('/', user.create);
router.use(authCheck);
router.get('/', user.list);
router.get('/:id', user.details);
router.put('/:id', user.edit);
router.delete('/:id', user.delete);

module.exports = router;
