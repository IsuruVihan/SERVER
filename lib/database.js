const sql = require('mssql');

const config = {
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	server: process.env.DB_SERVER,
	database: process.env.DB_NAME,
	options: {
		encrypt: true, // for Azure SQL
		trustServerCertificate: true // change to true for local dev/test
	}
};

const poolPromise = new sql.ConnectionPool(config)
	.connect()
	.then(pool => {
		console.log('Connected to database');
		return pool;
	})
	.catch(err => {
		console.error('Database connection failed:', err);
		throw err;
	});

module.exports = { poolPromise, sql };