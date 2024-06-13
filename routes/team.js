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
						WHERE e.Status = '1'
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
	.post(checkAdmin, async (req, res) => {
		const {name, client, newTeamLeadEmail} = req.body;

		const emptyName = name.trim().length === 0;
		const emptyClient = client.trim().length === 0;
		if (emptyName || emptyClient)
			return res.status(400).json({message: "Incomplete data"});

		try {
			const pool = await poolPromise;

			const alreadyExistTeamQuery = await pool.request().query(`
				SELECT Id FROM Team WHERE Name = '${name.trim()}'
			`);
			if (alreadyExistTeamQuery.recordset.length > 0)
				return res.status(400).json({message: "Team with a similar name already exists"});

			if (newTeamLeadEmail !== "") {
				const employeeIdQuery = await pool.request().query(`
					SELECT Id FROM Employee WHERE Email = '${newTeamLeadEmail}'
				`);
				if (employeeIdQuery.recordset.length === 0)
					return res.status(400).json({message: "Employee doesn't exists"});

				const teamIdQuery = await pool.request().query(`
					SELECT Team FROM Employee WHERE Id = '${employeeIdQuery.recordset[0].Id}'
				`);
				if (teamIdQuery.recordset[0].Team !== null)
					return res.status(400).json({message: "Employee already allocated to a team"});

				const createNewTeamQuery = await pool.request().query(`
					DECLARE @InsertedRows TABLE (Id INT);
					INSERT INTO Team (Name, Lead, Client)
					OUTPUT INSERTED.Id INTO @InsertedRows
					VALUES ('${name}', '${employeeIdQuery.recordset[0].Id}', '${client}');
					SELECT Id FROM @InsertedRows;
				`);

				await pool.request().query(`
					UPDATE Employee 
					SET Team = '${createNewTeamQuery.recordset[0].Id}' 
					WHERE Id = '${employeeIdQuery.recordset[0].Id}'
				`);

				return res.status(200).json({message: "New team has been created successfully"});
			}

			await pool.request().query(`
				INSERT INTO Team (Name, Lead, Client)
				VALUES ('${name}', NULL, '${client}')
			`);

			return res.status(200).json({message: "New team has been created successfully"});
		} catch (error) {
			console.log(error);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	})
	.put(checkAdmin, async (req, res) => {
		const {id, name, client, members} = req.body.team;

		const emptyName = name.trim().length === 0;
		const emptyClient = client.trim().length === 0;
		if (emptyName || emptyClient)
			return res.status(400).json({message: "Incomplete data"});

		try {
			const pool = await poolPromise;

			const oldTeamExistTeamQuery = await pool.request().query(`
				SELECT Id FROM Team WHERE Id = '${id}'
			`);
			if (oldTeamExistTeamQuery.recordset.length === 0)
				return res.status(400).json({message: "Team doesn't exists"});

			const alreadyExistTeamQuery = await pool.request().query(`
				SELECT Id FROM Team WHERE Name = '${name.trim()}' AND Id != '${id}'
			`);
			if (alreadyExistTeamQuery.recordset.length > 0)
				return res.status(400).json({message: "A team with the same name already exists"});

			await pool.request().query(`
				UPDATE Employee SET Team = NULL, [Role] = '' WHERE Team = '${id}'
			`);

			const memberEmails = members.map(m => `'${m.email}'`);

			await pool.request().query(`
				UPDATE Employee SET Team = '${id}' WHERE Email IN (${memberEmails})
			`);

			const memberRoleUpdateQueries = [];
			members.map(async (m) => {
				memberRoleUpdateQueries.push(`
					UPDATE Employee SET [Role] = '${m.role}' WHERE Email = '${m.email}';
				`);
			});
			await pool.request().query(`${memberRoleUpdateQueries.join("")}`);

			const teamLeadObj = members.filter(m => m.isTL);
			if (teamLeadObj.length > 0) {
				const teamLeadIdQuery = await pool.request().query(`
					SELECT Id FROM Employee WHERE Email = '${teamLeadObj[0].email}'
				`);

				await pool.request().query(`
					UPDATE Team
					SET Lead = '${teamLeadIdQuery.recordset[0].Id}', Name = '${name}', Client = '${client}'
					WHERE Id = '${id}'
				`);
			} else {
				await pool.request().query(`
					UPDATE Team SET Lead = NULL, Name = '${name}', Client = '${client}' WHERE Id = '${id}'
				`);
			}

			return res.status(200).json({message: "Team has been updated successfully"});
		} catch (error) {
			console.log(error);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	})
	.delete(checkAdmin, async (req, res) => {
		const {teamId} = req.body;

		try {
			const pool = await poolPromise;

			const alreadyExistTeamQuery = await pool.request().query(`
				SELECT Id FROM Team WHERE Id = '${teamId}'
			`);
			if (alreadyExistTeamQuery.recordset.length === 0)
				return res.status(400).json({message: "Team doesn't exists"});

			await pool.request().query(`
				UPDATE Employee SET Team = NULL WHERE Team = '${teamId}'
			`);

			await pool.request().query(`
				DELETE FROM Team WHERE Id = '${teamId}'
			`);

			return res.status(200).json({message: "Team has been deleted successfully"});
		} catch (error) {
			console.log(error);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	});

module.exports = router;