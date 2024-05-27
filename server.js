require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Setup database connection pool
const database = require('./lib/database');

// Import global middlewares
const logger = require("./middleware/logger");

// Import routes
const loginRouter = require('./routes/login');
const usersRouter = require('./routes/users');
const tokenRouter = require('./routes/token');
const userRouter = require('./routes/user');
const myAccountRouter = require('./routes/myAccount');
const attendanceMarkingRouter = require('./routes/attendanceMarking');
const leavesRouter = require('./routes/leaves');

// Create express app
const app = express();

// Set global middlewares
app.use(cors());
app.use(logger);
app.use(express.urlencoded({extended: true}));
app.use(express.json());

// Routes
app.use('/login', loginRouter);
app.use('/users', usersRouter);
app.use('/token', tokenRouter);
app.use('/user', userRouter);
app.use('/my-account', myAccountRouter);
app.use('/attendance', attendanceMarkingRouter);
app.use('/leaves', leavesRouter);

// Run app
app.listen(4000, () => {
	console.log("Server started on port 4000");
});