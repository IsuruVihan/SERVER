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
    .post(async (req, res) => {
        const {email} = req.body;
        const pool = await poolPromise;

		const employeeIdQuery
			= await pool.request().query(`SELECT Id FROM Employee WHERE email = '${email}'`);
		if (employeeIdQuery.recordset[0]) {
			const employeeLeavesQuery
				= await pool.request().query(`SELECT CasualLeaves, MedicalLeaves FROM Employee WHERE email = '${email}'`);
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
    
    });









module.exports = router;