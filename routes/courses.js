const express = require('express');
const router = express.Router();

// Import database connection
const {poolPromise} = require('../lib/database');

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);

router.route('')
	.get(async (req, res) => {
		const completed = [];
		const incomplete = [];

		try {
			const pool = await poolPromise;

			await Promise.all([
				(async () => {
					const completedCoursesQuery = await pool.request().query(`
						SELECT 
							kt.Id, kt.Points, kt.Title, kt.Description, kt.Type, kt.AuthorId, e.FirstName, e.LastName, e.Email 
						FROM 
							KTCourse kt 
						INNER JOIN 
							Employee e ON kt.AuthorId = e.Id 
						WHERE kt.Id IN (
							SELECT 
								CourseId 
							FROM 
								CompletedKTCourse 
							WHERE EmployeeId = '${req.user.id}'
						)
					`);

					completedCoursesQuery.recordset.map((record) => {
						completed.push({
							id: record.Id,
							title: record.Title,
							description: record.Description,
							type: record.Type,
							points: record.Points,
							createdBy: {
								name: record.FirstName + " " + record.LastName,
								email: record.Email,
							},
							completed: true,
						});
					});
				})(),
				(async () => {
					const incompleteCoursesQuery = await pool.request().query(`
					SELECT 
						kt.Id, kt.Points, kt.Title, kt.Description, kt.Type, kt.AuthorId, e.FirstName, e.LastName, e.Email 
					FROM 
						KTCourse kt 
					INNER JOIN 
						Employee e ON kt.AuthorId = e.Id 
					WHERE kt.Id NOT IN (
						SELECT 
							CourseId 
						FROM 
							CompletedKTCourse 
						WHERE EmployeeId = '${req.user.id}'
					)
				`);
					incompleteCoursesQuery.recordset.map((record) => {
						incomplete.push({
							id: record.Id,
							title: record.Title,
							description: record.Description,
							type: record.Type,
							points: record.Points,
							createdBy: {
								name: record.FirstName + " " + record.LastName,
								email: record.Email,
							},
							completed: false,
						});
					});
				})(),
			]);

			return res.status(200).json({ courses: [...completed, ...incomplete] });
		} catch (error) {
			return res.status(500).json({ error: error });
		}
	});

router.route('/:courseId')
	.get(async (req, res) => {
		try {
			const pool = await poolPromise;

			let pdfURLQuery, quizQuery, completedCourseQuery, answersQuery, updatedQuizObj;

			await Promise.all([
				(async () => {
					pdfURLQuery = await pool.request().query(`
						SELECT URL 
						FROM CourseAttachment 
						WHERE CourseId = '${req.params.courseId}' 
					`);
				})(),

				(async () => {
					quizQuery = await pool.request().query(`
						SELECT q.Id AS QuizId, q.Question
						FROM Quiz q
						WHERE CourseId = '${req.params.courseId}'
					`);

					completedCourseQuery = await pool.request().query(`
						SELECT ck.Id, ck.Points
						FROM CompletedKTCourse ck
						WHERE ck.CourseId = '${req.params.courseId}' AND ck.EmployeeId = '${req.user.id}'
					`);

					if (completedCourseQuery.recordset.length > 0) {
						answersQuery = await pool.request().query(`
							SELECT q.Id AS QuizId, ao.Id AS AnswerOptionId, ao.[Text], ao.Correct, sa.Answer
							FROM Quiz q
							INNER JOIN AnswerOption ao ON ao.QuizId = q.Id
							INNER JOIN SubmittedAnswer sa ON sa.AnswerOptionId = ao.Id
							WHERE sa.CompletedKTCourseId = '${completedCourseQuery.recordset[0].Id}'
						`);
					} else {
						answersQuery = await pool.request().query(`
							SELECT q.Id AS QuizId, ao.Id AS AnswerOptionId, ao.[Text]
							FROM Quiz q
							INNER JOIN AnswerOption ao ON ao.QuizId = q.Id
							WHERE q.CourseId = '${req.params.courseId}'
						`);
					}
				})(),
			]);

			updatedQuizObj = quizQuery.recordset.map((q) => {
				return {
					QuizId: q.QuizId,
					Question: q.Question,
					answerOptions: answersQuery.recordset.filter(a => a.QuizId === q.QuizId),
				};
			});

			return res.status(200).json({
				courseData: {
					pdfUrl: pdfURLQuery.recordset[0].URL,
					score: completedCourseQuery.recordset.length > 0 ? completedCourseQuery.recordset[0].Points : undefined,
					quiz: updatedQuizObj,
				}
			});
		} catch (error) {
			return res.status(500).json({ error: error });
		}
	})
	.post(async (req, res) => {
		try {
			const pool = await poolPromise;

			// checks
			const courseAuthorQuery = await pool.request().query(`
				SELECT AuthorId
				FROM KTCourse
				WHERE Id = '${req.params.courseId}'
			`);

			if (courseAuthorQuery.recordset[0].AuthorId === req.user.id)
				return res.status(403).json({
					message: "Course author cannot complete his/her own course module"
				});

			const previousSubmissionQuery = await pool.request().query(`
				SELECT Id
				FROM CompletedKTCourse
				WHERE EmployeeId = '${req.user.id}' AND CourseId = '${req.params.courseId}'
			`);

			if (previousSubmissionQuery.recordset.length > 0)
				return res.status(403).json({
					message: "Cannot submit the same course module twice"
				});

			// calculate marks
			const quizIDs = req.body.quiz.map(q => q.id);

			const results = await Promise.all(
				quizIDs.map(async (qID) => {
					const correctAnswersQuery = await pool.request().query(`
						SELECT ao.QuizId, ao.Id AS AnswerOptionId, ao.Correct
						FROM AnswerOption ao
						WHERE ao.QuizId = ${qID}
						ORDER BY ao.QuizId, ao.Id
					`);
					return correctAnswersQuery.recordset;
				})
			);

			let totalMarks = quizIDs.length * 10;
			for (let i = 0; i < results.length; i++) { // Quiz
				const answerOptions = results[i];
				const submittedAnswers = req.body.quiz.filter(q => q.id === results[i][0].QuizId)[0].answers;
				for (let j = 0; j < answerOptions.length; j++) {
					const currentAnswerOption = answerOptions[j];
					if (
						submittedAnswers.filter(sa =>
							(sa.id === currentAnswerOption.AnswerOptionId) &&
							(sa.checked === (currentAnswerOption.Correct === 1))
						).length !== 1
					) {
						totalMarks -= 10;
						break;
					}
				}
			}

			// create CompletedKTCourse entry
			const completedCourseQuery = await pool.request().query(`
				DECLARE @InsertedRows TABLE (Id INT);
				INSERT INTO CompletedKTCourse (EmployeeId, CourseId, Points)
				OUTPUT INSERTED.Id INTO @InsertedRows
				VALUES ('${req.user.id}', '${req.params.courseId}', '${totalMarks}');
				SELECT Id FROM @InsertedRows
			`);

			// create SubmittedAnswer entries
			let submittedAnswerQueryData = [];

			for (let i = 0; i < req.body.quiz.length; i++) {
				const answers = req.body.quiz[i].answers;
				for (let j = 0; j < answers.length; j++) {
					submittedAnswerQueryData.push({AnswerOptionId: answers[j].id, Answer: answers[j].checked ? 1 : 0});
				}
			}

			const submittedAnswerData = submittedAnswerQueryData.map(
				data => `(${data.AnswerOptionId}, ${data.Answer}, ${completedCourseQuery.recordset[0].Id})`
			).join(', ');

			await pool.request().query(`
				INSERT INTO SubmittedAnswer (AnswerOptionId, Answer, CompletedKTCourseId)
        VALUES ${submittedAnswerData}
			`);

			return res.status(200).json({ message: "Course has been completed successfully" });
		} catch (error) {
			return res.status(500).json({
				message: "Unexpected error occurred"
			});
		}
	});

module.exports = router;