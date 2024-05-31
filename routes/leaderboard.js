const express = require('express');
const router = express.Router();

// Import database connection
const {poolPromise} = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);

router.route('')
	.get(async (req, res) => {
		try {
			const pool = await poolPromise;

			const leaderboardQuery = await pool.request().query(`
				SELECT 
					e.Id as id, 
					CONCAT(e.FirstName, ' ', e.LastName) AS name, 
					e.Email AS email, 
					COALESCE(SUM(c.Points), 0) AS points
				FROM CompletedKTCourse c
				RIGHT JOIN Employee e 
				ON c.EmployeeId = e.Id
				GROUP BY e.Id, e.Email, e.FirstName, e.LastName
				ORDER BY points DESC
			`);

			return res.status(200).json({ leaderboard: leaderboardQuery.recordset });
		} catch (error) {
			return res.status(500).json({ error: error });
		}
	});

module.exports = router;