const express = require('express');
const { authCheck } = require('../helpers');
const ticket = require('../controllers/tickets');

const router = express.Router();

router.use(authCheck);
router.post('/', ticket.create);
router.get('/', ticket.list);
router.get('/:id', ticket.details);
router.put('/:id', ticket.edit);
router.delete('/:id', ticket.delete);

module.exports = router;
