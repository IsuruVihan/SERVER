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
		const fromDate = req.query.from;
		const toDate = req.query.to;

		const pool = await poolPromise;

		const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);

		if (employeeIdQuery.recordset[0]) {
			const employeeId = employeeIdQuery.recordset[0].Id;

			let sql = `SELECT CheckInDate, CheckInTime, CheckOutDate, CheckOutTime FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' ORDER BY CheckInDate DESC`;
			if (fromDate && toDate) {
				sql = `SELECT CheckInDate, CheckInTime, CheckOutDate, CheckOutTime FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' AND CheckInDate >= '${fromDate}' AND CheckInDate <= '${toDate}' ORDER BY CheckInDate DESC`;
			}

			const attendanceQuery = await pool.request().query(sql);
			if (attendanceQuery.recordset) {
				return res.status(200).json({ data: attendanceQuery.recordset, userEmail: req.user.email });
			} else {
				return res.status(200).json({ data: null, userEmail: req.user.email });
			}
		} else {
			return res.status(404).json({ message: "User not found" });
		}
	});

//Check-In Handling
router.route('/check-in')
	.get(async (req, res) => {
		const today = req.query.date;
		if (!today)
			return res.status(400).json({
				message: "Date not provided"
			});

		const pool = await poolPromise;

		const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
		if (employeeIdQuery.recordset[0]) {
			const employeeId = employeeIdQuery.recordset[0].Id;

			const checkedInQuery = await pool.request().query(`SELECT CheckInTime FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' AND CheckInDate = '${today}'`);
			if (checkedInQuery.recordset[0]) {
				return res.status(200).json({
					date: today,
					time: checkedInQuery.recordset[0].CheckInTime,
				});
			} else {
				return res.status(200).json({
					date: null,
					time: null,
				});
			}
		} else {
			return res.status(404).json({
				message: "User not found"
			});
		}
	})
	.post(async (req, res) => {
		const {date, time} = req.body;
		const pool = await poolPromise;

		const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
		if (employeeIdQuery.recordset[0]) {
			const employeeId = employeeIdQuery.recordset[0].Id;

			const alreadyCheckedInQuery = await pool.request().query(`SELECT EmployeeId FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' AND CheckInDate = '${date}'`);
			if (alreadyCheckedInQuery.recordset.length > 0) {
				return res.status(400).json({
					message: "Already checked-in"
				});
			}

			await pool.request().query(`INSERT INTO AttendanceRecord (EmployeeId, CheckInDate, CheckInTime) VALUES ('${employeeId}', '${date}', '${time}')`);
			return res.status(200).json({
				message: "Checked-in successfully"
			});
		} else {
			return res.status(404).json({
				message: "User not found"
			});
		}
	});

//Check-Out Handling
router.route('/check-out')
	.get(async (req, res) => {
		const today = req.query.date;
		if (!today)
			return res.status(400).json({
				message: "Date not provided"
			});

		const pool = await poolPromise;

		const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
		if (employeeIdQuery.recordset[0]) {
			const employeeId = employeeIdQuery.recordset[0].Id;

			const checkedOutQuery = await pool.request().query(`SELECT CheckOutTime FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' AND CheckOutDate = '${today}'`);
			if (checkedOutQuery.recordset[0]) {
				return res.status(200).json({
					date: today,
					time: checkedOutQuery.recordset[0].CheckOutTime,
				});
			} else {
				return res.status(200).json({
					date: null,
					time: null,
				});
			}
		} else {
			return res.status(404).json({
				message: "User not found"
			});
		}
	})
	// .post(async (req, res) => {
	// 	const {date, time} = req.body;

	// 	const pool = await poolPromise;

	// 	const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
	// 	const employeeId = employeeIdQuery.recordset[0].Id;

	// 	// Check for the checked-in employee
	// 	const alreadyCheckedInQuery = await pool.request().query(`SELECT EmployeeId FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' AND CheckInDate = '${date}' AND CheckOutDate IS NULL 
    //     AND CheckOutTime IS NULL`);
	// 	if (alreadyCheckedInQuery.recordset.length > 0) {
	// 		// Update attendance record
	// 		const updateRecordQuery = await pool.request().query(`UPDATE AttendanceRecord SET CheckOutDate = '${date}', CheckOutTime = '${time}' WHERE EmployeeId = '${employeeId}' AND CheckInDate = '${date}'`);
	// 		return res.status(200).json({
	// 			message: "Checked-out successfully"
	// 		});
	// 	}

	// 	return res.status(400).json({
	// 		message: "Already checked-out or not checked-in"
	// 	});
	// });

    .post(async (req, res) => {
        const { date, time } = req.body;

        const pool = await poolPromise;

        const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
        const employeeId = employeeIdQuery.recordset[0].Id;

        // Check if the employee has checked in on the given date
        const checkInQuery = await pool.request().query(`SELECT * FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' AND CheckInDate = '${date}'`);
        if (checkInQuery.recordset.length === 0) {
            return res.status(400).json({
                message: "Not checked-in on the provided date"
            });
        }

        // Insert a new check-out record
        const insertRecordQuery = await pool.request().query(`
            INSERT INTO AttendanceRecord (EmployeeId, CheckOutDate, CheckOutTime)
            VALUES ('${employeeId}', '${date}', '${time}')
        `);

        return res.status(200).json({
            message: "Checked-out successfully"
        });
    });


module.exports = router;