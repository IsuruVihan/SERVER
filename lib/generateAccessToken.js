const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
	return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1w' });
}

module.exports = generateAccessToken;
