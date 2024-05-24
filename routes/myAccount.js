const express = require('express');
const router = express.Router();

const multer = require('multer');

// Set up multer middleware for handling multipart/form-data
const upload = multer();

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
		try {
			const pool = await poolPromise;
			const result = await pool.request().query(`SELECT FirstName, LastName, Team, Role, ContactNumber, Email, Birthdate FROM Employee WHERE Email = '${req.user.email}'`);
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
			return res.status(200).json({error: err});
		}
	});

// router.route('/:email')
// 	.get(async (req, res) => {
// 		const pool = await poolPromise;
// 		const result = await pool.request().query(`SELECT * FROM Employee WHERE email = '${req.user}'`);
// 		res.status(200).json(result.recordset);
// 	})
// 	.post((req, res) => {
// 		res.status(200).json({message: "POST /users/:id " + req.params.id});
// 	});

// router.param('id', (req, res, next, id) => {
// 	console.log(`Id: ${id}`);
// 	next();
// });

module.exports = router;