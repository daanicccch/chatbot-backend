const express = require("express");

const { asyncHandler } = require("../../middleware/asyncHandler");
const chatsController = require("./chats.controller");

const router = express.Router();

router.get("/", asyncHandler(chatsController.getChats));
router.post("/", asyncHandler(chatsController.createChat));
router.get("/:chatId", asyncHandler(chatsController.getChat));
router.post("/:chatId/messages", chatsController.streamMessage);

module.exports = router;
