const express = require('express');
const router = express.Router();

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
const checkAdmin = require('../middleware/checkAdmin');
const {poolPromise} = require("../lib/database");

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);

router.route('/')
	.get(async (req, res) => {
		try {
			const pool = await poolPromise;

			let teamsQuery;
			let teamMembersQuery;
			await Promise.all([
				(async () => {
					teamsQuery = await pool.request().query(`
						SELECT t.Id AS id, t.Name AS name, t.Client AS client
						FROM Team t
					`);
				})(),
				(async () => {
					teamMembersQuery = await pool.request().query(`
						SELECT 
							e.Id, e.FirstName AS firstName, e.LastName AS lastName, e.Email AS email, e.Role AS role, t.Id AS teamId, 
							t.Lead AS isTL
						FROM Employee e
						INNER JOIN Team t ON e.Team = t.Id
					`);
				})(),
			]);

			const teams = teamsQuery.recordset.map((t) => {
				return {
					...t,
					members: teamMembersQuery.recordset.filter((tm) => {
						return t.id === tm.teamId;
					}).map((tm) => {
						return {
							...tm,
							Id: undefined,
							teamId: undefined,
							isTL: tm.isTL === tm.Id,
						};
					}),
				};
			});

			return res.status(200).json({teams});
		} catch (e) {
			console.log(e);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	})
	.post(checkAdmin, (req, res) => {
		// ADD a team
	})
	.put(checkAdmin, (req, res) => {
		// UPDATE a team
	})
	.delete(checkAdmin, (req, res) => {
		// DELETE a team
	});

module.exports = router;