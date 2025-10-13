const {
  convertObjectTimestamps,
  convertArrayTimestamps,
  getTimezoneAbbreviation
} = require('./timezoneHelper');

const successResponse = (res, message, data = {}, statusCode = 200, req = null) => {
  const timezone = req?.timezone || 'UTC';

  let convertedData = data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      convertedData = convertArrayTimestamps(data, timezone);
    } else {
      convertedData = convertObjectTimestamps(data, timezone);
      Object.keys(convertedData).forEach(key => {
        if (Array.isArray(convertedData[key])) {
          convertedData[key] = convertArrayTimestamps(convertedData[key], timezone);
        }
      });
    }
  }

  return res.status(statusCode).json({
    success: true,
    message,
    data: convertedData,
    meta: {
      timezone: timezone,
      timezone_abbr: getTimezoneAbbreviation(timezone)
    }
  });
};

const successResponseWithPagination = (
  res,
  message,
  data = [],
  pagination = {},
  statusCode = 200,
  req = null
) => {
  const timezone = req?.timezone || 'UTC';
  const convertedData = convertArrayTimestamps(data, timezone);

  return res.status(statusCode).json({
    success: true,
    message,
    data: convertedData,
    pagination,
    meta: {
      timezone: timezone,
      timezone_abbr: getTimezoneAbbreviation(timezone)
    }
  });
};

module.exports = {
  successResponse,
  successResponseWithPagination
};