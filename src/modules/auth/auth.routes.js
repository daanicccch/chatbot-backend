const express = require("express");

const { asyncHandler } = require("../../middleware/asyncHandler");
const authController = require("./auth.controller");

const router = express.Router();

router.get("/session", asyncHandler(authController.getSession));
router.post("/logout", asyncHandler(authController.logout));

module.exports = router;
