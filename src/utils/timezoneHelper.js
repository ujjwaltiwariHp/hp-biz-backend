// src/utils/timezoneHelper.js
const moment = require('moment-timezone');

class TimezoneHelper {

  static getCommonTimezones() {
    const common = [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Singapore',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
      'Pacific/Auckland'
    ];

    return common.map(tz => {
      const offset = moment.tz(tz).format('Z');
      return {
        value: tz,
        label: `(UTC${offset}) ${tz.replace(/_/g, ' ')}`,
        offset: moment.tz(tz).utcOffset(),
        abbreviation: moment.tz(tz).format('z')
      };
    });
  }

  static getAllTimezones() {
    const timezones = moment.tz.names();
    return timezones.map(tz => {
      const offset = moment.tz(tz).format('Z');
      return {
        value: tz,
        label: `(UTC${offset}) ${tz.replace(/_/g, ' ')}`,
        offset: moment.tz(tz).utcOffset()
      };
    }).sort((a, b) => b.offset - a.offset);
  }

  static isValidTimezone(timezone) {
    if (!timezone) return false;
    return moment.tz.zone(timezone) !== null;
  }

  static toTimezone(utcDate, timezone = 'UTC') {
    if (!utcDate) return null;
    if (!this.isValidTimezone(timezone)) timezone = 'UTC';
    return moment.utc(utcDate).tz(timezone);
  }

  static toUTC(localDate, timezone = 'UTC') {
    if (!localDate) return null;
    if (!this.isValidTimezone(timezone)) timezone = 'UTC';
    return moment.tz(localDate, timezone).utc().toDate();
  }

  static formatForDisplay(utcDate, timezone = 'UTC', format = 'DD/MM/YYYY hh:mm A') {
    if (!utcDate) return null;
    const converted = this.toTimezone(utcDate, timezone);
    return converted ? converted.format(format) : null;
  }

  static nowUTC() {
    return moment.utc().toDate();
  }

  static now(timezone = 'UTC') {
    return moment().tz(timezone);
  }

  static getTimezoneInfo(timezone = 'UTC') {
    if (!this.isValidTimezone(timezone)) timezone = 'UTC';

    const m = moment.tz(timezone);
    return {
      timezone: timezone,
      abbreviation: m.format('z'),
      offset: m.format('Z'),
      offsetMinutes: m.utcOffset(),
      isDST: m.isDST(),
      displayName: timezone.replace(/_/g, ' ')
    };
  }

  static convertTimestampsInObject(data, timezone, fields = null) {
    if (!data) return data;

    const timestampFields = fields || [
      'created_at', 'updated_at', 'assigned_at', 'last_login',
      'reminder_time', 'next_follow_up', 'last_contacted',
      'subscription_start_date', 'subscription_end_date',
      'expires_at', 'used_at', 'completed_at', 'read_at',
      'payment_date', 'due_date', 'billing_period_start',
      'billing_period_end', 'login_time', 'logout_time',
      'last_activity', 'meeting_date', 'applied_at'
    ];

    if (Array.isArray(data)) {
      return data.map(item => this.convertTimestampsInObject(item, timezone, fields));
    }

    if (typeof data === 'object' && data !== null) {
      const converted = { ...data };

      for (let key in converted) {
        if (timestampFields.includes(key) && converted[key]) {
          converted[key] = this.formatForDisplay(converted[key], timezone);
        } else if (typeof converted[key] === 'object' && converted[key] !== null) {
          converted[key] = this.convertTimestampsInObject(converted[key], timezone, fields);
        }
      }

      return converted;
    }

    return data;
  }

  static getRelativeTime(utcDate, timezone = 'UTC') {
    if (!utcDate) return null;
    const converted = this.toTimezone(utcDate, timezone);
    return converted ? converted.fromNow() : null;
  }
}

module.exports = TimezoneHelper;