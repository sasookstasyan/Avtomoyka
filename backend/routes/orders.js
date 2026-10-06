const express = require("express");
const rateLimit = require("express-rate-limit");
const { all, get, run } = require("../database");
const asyncHandler = require("../middleware/async-handler");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const orderStatuses = ["Новый", "В обработке", "Выполнен", "Отменён"];
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Слишком много заказов с этого соединения. Попробуйте позже." }
});

router.post("/", orderLimiter, asyncHandler(async (req, res) => {
  const { customer_name: customerName, phone, product_id: productId, quantity, comment = "" } = req.body || {};

  if (typeof customerName !== "string" || customerName.trim().length < 2 || customerName.trim().length > 100) {
    return res.status(400).json({ error: "Укажите имя (от 2 до 100 символов)." });
  }
  if (
    typeof phone !== "string" ||
    !/^[+\d][\d\s()\-]{8,24}$/.test(phone.trim()) ||
    phone.replace(/\D/g, "").length < 10 ||
    phone.replace(/\D/g, "").length > 15
  ) {
    return res.status(400).json({ error: "Введите корректный номер телефона." });
  }
  if (!Number.isInteger(Number(productId)) || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 20) {
    return res.status(400).json({ error: "Проверьте выбранный товар и количество." });
  }
  if (typeof comment !== "string" || comment.trim().length > 1000) {
    return res.status(400).json({ error: "Комментарий не должен превышать 1000 символов." });
  }

  const product = await get("SELECT id, name FROM products WHERE id = ? AND available = 1", Number(productId));
  if (!product) return res.status(404).json({ error: "Этот товар сейчас недоступен." });

  const result = await run(`
    INSERT INTO orders (customer_name, phone, product_id, quantity, comment)
    VALUES (?, ?, ?, ?, ?)
  `, customerName.trim(), phone.trim(), product.id, Number(quantity), comment.trim());

  return res.status(201).json({
    id: Number(result.lastID),
    message: "Спасибо! Мы получили ваш заказ и скоро свяжемся с вами."
  });
}));

router.get("/admin", requireAdmin, asyncHandler(async (req, res) => {
  const orders = await all(`
    SELECT orders.id, orders.customer_name, orders.phone, orders.product_id,
      products.name AS product_name, orders.quantity, orders.comment,
      orders.status, orders.created_at
    FROM orders
    JOIN products ON products.id = orders.product_id
    ORDER BY orders.created_at DESC, orders.id DESC
  `);

  res.json(orders);
}));

router.patch("/admin/:id/status", requireAdmin, asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  const { status } = req.body;
  if (!Number.isInteger(orderId) || orderId < 1 || !orderStatuses.includes(status)) {
    return res.status(400).json({ error: "Проверьте статус заказа." });
  }

  const result = await run("UPDATE orders SET status = ? WHERE id = ?", status, orderId);
  if (!result.changes) return res.status(404).json({ error: "Заказ не найден." });

  res.json({ id: orderId, status });
}));

module.exports = router;
