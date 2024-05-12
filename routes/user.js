const express = require('express');
const router = express.Router();

// Import database connection
const { poolPromise } = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);

router.route('/')
	.get(async (req, res) => {
		const pool = await poolPromise;
		const result = await pool.request().query(`SELECT Name FROM Employee WHERE email = '${req.user.email}'`);
		res.status(200).json(result.recordset[0].Name);
	});

module.exports = router;