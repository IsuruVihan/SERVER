const express = require('express');
const router = express.Router();

// Import database connection
const { poolPromise } = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
const checkTlOrAdmin = require('../middleware/checkTlOrAdmin');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);
router.use(checkTlOrAdmin);

router.route('/')
	.get(async (req, res) => {
		const {admin, teamId} = req.user;

		const pool = await poolPromise;
		let teamMembersQuery;

		if (admin) {
			teamMembersQuery = await pool.request().query(`
				SELECT e.Id, e.FirstName, e.LastName, e.Email, e.Role 
				FROM Employee e 
				WHERE e.Id IN (SELECT Lead FROM Team)
			`);
		} else {
			teamMembersQuery = await pool.request().query(`
				SELECT Id, FirstName, LastName, Email, Role 
				FROM Employee 
				WHERE Team = ${teamId} AND Id != '${req.user.id}'
			`);
		}

		return res.status(200).json({ team: teamMembersQuery.recordset });
	});

module.exports = router;