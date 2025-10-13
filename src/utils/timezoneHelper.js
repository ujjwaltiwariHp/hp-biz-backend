const moment = require('moment-timezone');

const getAllTimezones = () => {
  const timezones = moment.tz.names();
  return timezones.map(tz => {
    const offset = moment.tz(tz).format('Z');
    return {
      value: tz,
      label: `(GMT${offset}) ${tz.replace(/_/g, ' ')}`,
      offset: offset
    };
  }).sort((a, b) => {
    const offsetA = parseFloat(a.offset.replace(':', '.'));
    const offsetB = parseFloat(b.offset.replace(':', '.'));
    if (offsetA !== offsetB) return offsetA - offsetB;
    return a.label.localeCompare(b.label);
  });
};

const getCommonTimezones = () => {
  const common = [
    'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
    'America/Phoenix','Europe/London','Europe/Paris','Europe/Berlin',
    'Asia/Dubai','Asia/Kolkata','Asia/Singapore','Asia/Tokyo','Australia/Sydney',
    'Pacific/Auckland'
  ];
  return common.map(tz => {
    const offset = moment.tz(tz).format('Z');
    return {
      value: tz,
      label: `(GMT${offset}) ${tz.replace(/_/g, ' ')}`,
      offset: offset
    };
  });
};

const convertToCompanyTime = (utcTime, timezone = 'UTC') => {
  if (!utcTime) return null;
  try {
    return moment.utc(utcTime).tz(timezone).format('YYYY-MM-DD HH:mm:ss');
  } catch {
    return moment.utc(utcTime).format('YYYY-MM-DD HH:mm:ss');
  }
};

const convertToUTC = (localTime, timezone = 'UTC') => {
  if (!localTime) return null;
  try {
    return moment.tz(localTime, timezone).utc().toDate();
  } catch {
    return new Date(localTime);
  }
};

const formatInTimezone = (utcTime, timezone = 'UTC', format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!utcTime) return null;
  try {
    return moment.utc(utcTime).tz(timezone).format(format);
  } catch {
    return moment.utc(utcTime).format(format);
  }
};

const getCurrentTimeInTimezone = (timezone = 'UTC') => {
  try {
    return moment().tz(timezone).format('YYYY-MM-DD HH:mm:ss');
  } catch {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  }
};

const convertObjectTimestamps = (obj, timezone = 'UTC', fields = null) => {
  if (!obj) return obj;
  const defaultFields = [
    'created_at','updated_at','deleted_at','createdAt','updatedAt','deletedAt',
    'last_login','login_time','logout_time','assigned_at','last_contacted',
    'next_follow_up','reminder_time','completed_at','expires_at','subscription_start_date',
    'subscription_end_date','payment_date','due_date','read_at','used_at','billing_period_start',
    'billing_period_end','meeting_date','last_activity'
  ];
  const fieldsToConvert = fields || defaultFields;
  const converted = { ...obj };
  fieldsToConvert.forEach(field => {
    if (converted[field]) {
      converted[field] = convertToCompanyTime(converted[field], timezone);
    }
  });
  return converted;
};

const convertArrayTimestamps = (array, timezone = 'UTC', fields = null) => {
  if (!Array.isArray(array)) return array;
  return array.map(item => convertObjectTimestamps(item, timezone, fields));
};

const isValidTimezone = (timezone) => {
  if (!timezone) return false;
  return !!moment.tz.zone(timezone);
};

const getTimezoneOffset = (timezone = 'UTC') => {
  try {
    return moment.tz(timezone).format('Z');
  } catch {
    return '+00:00';
  }
};

const getTimezoneAbbreviation = (timezone = 'UTC') => {
  try {
    return moment.tz(timezone).format('z');
  } catch {
    return 'UTC';
  }
};

const parseAndConvertToUTC = (dateString, timezone = 'UTC') => {
  if (!dateString) return null;
  try {
    if (dateString instanceof Date) return moment(dateString).utc().toDate();
    const parsed = moment.tz(dateString, timezone);
    if (!parsed.isValid()) return moment.utc(dateString).toDate();
    return parsed.utc().toDate();
  } catch {
    return new Date(dateString);
  }
};

const getTimezoneInfo = (timezone = 'UTC') => {
  if (!timezone || !isValidTimezone(timezone)) {
    return { abbreviation: 'UTC', offset: '+00:00' };
  }
  return {
    abbreviation: getTimezoneAbbreviation(timezone),
    offset: getTimezoneOffset(timezone)
  };
};

module.exports = {
  getAllTimezones,
  getCommonTimezones,
  convertToCompanyTime,
  convertToUTC,
  formatInTimezone,
  getCurrentTimeInTimezone,
  convertObjectTimestamps,
  convertArrayTimestamps,
  isValidTimezone,
  getTimezoneOffset,
  getTimezoneAbbreviation,
  parseAndConvertToUTC,
  getTimezoneInfo
};
