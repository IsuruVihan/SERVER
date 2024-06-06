const express = require('express');
const router = express.Router();

// Import database connection
const { poolPromise } = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
const checkAdmin = require('../middleware/checkAdmin');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);

router.route('/')
	.get(async (req, res) => {
		try {
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
		} catch (error) {
			console.log(error);
			return res.status(500).json({ message: "Unexpected error occurred" });
		}
	})
	.post(checkAdmin, async (req, res) => {
		try {
			if (!req.body.title || !req.body.description)
				return res.status(400).json({ message: "Both title and description required" });

			const pool = await poolPromise;

			const alreadyExistNoticeQuery = await pool.request().query(`
				SELECT Id
				FROM SpecialNotice
				WHERE Title = '${req.body.title.trim()}'
			`);

			if (alreadyExistNoticeQuery.recordset.length > 0)
				return res.status(400).json({ message: "A notice with the same title already exist" });

			const today = new Date();
			const year = today.getFullYear();
			const month = (today.getMonth() + 1) < 10 ? "0" + (today.getMonth() + 1) : (today.getMonth() + 1);
			const date = today.getDate() < 10 ? "0" + today.getDate() : today.getDate();
			const hours = today.getHours() < 10 ? "0" + today.getHours() : today.getHours();
			const minutes = today.getMinutes() < 10 ? "0" + today.getMinutes() : today.getMinutes();
			const seconds = today.getSeconds() < 10 ? "0" + today.getSeconds() : today.getSeconds();

			const createNoticeQuery = await pool.request().query(`
				INSERT INTO SpecialNotice (AuthorId, PublishedOn, Title, Description)
				VALUES (
					'${req.user.id}', '${year}-${month}-${date} ${hours}:${minutes}:${seconds}', '${req.body.title.trim()}', 
					'${req.body.description.trim()}'
				);
			`);

			return res.status(200).json({ message: "Special notice created successfully" });
		} catch (error) {
			console.log(error);
			return res.status(500).json({ message: "Unexpected error occurred" });
		}
	})
	.put(checkAdmin, async (req, res) => {
		try {
			if (!req.body.title || !req.body.description || !req.body.noticeId)
				return res.status(400).json({ message: "Incomplete data" });

			const pool = await poolPromise;

			const checkNoticeExistQuery = await pool.request().query(`
				SELECT Id
				FROM SpecialNotice
				WHERE Id = '${req.body.noticeId}'
			`);

			if (checkNoticeExistQuery.recordset.length === 0)
				return res.status(400).json({ message: "Notice doesn't exist" });

			const deleteNoticeViewsQuery = await pool.request().query(`
				DELETE FROM ViewedSpecialNotices
				WHERE SpecialNoticeId = '${req.body.noticeId}';
			`);

			const updateQuery = await pool.request().query(`
				UPDATE SpecialNotice
				SET Title = '${req.body.title}', Description = '${req.body.description}'
				WHERE Id = '${req.body.noticeId}';
			`);

			return res.status(200).json({ message: "Notice updated successfully" });
		} catch (error) {
			console.log(error);
			return res.status(500).json({ message: "Unexpected error occurred" });
		}
	})
	.delete(checkAdmin, async (req, res) => {
		try {
			if (!req.body.noticeId)
				return res.status(400).json({ message: "Notice ID required" });

			const pool = await poolPromise;

			const checkNoticeExistQuery = await pool.request().query(`
				SELECT Id
				FROM SpecialNotice
				WHERE Id = '${req.body.noticeId}'
			`);

			if (checkNoticeExistQuery.recordset.length === 0)
				return res.status(400).json({ message: "Notice doesn't exist" });

			const deleteViewsQuery = await pool.request().query(`
				DELETE FROM ViewedSpecialNotices
				WHERE SpecialNoticeId = '${req.body.noticeId}';
			`);

			const deleteNoticeQuery = await pool.request().query(`
				DELETE FROM SpecialNotice
				WHERE Id = '${req.body.noticeId}';
			`);

			return res.status(200).json({});
		} catch (error) {
			console.log(error);
			return res.status(500).json({ message: "Unexpected error occurred" });
		}
	});

router.route('/mark-as-viewed')
	.post(async (req, res) => {
		try {
			if (!req.body.noticeId)
				return res.status(400).json({ message: "Notice ID required" });

			const pool = await poolPromise;

			const checkNoticeExistQuery = await pool.request().query(`
				SELECT Id
				FROM SpecialNotice
				WHERE Id = '${req.body.noticeId}'
			`);

			if (checkNoticeExistQuery.recordset.length === 0)
				return res.status(400).json({ message: "Notice doesn't exist" });

			const noticeAlreadyViewedQuery = await pool.request().query(`
				SELECT Id
				FROM ViewedSpecialNotices
				WHERE EmployeeId = '${req.user.id}' AND SpecialNoticeId = '${req.body.noticeId}'
			`);

			if (noticeAlreadyViewedQuery.recordset.length > 0)
				return res.status(400).json({ message: "Notice already viewed" });

			const today = new Date();
			const year = today.getFullYear();
			const month = (today.getMonth() + 1) < 10 ? "0" + (today.getMonth() + 1) : (today.getMonth() + 1);
			const date = today.getDate() < 10 ? "0" + today.getDate() : today.getDate();
			const hours = today.getHours() < 10 ? "0" + today.getHours() : today.getHours();
			const minutes = today.getMinutes() < 10 ? "0" + today.getMinutes() : today.getMinutes();
			const seconds = today.getSeconds() < 10 ? "0" + today.getSeconds() : today.getSeconds();

			const viewNoticeQuery = await pool.request().query(`
				INSERT INTO ViewedSpecialNotices (SpecialNoticeId, EmployeeId, ViewedOn)
				VALUES ('${req.body.noticeId}', '${req.user.id}', '${year}-${month}-${date} ${hours}:${minutes}:${seconds}');
			`);

			return res.status(200).json({});
		} catch (error) {
			console.log(error);
			return res.status(500).json({ message: "Unexpected error occurred" });
		}
	});

module.exports = router;