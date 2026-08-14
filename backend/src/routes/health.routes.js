const { Router } = require('express');
const healthController = require('../controllers/health.controller');

const router = Router();

router.get('/', healthController.getStatus);
router.get('/db', healthController.getDatabaseStatus);

module.exports = router;
