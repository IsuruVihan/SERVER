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

        const fromDate = req.query.from;
		const toDate = req.query.to;
        console.log(req.body)

		const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${email}'`);

		if (employeeIdQuery.recordset[0]) {
			const employeeId = employeeIdQuery.recordset[0].Id;

			let sql = `SELECT CheckInDate, CheckInTime, CheckOutDate, CheckOutTime FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' ORDER BY CheckInDate DESC`;
			if (fromDate && toDate) {
				sql = `SELECT CheckInDate, CheckInTime, CheckOutDate, CheckOutTime FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' AND CheckInDate >= '${fromDate}' AND CheckInDate <= '${toDate}' ORDER BY CheckInDate DESC`;
			}

			const attendanceQuery = await pool.request().query(sql);
			if (attendanceQuery.recordset) {
				return res.status(200).json({ data: attendanceQuery.recordset, userEmail: email });
			} else {
				return res.status(200).json({ data: null, userEmail: email });
			}
		} else {
			return res.status(404).json({ message: "User not found" });
		}
    
    });









module.exports = router;