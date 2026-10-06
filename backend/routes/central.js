const express = require("express");
const rateLimit = require("express-rate-limit");
const { all, get, run } = require("../database");
const asyncHandler = require("../middleware/async-handler");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const serviceCategories = ["Мойка кузова", "Мойка салона", "Комплексная мойка", "Дополнительные услуги"];
const menuCategories = ["Блюда дня", "Супы", "Салаты", "Горячие блюда", "Шашлык", "Плов", "Гарниры", "Выпечка", "Напитки"];
const weekdays = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const dailySlots = ["Суп", "Горячее", "Салат", "Гарнир"];
const appointmentStatuses = ["Новая", "Подтверждена", "Выполнена", "Отменена"];
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Слишком много заявок. Позвоните, чтобы записаться." }
});

function validText(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function validPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 && price <= 10000000;
}

function validImage(value) {
  if (value === "" || value === undefined || value === null) return true;
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function flag(value) {
  return value === true || value === "true" || value === "1" || value === 1 ? 1 : 0;
}

function validPhone(value) {
  return typeof value === "string" && /^[+\d][\d\s()\-]{8,24}$/.test(value.trim()) &&
    value.replace(/\D/g, "").length >= 10 && value.replace(/\D/g, "").length <= 15;
}

function validateCatalogItem(body, categories, includeDuration) {
  const { name, description = "", price, category, duration = "", image = "" } = body || {};
  if (!validText(name, 2, 120)) return "Название должно содержать от 2 до 120 символов.";
  if (!validText(description, 0, 2000)) return "Описание не должно превышать 2000 символов.";
  if (!validPrice(price)) return "Укажите неотрицательную цену не выше 10 000 000 ₽.";
  if (typeof category !== "string" || !categories.includes(category)) return "Выберите категорию из списка.";
  if (!validImage(image)) return "Для изображения укажите HTTPS-ссылку.";
  if (includeDuration && !validText(duration, 1, 80)) return "Укажите примерное время выполнения.";
  return null;
}

router.get("/settings", asyncHandler(async (req, res) => {
  const rows = await all("SELECT key, value FROM site_settings");
  res.json(Object.fromEntries(rows.map(({ key, value }) => [key, value])));
}));

router.put("/settings", requireAdmin, asyncHandler(async (req, res) => {
  const allowed = new Set([
    "wash_name", "wash_slogan", "wash_address", "wash_phone", "wash_hours", "wash_map_query",
    "cafe_name", "cafe_description", "cafe_address", "cafe_phone", "cafe_hours", "cafe_logo",
    "social_vk", "social_telegram"
  ]);
  const entries = Object.entries(req.body || {});
  if (!entries.length || entries.some(([key, value]) =>
    !allowed.has(key) || typeof value !== "string" || value.length > 1000 ||
    (["social_vk", "social_telegram", "cafe_logo"].includes(key) && value && !validImage(value))
  )) {
    return res.status(400).json({ error: "Проверьте редактируемые настройки сайта." });
  }
  for (const [key, value] of entries) {
    await run("INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value.trim());
  }
  res.json(Object.fromEntries(await all("SELECT key, value FROM site_settings").then((rows) => rows.map(({ key, value }) => [key, value]))));
}));

router.get("/categories", asyncHandler(async (req, res) => {
  const rows = await all("SELECT id, section, name FROM categories ORDER BY id");
  res.json(rows);
}));

router.post("/categories", requireAdmin, asyncHandler(async (req, res) => {
  const { section, name } = req.body || {};
  if (!["service", "menu"].includes(section) || !validText(name, 2, 80)) {
    return res.status(400).json({ error: "Укажите раздел и название категории." });
  }
  try {
    const result = await run("INSERT INTO categories (section, name) VALUES (?, ?)", section, name.trim());
    return res.status(201).json(await get("SELECT id, section, name FROM categories WHERE id = ?", result.lastID));
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") return res.status(409).json({ error: "Такая категория уже существует." });
    throw error;
  }
}));

router.delete("/categories/:id", requireAdmin, asyncHandler(async (req, res) => {
  const categoryId = Number(req.params.id);
  const category = await get("SELECT * FROM categories WHERE id = ?", categoryId);
  if (!category) return res.status(404).json({ error: "Категория не найдена." });
  const linked = category.section === "service"
    ? await get("SELECT id FROM services WHERE category = ? LIMIT 1", category.name)
    : await get(`SELECT id FROM menu_items WHERE category = ?
      UNION ALL SELECT id FROM dish_library WHERE category = ? LIMIT 1`, category.name, category.name);
  if (linked) return res.status(409).json({ error: "Категория используется. Сначала перенесите её позиции." });
  await run("DELETE FROM categories WHERE id = ?", categoryId);
  return res.status(204).end();
}));

router.get("/services", asyncHandler(async (req, res) => {
  const query = req.query.admin === "1" && req.session?.admin
    ? "SELECT * FROM services ORDER BY id DESC"
    : "SELECT * FROM services WHERE active = 1 ORDER BY id";
  res.json(await all(query));
}));

router.post("/services", requireAdmin, asyncHandler(async (req, res) => {
  const error = validateCatalogItem(req.body, (await all("SELECT name FROM categories WHERE section = 'service'")).map((row) => row.name), true);
  if (error) return res.status(400).json({ error });
  const { name, description = "", price, category, duration, image = "" } = req.body;
  const result = await run(`INSERT INTO services (name, description, price, category, category_id, duration, image, active, test_data)
    VALUES (?, ?, ?, ?, (SELECT id FROM categories WHERE section = 'service' AND name = ?), ?, ?, ?, ?)`,
  name.trim(), description.trim(), Number(price), category, category, duration.trim(), image.trim(), flag(req.body.active), flag(req.body.test_data));
  res.status(201).json(await get("SELECT * FROM services WHERE id = ?", result.lastID));
}));

router.put("/services/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await get("SELECT * FROM services WHERE id = ?", id);
  if (!existing) return res.status(404).json({ error: "Услуга не найдена." });
  const error = validateCatalogItem(req.body, (await all("SELECT name FROM categories WHERE section = 'service'")).map((row) => row.name), true);
  if (error) return res.status(400).json({ error });
  const { name, description = "", price, category, duration, image = "" } = req.body;
  await run(`UPDATE services SET name = ?, description = ?, price = ?, category = ?,
    category_id = (SELECT id FROM categories WHERE section = 'service' AND name = ?),
    duration = ?, image = ?, active = ?, test_data = ? WHERE id = ?`,
  name.trim(), description.trim(), Number(price), category, category, duration.trim(), image.trim(), flag(req.body.active), flag(req.body.test_data), id);
  res.json(await get("SELECT * FROM services WHERE id = ?", id));
}));

router.delete("/services/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await run("DELETE FROM services WHERE id = ?", id);
  if (!result.changes) return res.status(404).json({ error: "Услуга не найдена." });
  res.status(204).end();
}));

router.post("/appointments", bookingLimiter, asyncHandler(async (req, res) => {
  const { name, phone, car, service_id: serviceId, date, time, comment = "" } = req.body || {};
  if (!validText(name, 2, 100) || !validPhone(phone) || !validText(car, 2, 120)) {
    return res.status(400).json({ error: "Проверьте имя, телефон и автомобиль." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time || "")) {
    return res.status(400).json({ error: "Укажите корректные желаемые дату и время." });
  }
  if (typeof comment !== "string" || comment.length > 1000) return res.status(400).json({ error: "Комментарий не должен превышать 1000 символов." });
  let serviceName = "Услуга не выбрана";
  let selectedServiceId = null;
  if (serviceId !== "" && serviceId !== undefined && serviceId !== null) {
    const service = await get("SELECT id, name FROM services WHERE id = ? AND active = 1", Number(serviceId));
    if (!service) return res.status(400).json({ error: "Выбранная услуга сейчас недоступна." });
    serviceName = service.name;
    selectedServiceId = service.id;
  }
  const result = await run(`INSERT INTO appointments (name, phone, car, service_id, service_name, appointment_date, appointment_time, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, name.trim(), phone.trim(), car.trim(), selectedServiceId, serviceName, date, time, comment.trim());
  res.status(201).json({ id: result.lastID, message: "Заявка принята. Администратор свяжется для подтверждения времени." });
}));

router.get("/appointments", requireAdmin, asyncHandler(async (req, res) => {
  res.json(await all("SELECT * FROM appointments ORDER BY created_at DESC, id DESC"));
}));

router.patch("/appointments/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!appointmentStatuses.includes(req.body?.status)) return res.status(400).json({ error: "Выберите корректный статус записи." });
  const result = await run("UPDATE appointments SET status = ? WHERE id = ?", req.body.status, id);
  if (!result.changes) return res.status(404).json({ error: "Запись не найдена." });
  res.json({ id, status: req.body.status });
}));

router.get("/menu", asyncHandler(async (req, res) => {
  const rows = req.query.admin === "1" && req.session?.admin
    ? await all("SELECT * FROM menu_items ORDER BY id DESC")
    : await all("SELECT * FROM menu_items WHERE available = 1 ORDER BY id");
  res.json(rows);
}));

router.post("/menu", requireAdmin, asyncHandler(async (req, res) => {
  const error = validateCatalogItem(req.body, (await all("SELECT name FROM categories WHERE section = 'menu'")).map((row) => row.name), false);
  if (error) return res.status(400).json({ error });
  const { name, description = "", price, category, image = "" } = req.body;
  const result = await run(`INSERT INTO menu_items (name, description, price, category, category_id, image, available, test_data)
    VALUES (?, ?, ?, ?, (SELECT id FROM categories WHERE section = 'menu' AND name = ?), ?, ?, ?)`,
  name.trim(), description.trim(), Number(price), category, category, image.trim(), flag(req.body.available), flag(req.body.test_data));
  res.status(201).json(await get("SELECT * FROM menu_items WHERE id = ?", result.lastID));
}));

router.put("/menu/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!await get("SELECT id FROM menu_items WHERE id = ?", id)) return res.status(404).json({ error: "Блюдо не найдено." });
  const error = validateCatalogItem(req.body, (await all("SELECT name FROM categories WHERE section = 'menu'")).map((row) => row.name), false);
  if (error) return res.status(400).json({ error });
  const { name, description = "", price, category, image = "" } = req.body;
  await run(`UPDATE menu_items SET name = ?, description = ?, price = ?, category = ?,
    category_id = (SELECT id FROM categories WHERE section = 'menu' AND name = ?),
    image = ?, available = ?, test_data = ? WHERE id = ?`,
  name.trim(), description.trim(), Number(price), category, category, image.trim(), flag(req.body.available), flag(req.body.test_data), id);
  res.json(await get("SELECT * FROM menu_items WHERE id = ?", id));
}));

router.delete("/menu/:id", requireAdmin, asyncHandler(async (req, res) => {
  const result = await run("DELETE FROM menu_items WHERE id = ?", Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Блюдо не найдено." });
  res.status(204).end();
}));

router.get("/dish-library", requireAdmin, asyncHandler(async (req, res) => {
  const rows = await all(`SELECT dish_library.* FROM dish_library
    LEFT JOIN categories ON categories.section = 'menu' AND categories.name = dish_library.category
    ORDER BY categories.id, dish_library.name COLLATE NOCASE, dish_library.id`);
  res.json(rows);
}));

router.post("/dish-library", requireAdmin, asyncHandler(async (req, res) => {
  const validCategories = (await all("SELECT name FROM categories WHERE section = 'menu'")).map((row) => row.name);
  const error = validateCatalogItem(req.body, validCategories, false);
  if (error) return res.status(400).json({ error });
  const { name, description = "", price, category, image = "" } = req.body;
  const result = await run(`INSERT INTO dish_library (name, description, price, category, category_id, image, available, test_data)
    VALUES (?, ?, ?, ?, (SELECT id FROM categories WHERE section = 'menu' AND name = ?), ?, ?, ?)`,
  name.trim(), description.trim(), Number(price), category, category, image.trim(), flag(req.body.available), flag(req.body.test_data));
  res.status(201).json(await get("SELECT * FROM dish_library WHERE id = ?", result.lastID));
}));

router.put("/dish-library/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!await get("SELECT id FROM dish_library WHERE id = ?", id)) {
    return res.status(404).json({ error: "Блюдо-заготовка не найдено." });
  }
  const validCategories = (await all("SELECT name FROM categories WHERE section = 'menu'")).map((row) => row.name);
  const error = validateCatalogItem(req.body, validCategories, false);
  if (error) return res.status(400).json({ error });
  const { name, description = "", price, category, image = "" } = req.body;
  await run(`UPDATE dish_library SET name = ?, description = ?, price = ?, category = ?,
    category_id = (SELECT id FROM categories WHERE section = 'menu' AND name = ?),
    image = ?, available = ?, test_data = ? WHERE id = ?`,
  name.trim(), description.trim(), Number(price), category, category, image.trim(), flag(req.body.available), flag(req.body.test_data), id);
  res.json(await get("SELECT * FROM dish_library WHERE id = ?", id));
}));

router.delete("/dish-library/:id", requireAdmin, asyncHandler(async (req, res) => {
  const result = await run("DELETE FROM dish_library WHERE id = ?", Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Блюдо-заготовка не найдено." });
  res.status(204).end();
}));

router.get("/daily-menu", asyncHandler(async (req, res) => {
  const order = "ORDER BY weekday, CASE slot WHEN 'Суп' THEN 0 WHEN 'Горячее' THEN 1 WHEN 'Салат' THEN 2 WHEN 'Гарнир' THEN 3 ELSE 4 END, name COLLATE NOCASE, id";
  const rows = req.query.admin === "1" && req.session?.admin
    ? await all(`SELECT * FROM daily_menu ${order}`)
    : await all(`SELECT * FROM daily_menu WHERE available = 1 ${order}`);
  res.json(rows);
}));

router.post("/daily-menu/:weekday", requireAdmin, asyncHandler(async (req, res) => {
  const weekday = Number(req.params.weekday);
  const { slot, name, description = "", price, image = "" } = req.body || {};
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !dailySlots.includes(slot) ||
      !validText(name, 2, 120) || !validText(description, 0, 2000) || !validPrice(price) || !validImage(image)) {
    return res.status(400).json({ error: "Проверьте день, тип блюда, название, цену и изображение." });
  }
  const result = await run(`INSERT INTO daily_menu (weekday, slot, name, description, price, image, available, test_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  weekday, slot, name.trim(), description.trim(), Number(price), image.trim(), flag(req.body.available), flag(req.body.test_data));
  res.status(201).json(await get("SELECT * FROM daily_menu WHERE id = ?", result.lastID));
}));

router.put("/daily-menu/:id", requireAdmin, asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return next();
  const { weekday, slot, name, description = "", price, image = "" } = req.body || {};
  if (!Number.isInteger(Number(weekday)) || Number(weekday) < 0 || Number(weekday) > 6 || !dailySlots.includes(slot) ||
      !validText(name, 2, 120) || !validText(description, 0, 2000) || !validPrice(price) || !validImage(image)) {
    return res.status(400).json({ error: "Проверьте день, тип блюда, название, цену и изображение." });
  }
  const result = await run(`UPDATE daily_menu SET weekday = ?, slot = ?, name = ?, description = ?,
    price = ?, image = ?, available = ?, test_data = ? WHERE id = ?`,
  Number(weekday), slot, name.trim(), description.trim(), Number(price), image.trim(),
  flag(req.body.available), flag(req.body.test_data), id);
  if (!result.changes) return res.status(404).json({ error: "Блюдо дня не найдено." });
  res.json(await get("SELECT * FROM daily_menu WHERE id = ?", id));
}));

router.put("/daily-menu/:weekday/:slot", requireAdmin, asyncHandler(async (req, res) => {
  const weekday = Number(req.params.weekday);
  const slot = req.params.slot;
  const { name, description = "", price, image = "" } = req.body || {};
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !dailySlots.includes(slot) ||
      !validText(name, 2, 120) || !validText(description, 0, 2000) || !validPrice(price) || !validImage(image)) {
    return res.status(400).json({ error: "Проверьте день, тип блюда, название, цену и изображение." });
  }
  const existing = await get("SELECT id FROM daily_menu WHERE weekday = ? AND slot = ? ORDER BY id LIMIT 1", weekday, slot);
  if (existing) {
    await run(`UPDATE daily_menu SET name = ?, description = ?, price = ?, image = ?, available = ?, test_data = ?
      WHERE id = ?`,
    name.trim(), description.trim(), Number(price), image.trim(), flag(req.body.available), flag(req.body.test_data), existing.id);
    return res.json(await get("SELECT * FROM daily_menu WHERE id = ?", existing.id));
  }
  const result = await run(`INSERT INTO daily_menu (weekday, slot, name, description, price, image, available, test_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  weekday, slot, name.trim(), description.trim(), Number(price), image.trim(), flag(req.body.available), flag(req.body.test_data));
  res.status(201).json(await get("SELECT * FROM daily_menu WHERE id = ?", result.lastID));
}));

router.delete("/daily-menu/item/:id", requireAdmin, asyncHandler(async (req, res) => {
  const result = await run("DELETE FROM daily_menu WHERE id = ?", Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Блюдо дня не найдено." });
  res.status(204).end();
}));

router.delete("/daily-menu/:weekday/:slot", requireAdmin, asyncHandler(async (req, res) => {
  const weekday = Number(req.params.weekday);
  const slot = req.params.slot;
  const result = await run("DELETE FROM daily_menu WHERE id = (SELECT id FROM daily_menu WHERE weekday = ? AND slot = ? ORDER BY id LIMIT 1)", weekday, slot);
  if (!result.changes) return res.status(404).json({ error: "Блюдо дня не найдено." });
  res.status(204).end();
}));

router.get("/meta", (req, res) => res.json({ weekdays, dailySlots }));

module.exports = router;
