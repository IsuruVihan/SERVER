const express = require('express');
const router = express.Router();
const {poolPromise} = require("../lib/database");

// Import route middlewares
const logger = require("../middleware/logger");
const authenticateToken = require('../middleware/authenticateToken');
const getEmployeeId = require('../middleware/getEmployeeId');
const checkAdmin = require('../middleware/checkAdmin');

// Use route middlewares
router.use(logger);
router.use(authenticateToken);
router.use(getEmployeeId);

router.route('')
	.get(async (req, res) => {
		try {
			const dateString = req.query.date;
			if (!dateString) {
				return res.status(400).json({ message: "Missing date parameter" });
			}

			const parsedDate = new Date(dateString);

			if (isNaN(parsedDate.getTime())) {
				return res.status(400).json({ message: "Invalid date format" });
			}

			const pad = (num) => num.toString().padStart(2, '0');
			const formattedDate = `${parsedDate.getUTCFullYear()}-${pad(parsedDate.getUTCMonth() + 1)}-${pad(parsedDate.getUTCDate())}`;

			const pool = await poolPromise;

			const eventsQuery = await pool.request()
				.query(`
					SELECT ce.Id, ce.[Start], ce.[End], ce.Title, ce.[From], ce.[To]
					FROM CalendarEvent ce
					WHERE CAST(ce.[Start] AS DATE) <= '${formattedDate}' AND CAST(ce.[End] AS DATE) >= '${formattedDate}'
				`);

			const results = eventsQuery.recordset.map(r => {
				const formatDate = (date) => {
					const d = new Date(date);
					return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
				};

				const formatTime = (time) => {
					const t = new Date(time);
					const hours = t.getUTCHours();
					const minutes = t.getUTCMinutes();
					const seconds = t.getUTCSeconds();
					const refinedHours = hours < 10 ? `0${hours}`: hours;
					const refinedMinutes = minutes < 10 ? `0${minutes}`: minutes;
					const refinedSeconds = seconds < 10 ? `0${seconds}`: seconds;
					return `${refinedHours}:${refinedMinutes}:${refinedSeconds}`;
				};

				return {
					Id: r.Id,
					Start: formatDate(r.Start),
					End: formatDate(r.End),
					Title: r.Title,
					From: formatTime(r.From),
					To: formatTime(r.To)
				};
			});

			return res.status(200).json({ events: results });
		} catch (e) {
			console.error(e);
			return res.status(500).json({ message: "An unexpected error occurred" });
		}
	})
	.post(checkAdmin, async (req, res) => {
		try {
			const { Start, End, Title, From, To, CreatedById } = req.body;

			if (!Start || !End || !Title || !From || !To || !CreatedById) {
				return res.status(400).json({ message: "Missing required fields" });
			}

			const pool = await poolPromise;

			await pool.request()
				.query(`
					INSERT INTO CalendarEvent ([Start], [End], Title, [From], [To], CreatedById)
					VALUES (
						'${Start}', '${End}', '${Title}', '${From}', '${To}', '${req.user.id}'
					)
				`);

			return res.status(201).json({ message: "Event created successfully" });
		} catch (e) {
			console.error(e);
			return res.status(500).json({ message: "An unexpected error occurred" });
		}
	})
	.put(checkAdmin, async (req, res) => {
		try {
			const { Id, Start, End, Title, From, To } = req.body;

			if (!Id || !Start || !End || !Title || !From || !To) {
				return res.status(400).json({ message: "Missing required fields" });
			}

			const pool = await poolPromise;

			await pool.request()
				.query(`
					UPDATE CalendarEvent
					SET [Start] = '${Start}', [End] = '${End}', Title = '${Title}', [From] = '${From}', [To] = '${To}'
					WHERE Id = '${Id}'
				`);

			return res.status(200).json({ message: "Event updated successfully" });
		} catch (e) {
			console.error(e);
			return res.status(500).json({ message: "An unexpected error occurred" });
		}
	})
	.delete(checkAdmin, async (req, res) => {
		try {
			const { Id } = req.body;

			if (!Id) {
				return res.status(400).json({ message: "Missing event ID" });
			}

			const pool = await poolPromise;

			await pool.request()
				.query(`DELETE FROM CalendarEvent WHERE Id = '${Id}'`);

			return res.status(200).json({ message: "Event deleted successfully" });
		} catch (e) {
			console.error(e);
			return res.status(500).json({ message: "An unexpected error occurred" });
		}
	});

module.exports = router;