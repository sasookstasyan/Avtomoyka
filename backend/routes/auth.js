const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const username = process.env.ADMIN_USERNAME;
const configuredPassword = process.env.ADMIN_PASSWORD;

if (!username || !configuredPassword) {
  throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD in the environment before starting.");
}

const passwordHash = bcrypt.hashSync(configuredPassword, bcrypt.genSaltSync(12));
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Слишком много попыток входа. Попробуйте позже." }
});

router.get("/csrf-token", (req, res) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  res.json({ csrfToken: req.session.csrfToken });
});

router.get("/me", (req, res) => {
  res.json({ authenticated: Boolean(req.session.admin) });
});

router.post("/login", loginLimiter, (req, res, next) => {
  const { login, password } = req.body || {};
  if (typeof login !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Введите логин и пароль." });
  }

  const validUsername = login === username;
  const validPassword = bcrypt.compareSync(password, passwordHash);
  if (!validUsername || !validPassword) {
    return res.status(401).json({ error: "Неверный логин или пароль." });
  }

  // Rotate the session identifier after authentication to prevent session fixation.
  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.admin = true;
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    return req.session.save((saveError) => {
      if (saveError) return next(saveError);
      return res.json({ authenticated: true, csrfToken: req.session.csrfToken });
    });
  });
});

router.post("/logout", requireAdmin, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("pastry.sid");
    return res.json({ authenticated: false });
  });
});

module.exports = router;
