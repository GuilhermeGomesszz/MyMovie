export  const validateRequest = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map(({ message }) => message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    req.body = result.data;
    next();
  }}