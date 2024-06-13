const express = require('express');
const router = express.Router();
const {poolPromise} = require("../lib/database");
const isValidEmail = require("../lib/isValidEmail");
const generateRandomPassword = require("../lib/generateRandomPassword");
const encryptPassword = require("../lib/encryptPassword");

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
const checkAdmin = require('../middleware/checkAdmin');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);

router.route('/')
	.get(async (req, res) => {
		try {
			const pool = await poolPromise;

			let businessAnalystCountQuery;
			let engineerCountQuery;
			let humanResourcesCountQuery;
			let marketingCountQuery;
			let financeCountQuery;
			let employeeCountQuery;
			let attendanceCountQuery;

			await Promise.all([
				(async () => {
					businessAnalystCountQuery = await pool.request().query(`
						SELECT COUNT(*) AS count FROM Employee WHERE [Role] = 'Business Analyst' AND Status = '1'
					`);
				})(),
				(async () => {
					engineerCountQuery = await pool.request().query(`
						SELECT COUNT(*) AS count FROM Employee WHERE [Role] = 'Engineer' AND Status = '1'
					`);
				})(),
				(async () => {
					humanResourcesCountQuery = await pool.request().query(`
						SELECT COUNT(*) AS count FROM Employee WHERE [Role] = 'Human Resources' AND Status = '1'
					`);
				})(),
				(async () => {
					marketingCountQuery = await pool.request().query(`
						SELECT COUNT(*) AS count FROM Employee WHERE [Role] = 'Marketing' AND Status = '1'
					`);
				})(),
				(async () => {
					financeCountQuery = await pool.request().query(`
						SELECT COUNT(*) AS count FROM Employee WHERE [Role] = 'Finance' AND Status = '1'
					`);
				})(),
				(async () => {
					employeeCountQuery = await pool.request().query(`
						SELECT COUNT(*) AS count FROM Employee WHERE Status = '1'
					`);
				})(),
				(async () => {
					const today = new Date();
					const year = today.getFullYear();
					let month = today.getMonth() + 1;
					let date = today.getDate();
					month = month < 10 ? '0' + month : month;
					date = date < 10 ? '0' + date : date;
					attendanceCountQuery = await pool.request().query(`
						SELECT COUNT(*) AS count 
						FROM AttendanceRecord 
						WHERE CheckInDate = '${year}-${month}-${date}'
					`);
				})(),
			]);

			return res.status(200).json({
				employees: {
					businessAnalyst: businessAnalystCountQuery.recordset[0].count,
					engineer: engineerCountQuery.recordset[0].count,
					humanResources: humanResourcesCountQuery.recordset[0].count,
					marketing: marketingCountQuery.recordset[0].count,
					finance: financeCountQuery.recordset[0].count,
				},
				attendance: {
					total: employeeCountQuery.recordset[0].count,
					present: attendanceCountQuery.recordset[0].count,
				}
			});
		} catch (e) {
			console.log(e);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	});
	// .post(checkAdmin, async (req, res) => {
	// 	const {firstName, lastName, email, team, role, joinedOn} = req.body;
	//
	// 	try {
	// 		const pool = await poolPromise;
	//
	// 		const alreadyExistEmailQuery = await pool.request().query(`
	// 			SELECT Id FROM Employee WHERE Email = '${email}'
	// 		`);
	// 		if (alreadyExistEmailQuery.recordset.length > 0)
	// 			return res.status(400).json({message: "Employee email already exists"});
	//
	//
	// 	} catch (error) {
	// 		console.log(error);
	// 		return res.status(500).json({message: "Unexpected error occurred"});
	// 	}
	// });

module.exports = router;
