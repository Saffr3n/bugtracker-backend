const express = require('express');
const { authCheck } = require('../helpers');
const index = require('../controllers/index');

const router = express.Router();

router.post('/', index.signin);
router.delete('/', index.signout);
router.use(authCheck);
router.get('/', index.session);

module.exports = router;
