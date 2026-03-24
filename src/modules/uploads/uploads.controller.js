const { resolveRequestViewer } = require("../auth/auth.service");
const { uploadDocument, uploadImage } = require("./uploads.service");

async function createAttachment(req, res) {
  const { viewer } = await resolveRequestViewer(req, res);
  const attachment = await uploadImage({
    viewer,
    file: req.file,
    chatId: req.body.chatId || null,
  });

  res.status(201).json({ attachment });
}

async function createDocument(req, res) {
  const { viewer } = await resolveRequestViewer(req, res);
  const document = await uploadDocument({
    viewer,
    file: req.file,
    chatId: req.body.chatId || null,
  });

  res.status(201).json({ document });
}

module.exports = {
  createAttachment,
  createDocument,
};
