const { getTimezoneAbbreviation } = require('./timezoneHelper');

const successResponse = (res, message, data = {}, statusCode = 200, req = null) => {
  const timezone = req?.timezone || 'UTC';

  return res.status(statusCode).json({
    success: true,
    message,
    data: data,
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

  return res.status(statusCode).json({
    success: true,
    message,
    data: data,
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