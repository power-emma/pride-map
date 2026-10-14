const multer = require('multer');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      const error = new Error('Unsupported image type.');
      error.code = 'UNSUPPORTED_IMAGE_TYPE';
      return cb(error);
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
      const code = err.code === 'LIMIT_FILE_SIZE'
        ? 'IMAGE_TOO_LARGE'
        : err.code === 'UNSUPPORTED_IMAGE_TYPE'
          ? 'UNSUPPORTED_IMAGE_TYPE'
          : 'INVALID_IMAGE_UPLOAD';
      return res.status(400).json({ code });
    }
    if (!req.file) {
      return res.status(400).json({ code: 'IMAGE_FILE_REQUIRED' });
    }
    next();
  });
}

module.exports = { handleImageUpload, MAX_IMAGE_BYTES };
