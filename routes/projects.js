const express = require('express');
const authCheck = require('../authCheck');
const project = require('../controllers/projects');

const router = express.Router();

router.use(authCheck);
router.post('/', project.create);
router.get('/', project.list);
router.get('/:id', project.details);
router.put('/:id', project.edit);
router.delete('/:id', project.delete);
router.get('/:id/tickets', project.tickets);

module.exports = router;
