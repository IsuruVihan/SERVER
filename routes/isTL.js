const express = require('express');
const router = express.Router();

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
const checkTL = require('../middleware/checkTL');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);
router.use(checkTL);

router.route('/')
	.get((req, res) => {
		return res.status(200).json({ isTL: true });
	});

module.exports = router;