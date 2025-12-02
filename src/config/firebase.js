const admin = require('firebase-admin');
require('dotenv').config();

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('Firebase Admin Initialized Successfully');
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error.message);
  }
} else {
  console.warn('Firebase credentials missing in .env. Push notifications will not work.');
}

module.exports = admin;