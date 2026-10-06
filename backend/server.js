require("dotenv").config();

const path = require("node:path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { csrfProtection } = require("./middleware/csrf");
const SQLiteSessionStore = require("./session-store");
const { db, initializeDatabase } = require("./database");

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error("Set a SESSION_SECRET with at least 32 characters in production.");
}

const app = express();
const frontendDirectory = path.join(__dirname, "..", "frontend");
const uploadDirectory = path.join(__dirname, "uploads");
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(session({
  name: "pastry.sid",
  secret: sessionSecret || "development-only-secret-change-before-deploying",
  store: new SQLiteSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use(csrfProtection);

app.use("/uploads", express.static(uploadDirectory, {
  dotfiles: "deny",
  index: false,
  maxAge: isProduction ? "7d" : 0
}));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/central", require("./routes/central"));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/admin", (req, res) => res.sendFile(path.join(frontendDirectory, "admin.html")));
app.get("/admin/cafe-menu", (req, res) => {
  if (!req.session?.admin) return res.redirect(302, "/admin");
  res.set("Cache-Control", "no-store");
  return res.sendFile(path.join(__dirname, "private", "cafe-menu.html"));
});
app.get("/marusya", (req, res) => res.sendFile(path.join(frontendDirectory, "marusya.html")));
app.use(express.static(frontendDirectory, { extensions: ["html"] }));

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Маршрут не найден." });
  return res.status(404).sendFile(path.join(frontendDirectory, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: "Внутренняя ошибка сервера. Попробуйте позже." });
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Сайт запущен: http://localhost:${port}`);
      console.log(`Админ-панель: http://localhost:${port}/admin`);
      if (!isProduction) {
        console.log("Режим разработки: учётные данные админ-панели загружены из окружения.");
      }
    });
  })
  .catch((error) => {
    console.error("Не удалось инициализировать базу данных SQLite:", error);
    db.close(() => {
      process.exitCode = 1;
    });
  });
