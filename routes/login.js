const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();

const { poolPromise } = require('../lib/database');

const generateAccessToken = require('../lib/generateAccessToken');
const generateRefreshToken = require('../lib/generateRefreshToken');

router.route('')
	.post(async (req, res) => {
		const { email, password } = req.body;
		if (email == null || password == null)
			return res.sendStatus(400);

		try {
			const pool = await poolPromise;
			const result = await pool.request()
				.input('email', email)
				.query('SELECT Password FROM Employee WHERE Email = @email');

			bcrypt.compare(password, result.recordset[0].Password, function(err, result) {
				if (err) {
					return res.status(500).json({ message: "Internal Server Error" });
				} else if (result) {
					const user = { email };
					const accessToken = generateAccessToken(user);
					const refreshToken = generateRefreshToken(user);
					return res.status(200).json({ message: "Login successful", accessToken, refreshToken });
				} else {
					return res.status(401).json({ message: "Username or password is incorrect" });
				}
			});
		} catch (error) {
			console.error("Error occurred during login:", error);
			return res.status(500).json({ message: "Internal Server Error" });
		}
	});

module.exports = router;