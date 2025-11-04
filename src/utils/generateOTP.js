const generateOTP = () => {
    // Check if a static test OTP is configured for non-production environments.
    // Use process.env.TEST_OTP (e.g., '1234') to force a predictable value.
    if (process.env.NODE_ENV !== 'production' && process.env.TEST_OTP) {
        // Return the static test OTP, limited to 4 digits for safety/consistency.
        return process.env.TEST_OTP.substring(0, 4);
    }

    // Default behavior: generate a random 4-digit OTP
    return Math.floor(1000 + Math.random() * 9000).toString();
};

module.exports = { generateOTP };