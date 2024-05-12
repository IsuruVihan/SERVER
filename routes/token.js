const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const generateAccessToken = require("../lib/generateAccessToken");

// Import route middlewares
const logger = require("../middleware/logger");

// Use route middlewares
router.use(logger);

router.route('')
	.post((req, res) => {
		const refreshToken = req.body.token;

		if (refreshToken == null)
			return res.sendStatus(401);

		jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
			if (err)
				return res.status(403).json({ message: "Login required" });
			const accessToken = generateAccessToken({ name: user.name });
			return res.status(200).json({ accessToken });
		});
	});

module.exports = router;