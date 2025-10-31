const moment = require('moment-timezone');

const calculateEndDate = (startDate, durationType, count = 1, timezone = 'UTC') => {
  if (!startDate || !durationType) {
    throw new Error('Start date and duration type are required.');
  }

  let start = moment.tz(startDate, timezone);

  switch (durationType.toLowerCase()) {
    case 'monthly':
      start = start.add(count, 'months');
      break;
    case 'quarterly':
      start = start.add(count * 3, 'months');
      break;
    case 'yearly':
      start = start.add(count, 'years');
      break;
    case 'weekly':
      start = start.add(count, 'weeks');
      break;
    default:
      start = start.add(count, 'months');
      break;
  }

  // Return as a standard UTC Date object for database storage
  return start.utc().toDate();
};

module.exports = {
  calculateEndDate
};