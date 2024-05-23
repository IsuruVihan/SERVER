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
		const result = await pool.request().query(`SELECT FirstName, LastName FROM Employee WHERE email = '${req.user.email}'`);
		return res.status(200).json({
			firstName: result.recordset[0].FirstName,
			lastName: result.recordset[0].LastName
		});
	});

module.exports = router;