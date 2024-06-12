const bcrypt = require('bcrypt');

const encryptPassword = async (password) => {
	const saltRounds = 10;
	try {
		return await bcrypt.hash(password, saltRounds);
	} catch (error) {
		console.error('Error encrypting password:', error);
		throw error;
	}
}

module.exports = encryptPassword;