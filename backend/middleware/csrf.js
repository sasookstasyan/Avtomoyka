const crypto = require("node:crypto");

const protectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function csrfProtection(req, res, next) {
  if (!protectedMethods.has(req.method)) return next();

  const submittedToken = req.get("x-csrf-token");
  const storedToken = req.session?.csrfToken;

  if (!submittedToken || !storedToken) {
    return res.status(403).json({ error: "Обновите страницу и повторите действие." });
  }

  const submitted = Buffer.from(submittedToken);
  const stored = Buffer.from(storedToken);
  if (submitted.length !== stored.length || !crypto.timingSafeEqual(submitted, stored)) {
    return res.status(403).json({ error: "Не удалось подтвердить запрос. Обновите страницу." });
  }

  return next();
}

module.exports = { csrfProtection };
