const { poolPromise } = require('../lib/database');

const checkTlOrAdmin = async (req, res, next) => {
	const {id} = req.user;

	const pool = await poolPromise;

	const teamLeadQuery = await pool.request().query(`SELECT Id FROM Team WHERE Lead = '${id}'`);
	const adminQuery = await pool.request().query(`SELECT Id FROM Employee WHERE IsAdmin = '1' AND Id = '${id}'`);

	if (adminQuery.recordset.length > 0 || teamLeadQuery.recordset.length > 0) {
		req.user.admin = adminQuery.recordset.length > 0;
		req.user.teamLead = teamLeadQuery.recordset.length > 0;
		req.user.teamId = teamLeadQuery.recordset.length > 0 ? teamLeadQuery.recordset[0].Id : null;
		next();
	} else {
		return res.status(403).json({ message: "Access denied" });
	}
}

module.exports = checkTlOrAdmin;