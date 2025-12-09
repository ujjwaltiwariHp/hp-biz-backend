SELECT
    dt.id,
    dt.user_id,
    dt.user_type,
    dt.fcm_token,
    dt.device_type,
    dt.last_active,
    s.email,
    s.company_id
FROM
    device_tokens dt
JOIN
    staff s ON dt.user_id = s.id
WHERE
    dt.user_id = 3
    AND dt.user_type = 'staff'
    AND s.company_id = 4;