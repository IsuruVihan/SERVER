const express = require('express');
const router = express.Router();
const bcrypt = require("bcrypt");

const multer = require('multer');

// Set up multer middleware for handling multipart/form-data
const upload = multer();

// Import database connection
const {poolPromise} = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
const encryptPassword = require("../lib/encryptPassword");

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);

router.route('')
	.get(async (req, res) => {
		try {
			const pool = await poolPromise;
			const result = await pool.request().query(`
				SELECT e.FirstName, e.LastName, t.Name AS Team, e.Role, e.ContactNumber, e.Email, e.Birthdate 
				FROM Employee e
				LEFT JOIN Team t on e.Team = t.Id 
				WHERE Email = '${req.user.email}'`);
			return res.status(200).json(result.recordset);
		} catch (err) {
			console.error('Database query error:', err);
			return res.status(500).json({error: 'Internal Server Error'});
		}
	})
	.post(upload.none(), async (req, res) => {
		const data = req.body;

		try {
			// Construct the SQL query dynamically based on the received data
			let updateQuery = `UPDATE Employee SET `;

			if (data.FirstName) {
				updateQuery += `FirstName = '${data.FirstName}', `;
			}
			if (data.LastName) {
				updateQuery += `LastName = '${data.LastName}', `;
			}
			if (data.ContactNumber) {
				updateQuery += `ContactNumber = '${data.ContactNumber}', `;
			}
			if (data.Birthdate) {
				updateQuery += `Birthdate = '${data.Birthdate}', `;
			}

			// Remove the trailing comma and space
			updateQuery = updateQuery.slice(0, -2);
			updateQuery += ` WHERE Email = '${req.user.email}'`;

			console.log("UPDATE QUERY: ", updateQuery);
			const pool = await poolPromise;
			await pool.request().query(updateQuery);

			return res.status(200).json({message: "Profile updated successfully"});
		} catch (err) {
			return res.status(500).json({error: err});
		}
	});

router.route('/reset-password')
	.post(async (req, res) => {
		const {currentPassword, newPassword, newPassword2} = req.body;

		const emptyCurrentPassword = currentPassword === "";
		const emptyNewPassword = newPassword === "";
		const emptyNewPassword2 = newPassword2 === "";

		if (emptyCurrentPassword || emptyNewPassword || emptyNewPassword2)
			return res.status(400).json({message: "Incomplete data"});

		if (newPassword !== newPassword2)
			return res.status(400).json({message: "Passwords are not matching"});

		try {
			const pool = await poolPromise;

			const result = await pool.request().query(`
				SELECT Password FROM Employee WHERE Id = '${req.user.id}'
			`);
			bcrypt.compare(currentPassword, result.recordset[0].Password, async function (err, result) {
				if (err) {
					console.log(err);
					return res.status(500).json({message: "An unexpected error occurred"});
				} else if (result) {
					const hashedPassword = await encryptPassword(newPassword);

					await pool.request().query(`
						UPDATE Employee SET Password = '${hashedPassword}' WHERE Id = '${req.user.id}'
					`);

					return res.status(200).json({message: "Password has been changed successfully"});
				} else {
					return res.status(400).json({message: "Initial password is incorrect"});
				}
			});
		} catch (err) {
			return res.status(500).json({error: err});
		}
	});

module.exports = router;