const multer = require('multer');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Unsupported image type. Use JPEG, PNG, WEBP, or GIF.'));
    }
    cb(null, true);
  },
});

/**
 * Wraps multer's single-file middleware so upload errors (bad type, too
 * large, missing file) come back as a clean 400 instead of falling through
 * to the generic 500 handler.
 */
function handleImageUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Invalid image upload' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided (expected field "image")' });
    }
    next();
  });
}

module.exports = { handleImageUpload, MAX_IMAGE_BYTES };
