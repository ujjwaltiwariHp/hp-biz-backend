const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { errorResponse } = require('../utils/errorResponse');

//  Configure Multer to store file in memory (RAM) for processing
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed (JPEG, PNG, WEBP, etc.).'), false);
  }
};

// 3. Initialize Multer
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit input to 10MB before compression
  fileFilter: fileFilter
});

const compressProfilePicture = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    // Define upload directory
    const uploadDir = path.join(__dirname, '../../public/uploads/profile_pictures');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `staff-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpeg`;
    const filepath = path.join(uploadDir, filename);

    // Sharp automatically detects input format (jpeg, png, webp, tiff, gif, etc.)
    await sharp(req.file.buffer)
      .resize({ width: 800, withoutEnlargement: true }) // Resize to max width 800px
      .toFormat('jpeg')
      .jpeg({ quality: 80 }) // Compress to 80% quality
      .toFile(filepath);

    req.body.profile_picture = `/uploads/profile_pictures/${filename}`;

    next();
  } catch (error) {
    console.error('Image compression error:', error);
    return errorResponse(res, 500, 'Failed to process profile image.');
  }
};

//! lead images
const compressedLeadImages = async (req, res, next) => {
  if(!req.files || !req.files.length) return next()

    try {
      const uploadDir = path.join(__dirname, "../../public/uploads/lead_images")

      if(!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive : true})
      }

      const images = []

      for (const file of req.files) {
        const filename = `lead-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpeg`

        const filepath = path.join(uploadDir, filename)

        await sharp(file.buffer).
        resize({width : 1200, withoutEnlargement : true})
        .toFormat('jpeg')
        .jpeg({quality : 80})
        .toFile(filepath)

        images.push(`/uploads/lead_images/${filename}`)
      }

      req.body.lead_images = images

      next()
    } catch (error) {
      console.error("Lead image compressed error ", error )      
      return errorResponse(res, 500, "Failed to process lead image")
    }
}

module.exports = {
  uploadProfilePicture: upload.single('profile_picture'),
  compressProfilePicture,

  uploadLeadImages : upload.array('lead_images', 10),
  compressedLeadImages
};