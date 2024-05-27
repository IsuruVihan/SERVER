const countWeekends = (startDate, endDate) => {
	let count = 0;
	let currentDate = new Date(startDate);

	// Loop through each day between the start and end date
	while (currentDate <= new Date(endDate)) {
		const day = currentDate.getDay();
		if (day === 6 || day === 0) { // 6 = Saturday, 0 = Sunday
			count++;
		}
		currentDate.setDate(currentDate.getDate() + 1);
	}

	return count;
};

module.exports = countWeekends;