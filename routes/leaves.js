const express = require('express');
const router = express.Router();
const countWeekends = require("../lib/countWeekends");

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
		const pool = await poolPromise;

		const employeeIdQuery
			= await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
		if (employeeIdQuery.recordset[0]) {
			const employeeLeavesQuery
				= await pool.request().query(`SELECT CasualLeaves, MedicalLeaves FROM Employee WHERE email = '${req.user.email}'`);
			const employeeLeaveRequestsQuery
				= await pool.request().query(`SELECT CreatedOn, FromDate, ToDate, Reason, Type, Status FROM LeaveRequest WHERE CreatedBy = '${employeeIdQuery.recordset[0].Id}' ORDER BY CreatedOn DESC`);

			return res.status(200).json({
				CasualLeaves: employeeLeavesQuery.recordset[0].CasualLeaves,
				MedicalLeaves: employeeLeavesQuery.recordset[0].MedicalLeaves,
				LeaveRequests: employeeLeaveRequestsQuery.recordset,
			});
		} else {
			return res.status(404).json({ message: "User not found" });
		}
	})
	.post(async (req, res) => {
		const {CreatedOn, FromDate, ToDate, Reason, Type} = req.body;

		if (!CreatedOn || !FromDate || !ToDate || !Reason || !Type) {
			return res.status(400).json({
				message: "Incomplete body of data"
			});
		}

		if (
			Reason.trim() === "" || new Date(FromDate) < new Date() || new Date(ToDate) < new Date() ||
			new Date(FromDate) > new Date(ToDate)
		) {
			return res.status(400).json({
				message: "Invalid data"
			});
		}

		const pool = await poolPromise;

		const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
		if (!employeeIdQuery.recordset[0]) {
			return res.status(404).json({
				message: "User not found"
			});
		}

		const employeeLeavesQuery
			= await pool.request().query(`SELECT CasualLeaves, MedicalLeaves FROM Employee WHERE email = '${req.user.email}'`);
		const casualLeaves = employeeLeavesQuery.recordset[0].CasualLeaves;
		const medicalLeaves = employeeLeavesQuery.recordset[0].MedicalLeaves;
		const noOfLeaveDays = ((new Date(ToDate) - new Date(FromDate)) / (1000 * 60 * 60 * 24)) - countWeekends(FromDate, ToDate) + 1;
		const overflow = noOfLeaveDays > (Type === "Casual" ? casualLeaves : medicalLeaves);
		if (overflow) {
			return res.status(400).json({
				message: "Invalid data"
			});
		}

		await pool.request().query(`INSERT INTO LeaveRequest (CreatedBy, CreatedOn, FromDate, ToDate, Reason, Type, Status) VALUES ('${employeeIdQuery.recordset[0].Id}', '${CreatedOn}', '${FromDate}', '${ToDate}', '${Reason}', '${Type}', 'Processing')`);
		// if (Type === "Casual") {
		// 	await pool.request().query(`UPDATE Employee SET CasualLeaves = '${casualLeaves - noOfLeaveDays}' WHERE Email = '${req.user.email}'`);
		// } else {
		// 	await pool.request().query(`UPDATE Employee SET MedicalLeaves = '${medicalLeaves - noOfLeaveDays}' WHERE Email = '${req.user.email}'`);
		// }

		return res.status(200).json({
			message: "Leave request submitted successfully"
		});
	})
	.delete(async (req, res) => {
		const {createdOn, from, to, type, reason, status} = req.body;

		if (!createdOn || !from || !to || !type || !reason || !status) {
			return res.status(400).json({
				message: "Incomplete body of data"
			});
		}

		const pool = await poolPromise;

		const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
		if (!employeeIdQuery.recordset[0]) {
			return res.status(404).json({
				message: "User not found"
			});
		}

		await pool.request().query(`DELETE FROM LeaveRequest WHERE CreatedBy = '${employeeIdQuery.recordset[0].Id}' AND CreatedOn = '${createdOn}' AND FromDate = '${from}' AND ToDate = '${to}' AND Type = '${type}' AND Reason = '${reason}' AND Status = '${status}'`);
		return res.status(200).json({
			message: "Leave request deleted successfully"
		});
	});

module.exports = router;