const express = require('express');
const router = express.Router();

// Import database connection
const { poolPromise } = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);

//Check-In Handling
router.route('/check-in')
	.post(async (req, res) => {
        const {date, time} = req.body;

		const pool = await poolPromise;
		
        const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
        const employeeId = employeeIdQuery.recordset[0].Id;

        // Check for already checked-in employee
        const alreadyCheckedInQuery = await pool.request().query(`SELECT EmployeeId FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' AND CheckInDate = '${date}'`);
		if (alreadyCheckedInQuery.recordset.length > 0) {
            return res.status(400).json({
                message: "Already checked-in"
            });
        }

        // Insert attendance record
        const createRecordQuery = await pool.request().query(`INSERT INTO AttendanceRecord (EmployeeId, CheckInDate, CheckInTime) VALUES ('${employeeId}', '${date}', '${time}')`);
        res.status(200).json({
			message: "Checked-in successfully"
		});
	});

//Check-Out Handling
router.route('/check-out')
	.post(async (req, res) => {
        const {date, time} = req.body;

		const pool = await poolPromise;
		
        const employeeIdQuery = await pool.request().query(`SELECT Id FROM Employee WHERE email = '${req.user.email}'`);
        const employeeId = employeeIdQuery.recordset[0].Id;

        // Check for the checked-in employee
        const alreadyCheckedInQuery = await pool.request().query(`SELECT EmployeeId FROM AttendanceRecord WHERE EmployeeId = '${employeeId}' AND CheckInDate = '${date}' AND CheckOutDate IS NULL 
        AND CheckOutTime IS NULL`);
		if (alreadyCheckedInQuery.recordset.length> 0) {
            // Update attendance record
            const updateRecordQuery = await pool.request().query(`UPDATE AttendanceRecord SET CheckOutDate = '${date}', CheckOutTime = '${time}' WHERE EmployeeId = '${employeeId}' AND CheckInDate = '${date}'`);
            res.status(200).json({
			    message: "Checked-out successfully"
		    });   
        }

        return res.status(400).json({
            message: "Already checked-out or not checked-in"
        });    
	});

module.exports = router;