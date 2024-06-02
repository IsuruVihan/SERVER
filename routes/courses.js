const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');

const { uploadFileToFirebaseStorage } = require('../lib/firebase/firebase');

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

const validateData = (data) => {
	// Condition 1: Length of data array >= 4
	if (data.length < 4) {
		console.log('Condition 1 failed: Length of data array is less than 4.');
		return false;
	}

	for (let index = 0; index < data.length; index++) {
		const item = data[index];

		// Condition 2: Only one "Question" field
		if (!item.hasOwnProperty("Question") || Object.keys(item).filter(key => key === "Question").length !== 1) {
			console.log(`Condition 2 failed at index ${index}: Object does not contain exactly one "Question" field.`);
			return false;
		}

		// Condition 3: Question field cannot be empty or whitespace only
		if (!item.Question.trim()) {
			console.log(`Condition 3 failed at index ${index}: "Question" field is empty or whitespace only.`);
			return false;
		}

		// Condition 4: 4 "Option_" fields
		const options = Object.keys(item).filter(key => key.startsWith("Option"));
		if (options.length !== 4) {
			console.log(`Condition 4 failed at index ${index}: Object does not contain 4 "Option_" fields.`);
			return false;
		}

		// Condition 5: Options cannot be empty or whitespace only
		for (let option of options) {
			if (!item[option].trim()) {
				console.log(`Condition 5 failed at index ${index}: "${option}" field is empty or whitespace only.`);
				return false;
			}
		}

		// Condition 6: Options should be in order and no missing numbers
		for (let i = 1; i <= options.length; i++) {
			if (!item.hasOwnProperty(`Option${i}`)) {
				console.log(`Condition 6 failed at index ${index}: Missing "Option${i}".`);
				return false;
			}
		}

		// Condition 7: Same value cannot be in multiple "Option"s
		const optionValues = options.map(option => item[option]);
		const uniqueOptionValues = new Set(optionValues);
		if (uniqueOptionValues.size !== optionValues.length) {
			console.log(`Condition 7 failed at index ${index}: Duplicate values in "Option_" fields.`);
			return false;
		}

		// Condition 8: Only one "CorrectAnswer" field
		if (!item.hasOwnProperty("CorrectAnswer") || Object.keys(item).filter(key => key === "CorrectAnswer").length !== 1) {
			console.log(`Condition 8 failed at index ${index}: Object does not contain exactly one "CorrectAnswer" field.`);
			return false;
		}

		// Condition 9: CorrectAnswer field cannot be empty or whitespace only
		if (!item.CorrectAnswer.trim()) {
			console.log(`Condition 9 failed at index ${index}: "CorrectAnswer" field is empty or whitespace only.`);
			return false;
		}

		// Condition 10: Value of CorrectAnswer must be one of the "Option_" fields
		if (!item.hasOwnProperty(item.CorrectAnswer)) {
			console.log(`Condition 10 failed at index ${index}: "CorrectAnswer" value does not match any "Option_" fields.`);
			return false;
		}
	}

	return true;
}

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
	})
	.post(async (req, res) => {
		const {Title, Description, Type} = req.body;

		try {
			if (Title.trim() === "" || Description.trim() === "" || Type.trim() === "")
				return res.status(400).json({message: "Incomplete data"});

			if (!["Technical Skills", "Soft Skills", "Company Rules & Regulations"].includes(Type.trim()))
				return res.status(400).json({message: "Invalid type"});

			if (req.files.filter(f => f.fieldname === "Quiz").length !== 1)
				return res.status(400).json({message: "Quiz is missing"});

			if (req.files.filter(f => f.fieldname === "Content").length !== 1)
				return res.status(400).json({message: "Content is missing"});

			const pool = await poolPromise;

			const courseTitleQuery = await pool.request().query(`
				SELECT Id
				FROM KTCourse
				WHERE Title = '${Title.trim()}'
			`);
			if (courseTitleQuery.recordset.length > 0) {
				return res.status(400).json({message: "A course module with the same title already exists"});
			}

			const workbook = XLSX.read(
				req.files.filter(f => f.fieldname === "Quiz")[0].buffer,
				{type: "buffer"}
			);
			const worksheetName = workbook.SheetNames[0];
			const worksheet = workbook.Sheets[worksheetName];
			const data = XLSX.utils.sheet_to_json(worksheet);

			if (!validateData(data)) {
				return res.status(400).json({message: "Invalid quiz structure"});
			}

			const today = new Date();
			const year = today.getFullYear();
			let month = today.getMonth() + 1;
			month = 10 > month ? '0' + month : month;
			let date = today.getDate();
			date = 10 > date ? '0' + date : date;

			const createKTCourseQuery = await pool.request().query(`
				DECLARE @InsertedRows TABLE (Id INT);
				INSERT INTO KTCourse (AuthorId, Points, PublishedOn, Title, Description, [Type])
				OUTPUT INSERTED.Id INTO @InsertedRows
				VALUES (
					'${req.user.id}', '${data.length * 10}', '${year}-${month}-${date}', '${Title.trim()}',
					'${Description.trim()}', '${Type.trim()}'
				);
				SELECT Id FROM @InsertedRows;
			`);

			const ktCourseId = createKTCourseQuery.recordset[0].Id;

			await Promise.all([
				(async () => {
					const questions = data.map(d => d.Question);
					const createQuizzesQueryValues = questions.map((q) => {
						return `(${ktCourseId}, '${q}')`;
					}).join(', ');

					const createQuizzesQuery = await pool.request().query(`
						DECLARE @InsertedRows TABLE (Id INT);
						INSERT INTO Quiz (CourseId, Question)
						OUTPUT INSERTED.Id INTO @InsertedRows
						VALUES ${createQuizzesQueryValues};
						SELECT Id FROM @InsertedRows;
					`);

					const quizIDs = createQuizzesQuery.recordset.map(r => r.Id);

					const answerOptionsValues = quizIDs.map((qId, idx) => {
						const questionObj = data[idx];
						const opt1 = questionObj.Option1;
						const opt2 = questionObj.Option2;
						const opt3 = questionObj.Option3;
						const opt4 = questionObj.Option4;
						const correct = questionObj.CorrectAnswer;
						return `
							(${qId}, '${opt1}', ${correct === 'Option1' ? 1 : 0}), 
							(${qId}, '${opt2}', ${correct === 'Option2' ? 1 : 0}), 
							(${qId}, '${opt3}', ${correct === 'Option3' ? 1 : 0}), 
							(${qId}, '${opt4}', ${correct === 'Option4' ? 1 : 0})
						`;
					}).join(", ");

					await pool.request().query(`
						INSERT INTO AnswerOption (QuizId, [Text], Correct)
						VALUES ${answerOptionsValues}
					`);
				})(),

				(async () => {
					const pdfName = `${require('crypto').randomBytes(32).toString('hex')}.pdf`;
					const pdfURL = await uploadFileToFirebaseStorage(
						req.files.filter(f => f.fieldname === "Content")[0].buffer,
						pdfName,
						'application/pdf',
						'kt-courses/'
					);

					await pool.request().query(`
						INSERT INTO CourseAttachment (CourseId, DocumentName, URL)
						VALUES (${ktCourseId}, '${pdfName}', '${pdfURL}');
					`);
				})(),
			]);

			return res.status(200).json({message: "KT course module created successfully"});
		} catch (error) {
			console.log(error);
			return res.status(500).json({message: "Unexpected error occurred"});
		}
	})

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