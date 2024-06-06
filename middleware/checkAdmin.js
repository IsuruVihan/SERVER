const { poolPromise } = require('../lib/database');

const checkAdmin = async (req, res, next) => {
	const {id} = req.user;

	const pool = await poolPromise;
	const adminQuery = await pool.request().query(`SELECT Id FROM Employee WHERE IsAdmin = '1' AND Id = '${id}'`);
	if (adminQuery.recordset.length > 0) {
		req.user.admin = true;
		next();
	} else {
		return res.status(403).json({ message: "Access denied" });
	}
}

module.exports = checkAdmin;