const isValidEmail = email => {
	// Define the regular expression for validating an email address
	const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

	// Test the email against the regular expression
	return emailRegex.test(email);
}

module.exports = isValidEmail;