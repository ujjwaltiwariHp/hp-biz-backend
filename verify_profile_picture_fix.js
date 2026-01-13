const verifyLogic = (profile_picture) => {
    console.log(`Testing input: "${profile_picture}"`);
    let profileData = {};

    if (profile_picture !== undefined) {
        // FIX: Ignore local mobile file paths or invalid URIs
        const isValidUrl = typeof profile_picture === 'string' &&
            (profile_picture.startsWith('/uploads/') || profile_picture.startsWith('http'));

        if (isValidUrl || profile_picture === '' || profile_picture === null) {
            profileData.profile_picture = profile_picture;
            console.log('Result: Accepted');
        } else {
            console.log('Result: Rejected (Ignored)');
        }
    }
    return profileData;
};

console.log('--- Verification Test ---');
verifyLogic('file:///data/user/0/com.app/cache/image.jpg'); // Should be rejected
verifyLogic('content://media/external/images/media/123'); // Should be rejected
verifyLogic('/uploads/profile_pictures/valid-image.jpg'); // Should be accepted
verifyLogic('https://example.com/image.png'); // Should be accepted
verifyLogic(''); // Should be accepted (clear image)
verifyLogic(null); // Should be accepted (clear image)
console.log('--- End Test ---');
