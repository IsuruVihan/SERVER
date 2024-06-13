const express = require('express');
const router = express.Router();
const isValidEmail = require("../lib/isValidEmail");
const generateRandomPassword = require("../lib/generateRandomPassword");
const encryptPassword = require("../lib/encryptPassword");

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

			const employeesQuery = await pool.request().query(`
				SELECT 
					e.Id AS id, e.FirstName AS firstName, e.LastName AS lastName, e.Email AS email, e.Role AS role, 
					e.IsAdmin AS isAdmin, e.Birthdate AS birthDay, t.Name AS team, t.Lead AS isTL
				FROM Employee e
				LEFT JOIN Team t ON e.Team = t.Id
				WHERE e.Status = '1'
			`);
			const results = employeesQuery.recordset.map((r) => {
				const year = r.birthDay ? r.birthDay.getFullYear() : '';
				const month = r.birthDay ? r.birthDay.getMonth() + 1 : '';
				const date = r.birthDay ? r.birthDay.getDate() : '';
				return {
					...r,
					id: undefined,
					isTL: r.id === r.isTL,
					isAdmin: r.isAdmin === 1,
					birthDay: `${year}-${month < 10 ? '0' + month : month}-${date < 10 ? '0' + date : date}`,
					imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=4&w=256&h=256&q=60"
				};
			});
			return res.status(200).json({employees: results});
		} catch (e) {
			console.log(e);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	})
	.post(checkAdmin, async (req, res) => {
		const {firstName, lastName, email, team, role} = req.body;

		let teamId = '';
		const emptyFirstName = firstName.trim().length === 0;
		const emptyLastName = lastName.trim().length === 0;
		const emptyEmail = email.trim().length === 0;
		if (emptyFirstName || emptyLastName || emptyEmail)
			return res.status(400).json({message: "Incomplete data"});

		const invalidEmail = !isValidEmail(email);
		if (invalidEmail)
			return res.status(400).json({message: "Invalid email"});

		try {
			const pool = await poolPromise;

			const alreadyExistEmailQuery = await pool.request().query(`
				SELECT Id FROM Employee WHERE Email = '${email}'
			`);
			if (alreadyExistEmailQuery.recordset.length > 0)
				return res.status(400).json({message: "Employee email already exists"});

			if (team) {
				const teamsQuery = await pool.request().query(`
					SELECT Id FROM Team WHERE Name = '${team}'
				`);
				if (teamsQuery.recordset.length !== 1)
					return res.status(400).json({message: "Team doesn't exists"});
				teamId = teamsQuery.recordset[0].Id;
			}

			if (role && !["Business Analyst", "Engineer", "Human Resources", "Marketing", "Finance"].includes(role.title))
				return res.status(400).json({message: "Invalid role"});

			const plainPassword = generateRandomPassword(12);
			const hashedPassword = await encryptPassword(plainPassword);

			const data = {
				service_id: process.env.EMAILJS_SERVICE_ID,
				template_id: process.env.EMAILJS_PASSWORD_TEMPLATE_ID,
				user_id: process.env.EMAILJS_USER_ID,
				template_params: {
					'employee': `${firstName.trim()} ${lastName.trim()}`,
					'employeeEmail': email,
					'password': plainPassword,
				}
			};
			await fetch(process.env.EMAILJS_API_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
			})
				.then(async (r) => {
					if (r.status === 200) {
						await pool.request().query(`
							INSERT INTO Employee (Team, [Role], Password, Email, FirstName, LastName, Birthdate, IsAdmin, CasualLeaves, 
								MedicalLeaves, JoinedDate)
							VALUES('${teamId}', '${role.title}', '${hashedPassword}', '${email.trim()}', '${firstName.trim()}', 
							'${lastName.trim()}', NULL, 0, 10, 10, NULL)
						`);

						return res.status(200).json({message: "Employee has been created successfully"});
					}
					console.log(r);
					return res.status(500).json({message: "Unexpected error occurred"});
				});
		} catch (error) {
			console.log(error);
			return res.status(500).json({message: "Unexpected error occurred"});
		}
	})
	.put(checkAdmin, async (req, res) => {
		const {firstName, lastName, email, team, role, birthDay, isTL} = req.body;

		const emptyFirstName = firstName.trim().length === 0;
		const emptyLastName = lastName.trim().length === 0;
		const emptyEmail = email.trim().length === 0;
		if (emptyFirstName || emptyLastName || emptyEmail)
			return res.status(400).json({message: "Incomplete data"});

		const invalidEmail = !isValidEmail(email);
		if (invalidEmail)
			return res.status(400).json({message: "Invalid email"});

		if (role && !["Business Analyst", "Engineer", "Human Resources", "Marketing", "Finance"].includes(role))
			return res.status(400).json({message: "Invalid role"});

		try {
			const pool = await poolPromise;

			let empId = '';
			let teamId = '';

			await Promise.all([
				(async() => {
					const existingEmailQuery = await pool.request().query(`
						SELECT Id FROM Employee WHERE Email = '${email}'
					`);
					if (existingEmailQuery.recordset.length === 0)
						return res.status(400).json({message: "Employee email doesn't exists"});
					empId = existingEmailQuery.recordset[0].Id;
				})(),
				(async() => {
					if (team) {
						if (team === "ADMIN")
							return res.status(403).json({message: "Invalid team"});

						const teamsQuery = await pool.request().query(`
							SELECT Id FROM Team WHERE Name = '${team}'
						`);
						if (teamsQuery.recordset.length !== 1)
							return res.status(400).json({message: "Team doesn't exists"});
						teamId = teamsQuery.recordset[0].Id;
					}
				})(),
			]);

			await Promise.all([
				(async() => {
					await pool.request().query(`
						UPDATE Employee
						SET 
							Team = '${teamId}', [Role] = '${role}', FirstName = '${firstName.trim()}', 
							LastName = '${lastName.trim()}', Birthdate = '${birthDay}' 
						WHERE Id = '${empId}'
					`);
				})(),
				(async() => {
					if (team && isTL) {
						await pool.request().query(`
							UPDATE Team SET Lead = '${empId}' WHERE Id = '${teamId}';
						`);
					}
				})(),
			]);

			return res.status(200).json({message: "Employee account has been updated successfully"});
		} catch (error) {
			console.log(error);
			return res.status(500).json({message: "Unexpected error occurred"});
		}
	})
	.delete(checkAdmin, async (req, res) => {
		const {email, isTL} = req.body;

		if (email.trim().length === 0)
			return res.status(400).json({message: "Incomplete data"});

		const invalidEmail = !isValidEmail(email);
		if (invalidEmail)
			return res.status(400).json({message: "Invalid email"});

		try {
			const pool = await poolPromise;

			let empId = '';

			const existingEmailQuery = await pool.request().query(`
				SELECT Id, IsAdmin FROM Employee WHERE Email = '${email}'
			`);
			if (existingEmailQuery.recordset.length === 0)
				return res.status(400).json({message: "Employee email doesn't exists"});
			if (existingEmailQuery.recordset[0].IsAdmin === 1)
				return res.status(403).json({message: "Unauthorized"});
			empId = existingEmailQuery.recordset[0].Id;

			await Promise.all([
				(async () => {
					await pool.request().query(`
						UPDATE Employee SET Status = '0' WHERE Id = '${empId}'
					`);
				})(),
				(async () => {
					if (isTL) {
						await pool.request().query(`
							UPDATE Team SET Lead = NULL WHERE Lead = '${empId}'
						`);
					}
				})(),
			]);

			return res.status(200).json({message: "Employee has been deactivated successfully"});
		} catch (error) {
			console.log(error);
			return res.status(500).json({message: "Unexpected error occurred"});
		}
	});

module.exports = router;
