export const sendSuccess = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ success: true, data });

export const sendMessage = (res, message, statusCode = 200) =>
  res.status(statusCode).json({ success: true, message });
