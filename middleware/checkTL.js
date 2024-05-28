const { poolPromise } = require('../lib/database');

const checkTL = async (req, res, next) => {
	const {id} = req.user;

	const pool = await poolPromise;
	const teamLeadQuery = await pool.request().query(`SELECT Id FROM Team WHERE Lead = '${id}'`);
	if (teamLeadQuery.recordset[0]) {
		req.user.teamLead = true;
		req.user.teamId = teamLeadQuery.recordset[0].Id;
		next();
	} else {
		return res.status(403).json({ message: "Access denied" });
	}
}

module.exports = checkTL;