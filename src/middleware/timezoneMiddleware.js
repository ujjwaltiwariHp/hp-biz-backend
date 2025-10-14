const TimezoneHelper = require('../utils/timezoneHelper');
const pool = require('../config/database');

const timezoneCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getCompanyTimezone(companyId) {
  if (!companyId) return 'UTC';

  const cached = timezoneCache.get(companyId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.timezone;
  }

  try {
    const result = await pool.query(
      `SELECT cs.timezone, c.timezone as company_timezone
       FROM company_settings cs
       LEFT JOIN companies c ON c.id = cs.company_id
       WHERE cs.company_id = $1
       LIMIT 1`,
      [companyId]
    );

    const timezone = result.rows[0]?.timezone || result.rows[0]?.company_timezone || 'UTC';
    timezoneCache.set(companyId, {
      timezone,
      timestamp: Date.now()
    });

    return timezone;
  } catch (error) {
    return 'UTC';
  }
}

function clearTimezoneCache(companyId) {
  if (companyId) {
    timezoneCache.delete(companyId);
  } else {
    timezoneCache.clear();
  }
}

async function attachTimezone(req, res, next) {
  try {
    let timezone = 'UTC';
    let timezoneSource = 'default';

    if (req.company) {
      timezone = await getCompanyTimezone(req.company.id);
      timezoneSource = 'company';
      const deviceTimezone = req.headers['x-device-timezone'];
      if (deviceTimezone && TimezoneHelper.isValidTimezone(deviceTimezone)) {
        req.deviceTimezone = deviceTimezone;
      }
    } else if (req.staff) {
      const staffPreference = req.staff.timezone_preference || 'company';
      if (staffPreference === 'custom' && req.staff.timezone) {
        timezone = req.staff.timezone;
        timezoneSource = 'staff_custom';
      } else if (staffPreference === 'device' && req.headers['x-device-timezone']) {
        const deviceTz = req.headers['x-device-timezone'];
        if (TimezoneHelper.isValidTimezone(deviceTz)) {
          timezone = deviceTz;
          timezoneSource = 'device';
        } else {
          timezone = await getCompanyTimezone(req.staff.company_id);
          timezoneSource = 'company_fallback';
        }
      } else {
        timezone = await getCompanyTimezone(req.staff.company_id);
        timezoneSource = 'company';
      }
    } else {
      const deviceTz = req.headers['x-device-timezone'];
      if (deviceTz && TimezoneHelper.isValidTimezone(deviceTz)) {
        timezone = deviceTz;
        timezoneSource = 'device_guest';
      }
    }

    if (!TimezoneHelper.isValidTimezone(timezone)) {
      timezone = 'UTC';
      timezoneSource = 'fallback';
    }

    req.timezone = timezone;
    req.timezoneSource = timezoneSource;
    req.timezoneHelper = TimezoneHelper;

    next();
  } catch (error) {
    req.timezone = 'UTC';
    req.timezoneSource = 'error_fallback';
    req.timezoneHelper = TimezoneHelper;
    next();
  }
}

function transformResponseTimestamps(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    if (data && typeof data === 'object') {
      if (!data.meta) data.meta = {};
      data.meta.timezone = req.timezone;
    }

    return originalJson(data);
  };

  next();
}

module.exports = {
  attachTimezone,
  transformResponseTimestamps,
  getCompanyTimezone,
  clearTimezoneCache,
  attachTimezoneForSuperAdmin: attachTimezone
};