const express = require('express');
const router = express.Router();
const bcrypt = require("bcrypt");

const multer = require('multer');

// Set up multer middleware for handling multipart/form-data
const storage = multer.memoryStorage(); // Use memory storage for simplicity
const upload = multer({ storage: storage });

// Import database connection
const {poolPromise} = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
const encryptPassword = require("../lib/encryptPassword");
const {uploadFileToFirebaseStorage, deleteFileFromFirebaseStorage} = require("../lib/firebase/firebase");

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);

router.route('')
	.get(async (req, res) => {
		try {
			const pool = await poolPromise;
			const result = await pool.request().query(`
				SELECT 
					e.FirstName, e.LastName, t.Name AS Team, e.Role, e.ContactNumber, e.Email, e.Birthdate, pp.URL AS imageUrl
				FROM Employee e
				LEFT JOIN Team t on e.Team = t.Id
				LEFT JOIN ProfilePicture pp on e.Id = pp.EmployeeId 
				WHERE Email = '${req.user.email}'`);
			return res.status(200).json(result.recordset);
		} catch (err) {
			console.error('Database query error:', err);
			return res.status(500).json({error: 'Internal Server Error'});
		}
	})
	.post(upload.any(), async (req, res) => {
		const data = req.body;

		try {
			const pool = await poolPromise;

			await Promise.all([
				(async () => {
					let updateQuery = `UPDATE Employee SET `;
					let shouldUpdate = false;

					if (data.FirstName) {
						updateQuery += `FirstName = '${data.FirstName}', `;
						shouldUpdate = true;
					}
					if (data.LastName) {
						updateQuery += `LastName = '${data.LastName}', `;
						shouldUpdate = true;
					}
					if (data.ContactNumber) {
						updateQuery += `ContactNumber = '${data.ContactNumber}', `;
						shouldUpdate = true;
					}
					if (data.Birthdate) {
						updateQuery += `Birthdate = '${data.Birthdate}', `;
						shouldUpdate = true;
					}

					// Remove the trailing comma and space
					updateQuery = updateQuery.slice(0, -2);
					updateQuery += ` WHERE Email = '${req.user.email}'`;

					console.log("UPDATE QUERY: ", updateQuery);
					if (shouldUpdate)
						await pool.request().query(updateQuery);
				})(),
				(async () => {
					if (req.files && req.files.length > 0) {
						const currentProfileImageQuery = await pool.request().query(`
							SELECT URL FROM ProfilePicture WHERE EmployeeId = '${req.user.id}'
						`);

						if (currentProfileImageQuery.recordset.length > 0) {
							await pool.request().query(`
								DELETE FROM ProfilePicture WHERE EmployeeId = '${req.user.id}'
							`);

							await deleteFileFromFirebaseStorage(currentProfileImageQuery.recordset[0].URL);
						}

						const attachmentName = ⁠ ${require('crypto').randomBytes(32).toString('hex')}.jpeg ⁠;
						const attachmentURL = await uploadFileToFirebaseStorage(
							req.files[0].buffer,
							attachmentName,
							'image/jpeg',
							'profile-pictures/'
						);

						await pool.request().query(`
							INSERT INTO ProfilePicture (EmployeeId, ImageName, URL)
							VALUES (${req.user.id}, '${attachmentName}', '${attachmentURL}');
						`);
					}
				})(),
			]);

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