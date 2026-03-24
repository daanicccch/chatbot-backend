const express = require("express");
const multer = require("multer");

const { asyncHandler } = require("../../middleware/asyncHandler");
const uploadsController = require("./uploads.controller");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

router.post(
  "/attachments",
  upload.single("file"),
  asyncHandler(uploadsController.createAttachment),
);

router.post(
  "/documents",
  upload.single("file"),
  asyncHandler(uploadsController.createDocument),
);

module.exports = router;
