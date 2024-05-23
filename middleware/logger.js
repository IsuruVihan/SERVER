const fs = require('fs');

const logger = (req, res, next) => {
	const clientIP = req.ip || req.connection.remoteAddress;
	const methodType = req.method;
	const timestamp = new Date().toISOString();
	const message = `[${timestamp}] ${methodType} request from ${clientIP} to ${req.originalUrl}`;
	console.log(message);

	fs.appendFile('request_logs.txt', message + '\n', (err) => {
		if (err) {
			console.error('Error writing to log file:', err);
		}
	});

	next();
}

module.exports = logger;