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
		
		const pool = await poolPromise;
		const teamLeaveRequestsQuery = await pool.request().query(
			`SELECT lr.*, e.FirstName AS EmployeeFirstName, e.LastName AS EmployeeLastName, e.Email AS EmployeeEmail FROM LeaveRequest lr INNER JOIN Employee e ON e.Id = lr.CreatedBy WHERE e.Id IN (SELECT Lead FROM Team)`
		);

		return res.status(200).json({ leaveRequests: teamLeaveRequestsQuery.recordset });
	});

router.route('/accept')
	.post(async (req, res) => {
		const {requestId} = req.body;

		const pool = await poolPromise;
		const leaveRequestQuery = await pool.request().query(`SELECT Id FROM LeaveRequest WHERE Id = ${requestId}`);
		if (leaveRequestQuery.recordset.length > 0) {
			await pool.request().query(
				`UPDATE LeaveRequest SET Status = 'Accepted' WHERE Id = '${requestId}' AND Status = 'Processing'`
			);
			return res.status(200).json({ message: "Leave request accepted successfully" });
		} else {
			return res.status(404).json({ message: "Invalid leave request" });
		}
	});

router.route('/reject')
	.post(async (req, res) => {
		const {requestId} = req.body;

		const pool = await poolPromise;
		const leaveRequestQuery = await pool.request().query(`SELECT Id FROM LeaveRequest WHERE Id = ${requestId}`);

		if (leaveRequestQuery.recordset.length > 0) {
			await pool.request().query(
				`UPDATE LeaveRequest SET Status = 'Rejected' WHERE Id = '${requestId}' AND Status = 'Processing'`
			);
			return res.status(200).json({ message: "Leave request rejected successfully" });
		} else {
			return res.status(404).json({ message: "Invalid leave request" });
		}
	});

module.exports = router;