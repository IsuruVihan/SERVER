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
		const result = await pool.request().query(`
			SELECT e.FirstName, e.LastName, pp.URL 
			FROM Employee e
			LEFT JOIN ProfilePicture pp ON e.Id = pp.EmployeeId 
			WHERE email = '${req.user.email}'
		`);
		return res.status(200).json({
			firstName: result.recordset[0].FirstName,
			lastName: result.recordset[0].LastName,
			profilePicture: result.recordset[0].URL,
		});
	});

module.exports = router;