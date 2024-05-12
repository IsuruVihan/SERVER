const express = require('express');
const router = express.Router();

// Import database connection
const { poolPromise } = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);

router.route('')
	.get(async (req, res) => {
		try {
			const pool = await poolPromise;
			const result = await pool.request().query('SELECT * FROM Employee');
			res.status(200).json(result.recordset);
		} catch (err) {
			console.error('Database query error:', err);
			res.status(500).json({ error: 'Internal Server Error' });
		}
	})
	.post((req, res) => {
		res.status(200).json({message: "POST /users"});
	});

router.route('/:email')
	.get(async (req, res) => {
		const pool = await poolPromise;
		const result = await pool.request().query(`SELECT * FROM Employee WHERE email = '${req.user}'`);
		res.status(200).json(result.recordset);
	})
	.post((req, res) => {
		res.status(200).json({message: "POST /users/:id " + req.params.id});
	});

router.param('id', (req, res, next, id) => {
	console.log(`Id: ${id}`);
	next();
});

module.exports = router;