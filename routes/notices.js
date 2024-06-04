const express = require('express');
const router = express.Router();

// Import database connection
const { poolPromise } = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
// const checkAdmin = require('../middleware/checkAdmin');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);
// router.use(checkTL);

router.route('/')
	.get(async (req, res) => {
		const pool = await poolPromise;

		const specialNoticesQuery = await pool.request().query(`
			SELECT sn.Id, sn.Title, sn.Description, sn.PublishedOn, e.FirstName, e.LastName
			FROM SpecialNotice sn
			INNER JOIN Employee e ON e.Id = sn.AuthorId
			ORDER BY sn.PublishedOn DESC
		`);

		const viewedSpecialNotices = await pool.request().query(`
			SELECT SpecialNoticeId
			FROM ViewedSpecialNotices
			WHERE EmployeeId = '${req.user.id}'
		`);

		const specialNotices = specialNoticesQuery.recordset.map((n) => {
			if (viewedSpecialNotices.recordset.map((vsn) => vsn.SpecialNoticeId).includes(n.Id))
				return {...n, viewed: true};
			return {...n, viewed: false};
		});

		return res.status(200).json({specialNotices: specialNotices});
	});

router.route('/mark-as-viewed')
	.post(async (req, res) => {
		const {noticeId} = req.body;

		const pool = await poolPromise;

		const query = await pool.request().query(
			``
		);

		return res.status(200).json({});
	});

router.route('/:noticeId')
	.post(async (req, res) => {
		const {noticeId} = req.query;

		const pool = await poolPromise;

		const query = await pool.request().query(
			``
		);

		return res.status(200).json({});
	})
	.put(async (req, res) => {
		const {noticeId} = req.query;

		const pool = await poolPromise;

		const query = await pool.request().query(
			``
		);

		return res.status(200).json({});
	})
	.delete(async (req, res) => {
		const {noticeId} = req.query;

		const pool = await poolPromise;

		const query = await pool.request().query(
			``
		);

		return res.status(200).json({});
	});

module.exports = router;