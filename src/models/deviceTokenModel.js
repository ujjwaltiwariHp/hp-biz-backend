const pool = require('../config/database');

const registerDeviceToken = async (userId, userType, fcmToken, deviceType) => {
  const query = `
    INSERT INTO device_tokens (user_id, user_type, fcm_token, device_type, last_active)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (fcm_token)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      user_type = EXCLUDED.user_type,
      last_active = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  try {
    const result = await pool.query(query, [userId, userType, fcmToken, deviceType]);
    return result.rows[0];
  } catch (error) {
    throw new Error('Error registering device token: ' + error.message);
  }
};

const deleteDeviceToken = async (fcmToken) => {
  const query = `DELETE FROM device_tokens WHERE fcm_token = $1`;
  try {
    await pool.query(query, [fcmToken]);
  } catch (error) {
    throw new Error('Error deleting device token: ' + error.message);
  }
};

const getTokensByUserIds = async (userIds, userType) => {
  if (!userIds || userIds.length === 0) return [];

  const query = `
    SELECT fcm_token
    FROM device_tokens
    WHERE user_id = ANY($1) AND user_type = $2
  `;

  try {
    const result = await pool.query(query, [userIds, userType]);
    return result.rows.map(row => row.fcm_token);
  } catch (error) {
    return [];
  }
};

module.exports = {
  registerDeviceToken,
  deleteDeviceToken,
  getTokensByUserIds
};