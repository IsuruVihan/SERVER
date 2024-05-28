const {poolPromise} = require("../lib/database");

const getEmployeeId = async (req, res, next) => {
	const {user} = req;

	const pool = await poolPromise;
	const employeeIdQuery
		= await pool.request().query(`SELECT Id FROM Employee WHERE email = '${user.email}'`);
	if (employeeIdQuery.recordset[0]) {
		req.user.id = employeeIdQuery.recordset[0].Id;
		next();
	} else {
		return res.status(404).json({message: "User not found"});
	}
}

module.exports = getEmployeeId;