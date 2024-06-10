const express = require('express');
const router = express.Router();

// Import database connection
const { poolPromise } = require('../lib/database');

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
	.get(async (req, res) => {
		const {teamId} = req.user;

		const pool = await poolPromise;
		const teamMembersQuery = await pool.request().query(`SELECT e.Id, e.FirstName, e.LastName, e.Email, e.Role FROM Employee e WHERE e.Id IN (SELECT Lead FROM Team)`);
		return res.status(200).json({ team: teamMembersQuery.recordset });
	});

module.exports = router;