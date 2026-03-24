function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.originalUrl} not found.`,
    },
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.statusCode || 500;
  const message = error.message || "Internal server error.";

  if (status >= 500) {
    console.error("[error]", error);
  }

  res.status(status).json({
    error: {
      message,
      details: error.details || null,
    },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
