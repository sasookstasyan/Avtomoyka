function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  return res.status(401).json({ error: "Для продолжения войдите в панель управления." });
}

module.exports = { requireAdmin };
