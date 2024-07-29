const express = require('express');
const router = express.Router();
const multer = require('multer');

const { uploadFileToFirebaseStorage, deleteFileFromFirebaseStorage } = require('../lib/firebase/firebase');

// Import database connection
const {poolPromise} = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');

// Multer setup
const storage = multer.memoryStorage(); // Use memory storage for simplicity
const upload = multer({ storage: storage });

// Use route middlewares
router.use(upload.any());
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);

router.route('')
	.get(async (req, res) => {
		try {
			const pool = await poolPromise;

			const postDataQuery = await pool.request().query(`
				SELECT 
					p.Id AS id, p.Title AS title, p.Content AS description, p.PublishedOn AS date, pa.URL AS imageUrl, 
					e.FirstName + ' ' + e.LastName AS authorName, pp.URL AS ProfilePicture
				FROM Post p
				INNER JOIN Employee e ON p.AuthorId = e.Id
				LEFT JOIN PostAttachment pa ON p.Id = pa.PostId
				LEFT JOIN ProfilePicture pp ON e.Id = pp.EmployeeId
				ORDER BY p.Id DESC;
			`);

			return res.status(200).json({posts: postDataQuery.recordset});
		} catch (error) {
			console.log(error);
			return res.status(500).json({ message: "An unexpected error has been occurred" });
		}
	})
	.post(async (req, res) => {
		const {Title, Description} = req.body;
		// console.log(req.files[0].buffer);

		if (Title.trim() === '' || Description.trim() === '')
			return res.status(400).json({message: "Title and description cannot be empty"});

		try {
			const pool = await poolPromise;

			const today = new Date();
			const year = today.getFullYear();
			let month = today.getMonth() + 1;
			month = 10 > month ? '0' + month : month;
			let date = today.getDate();
			date = 10 > date ? '0' + date : date;

			const createPostQuery = await pool.request().query(`
				DECLARE @InsertedRows TABLE (Id INT);
				INSERT INTO Post (AuthorId, PublishedOn, Title, Content)
				OUTPUT INSERTED.Id INTO @InsertedRows
				VALUES ('${req.user.id}', '${year}-${month}-${date}', '${Title.trim()}', '${Description.trim()}');
				SELECT Id FROM @InsertedRows;
			`);

			if (req.files.length > 0) {
				const attachmentName = ⁠ ${require('crypto').randomBytes(32).toString('hex')}.jpeg ⁠;
				const attachmentURL = await uploadFileToFirebaseStorage(
					req.files[0].buffer,
					attachmentName,
					'image/jpeg',
					'posts/'
				);

				await pool.request().query(`
					INSERT INTO PostAttachment (PostId, ImageName, URL)
					VALUES (${createPostQuery.recordset[0].Id}, '${attachmentName}', '${attachmentURL}');
				`);
			}

			return res.status(200).json({message: "Post has been shared successfully"});
		} catch (error) {
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	})
	.delete(async (req, res) => {
		const {postId} = req.body;

		try {
			const pool = await poolPromise;

			const postExistsQuery = await pool.request().query(`
				SELECT AuthorId FROM Post WHERE Id = '${postId}'
			`);
			if (postExistsQuery.recordset.length === 0)
				return res.status(400).json({message: "Post doesn't exists"});

			const adminQuery = await pool.request().query(`
				SELECT Id FROM Employee WHERE Id = '${req.user.id}' AND Status = '1' AND IsAdmin = '1'
			`);
			if ((postExistsQuery.recordset[0].AuthorId !== req.user.id) && (adminQuery.recordset.length === 0))
				return res.status(403).json({message: "Ypu are not allowed to delete the post"});

			const attachmentUrlQuery = await pool.request().query(`
				SELECT URL FROM PostAttachment WHERE PostId = '${postId}'
			`);
			if (attachmentUrlQuery.recordset.length > 0) {
				await deleteFileFromFirebaseStorage(attachmentUrlQuery.recordset[0].URL);
				await pool.request().query(`
					DELETE FROM PostAttachment WHERE PostId = '${postId}'
				`);
			}

			await pool.request().query(`
				DELETE FROM Post WHERE Id = '${postId}'
			`);

			return res.status(200).json({message: "Post has been shared successfully"});
		} catch (error) {
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	});

module.exports = router;