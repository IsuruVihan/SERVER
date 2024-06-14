const express = require('express');
const router = express.Router();
const {poolPromise} = require("../lib/database");

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);

router.route('/contacts')
	.get(async (req, res) => {
		try {
			const pool = await poolPromise;

			const employeesQuery = await pool.request().query(`
				SELECT FirstName + ' ' + LastName AS name, Email AS email, Id
				FROM Employee
				WHERE Status = '1' AND Id != '${req.user.id}'
			`);

			return res.status(200).json({employees: employeesQuery.recordset});
		} catch (e) {
			console.log(e);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	});

router.route('/message/:participantId')
	.get(async (req, res) => {
		const {participantId} = req.params;

		try {
			const pool = await poolPromise;

			const sentMessagesQuery = await pool.request().query(`
				SELECT Id, SenderId, ReceiverId, Content, SentOn
				FROM PrivateMessage
				WHERE SenderId = '${req.user.id}' AND ReceiverId = '${participantId}'
			`);

			const receivedMessagesQuery = await pool.request().query(`
				SELECT Id, SenderId, ReceiverId, Content, SentOn
				FROM PrivateMessage
				WHERE ReceiverId = '${req.user.id}' AND SenderId = '${participantId}'
			`);

			const sentMessages = sentMessagesQuery.recordset.map((m) => {
				return {
					...m,
					sent: true,
				};
			});

			const receivedMessages = receivedMessagesQuery.recordset.map((m) => {
				return {
					...m,
					sent: false,
				};
			});

			const allMessages = [...sentMessages, ...receivedMessages];
			allMessages.sort((a, b) => a.Id - b.Id);

			return res.status(200).json({messages: allMessages});
		} catch (e) {
			console.log(e);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	})
	.post(async (req, res) => {
		const {participantId} = req.params;
		const {Content} = req.body;

		try {
			const pool = await poolPromise;

			const now = new Date();
			const year = now.getFullYear();
			const month = String(now.getMonth() + 1).padStart(2, '0');
			const day = String(now.getDate()).padStart(2, '0');
			const hours = String(now.getHours()).padStart(2, '0');
			const minutes = String(now.getMinutes()).padStart(2, '0');
			const seconds = String(now.getSeconds()).padStart(2, '0');
			const timeAsString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

			await pool.request().query(`
				INSERT INTO PrivateMessage (SenderId, ReceiverId, Content, SentOn)
				VALUES ('${req.user.id}', '${participantId}', '${Content}', '${timeAsString}')
			`);

			return res.status(200).json({message: "Message has been delivered successfully"});
		} catch (e) {
			console.log(e);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	})
	.delete(async (req, res) => {
		const {messageId} = req.body;

		try {
			const pool = await poolPromise;

			await pool.request().query(`
				DELETE FROM PrivateChat WHERE Id = '${messageId}'
			`);

			return res.status(200).json({message: "Message has been deleted successfully"});
		} catch (e) {
			console.log(e);
			return res.status(500).json({message: "An unexpected error occurred"});
		}
	});

module.exports = router;