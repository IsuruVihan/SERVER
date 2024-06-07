const express = require('express');
const router = express.Router();

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
const checkAdmin = require('../middleware/checkAdmin');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);
router.use(checkAdmin);

router.route('/')
	.get((req, res) => {
		return res.status(200).json({ isAdmin: true });
	});

module.exports = router;