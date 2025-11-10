const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { errorResponse } = require('../utils/errorResponse');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads/qr_codes/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/svg+xml') {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, or SVG are allowed.'), false);
    }
};

const uploadQrCodeMiddleware = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
}).single('qr_code_image');

const handleUnifiedUpload = (req, res, next) => {
    uploadQrCodeMiddleware(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            return errorResponse(res, 400, `Upload error: ${err.message}`);
        } else if (err) {
            return errorResponse(res, 400, err.message);
        }
        next();
    });
};

module.exports = { handleUnifiedUpload };