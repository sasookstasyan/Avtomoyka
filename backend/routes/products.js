const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const multer = require("multer");
const { all, get, run } = require("../database");
const asyncHandler = require("../middleware/async-handler");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const uploadsDirectory = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDirectory, { recursive: true });

const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDirectory,
    filename: (req, file, callback) => {
      callback(null, `${crypto.randomUUID()}${allowedImageTypes.get(file.mimetype) || ".img"}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      return callback(new Error("Загрузите изображение JPEG, PNG или WebP размером до 5 МБ."));
    }
    return callback(null, true);
  }
});

function removeUploadedImage(imagePath) {
  // Never let a product record turn into a path outside the dedicated uploads folder.
  if (typeof imagePath !== "string" || !imagePath.startsWith("/uploads/")) return;
  const filename = path.basename(imagePath);
  const absolutePath = path.join(uploadsDirectory, filename);
  if (path.dirname(absolutePath) === uploadsDirectory && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

function invalidProduct(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseProduct(body, uploadedFile, existingImage = "") {
  const { name, description, price, weight, image, available } = body || {};
  const parsedPrice = Number(price);

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
    throw invalidProduct("Название должно содержать от 2 до 120 символов.");
  }
  if (typeof description !== "string" || description.trim().length < 5 || description.trim().length > 2000) {
    throw invalidProduct("Описание должно содержать от 5 до 2000 символов.");
  }
  if (!Number.isInteger(parsedPrice) || parsedPrice < 1 || parsedPrice > 10000000) {
    throw invalidProduct("Укажите корректную цену в рублях.");
  }
  if (typeof weight !== "string" || weight.trim().length < 1 || weight.trim().length > 50) {
    throw invalidProduct("Укажите вес товара.");
  }

  let imageUrl = existingImage;
  if (uploadedFile) {
    imageUrl = `/uploads/${uploadedFile.filename}`;
  } else if (typeof image === "string" && image.trim()) {
    let parsedUrl;
    try {
      parsedUrl = new URL(image.trim());
    } catch {
      parsedUrl = null;
    }
    if (
      /^\/uploads\/[A-Za-z0-9_.-]+$/.test(image.trim()) ||
      (parsedUrl && parsedUrl.protocol === "https:")
    ) {
      imageUrl = image.trim();
    } else {
      throw invalidProduct("Укажите корректную HTTPS-ссылку на изображение или загрузите файл.");
    }
  }
  if (!imageUrl) throw invalidProduct("Добавьте ссылку на фото или загрузите изображение.");

  return {
    name: name.trim(),
    description: description.trim(),
    price: parsedPrice,
    weight: weight.trim(),
    image: imageUrl,
    available: available === true || available === "true" || available === "1" ? 1 : 0
  };
}

function handleProductUpload(req, res, next) {
  upload.single("imageFile")(req, res, (error) => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Изображение не должно превышать 5 МБ."
        : error.message;
      return res.status(400).json({ error: message });
    }
    return next();
  });
}

router.get("/", asyncHandler(async (req, res) => {
  const products = await all("SELECT * FROM products WHERE available = 1 ORDER BY id");
  res.json(products);
}));

router.get("/admin/list", requireAdmin, asyncHandler(async (req, res) => {
  res.json(await all("SELECT * FROM products ORDER BY id"));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId < 1) {
    return res.status(400).json({ error: "Некорректный номер товара." });
  }
  const product = await get("SELECT * FROM products WHERE id = ? AND available = 1", productId);
  if (!product) return res.status(404).json({ error: "Товар не найден." });
  res.json(product);
}));

router.post("/admin", requireAdmin, handleProductUpload, asyncHandler(async (req, res, next) => {
  try {
    const product = parseProduct(req.body, req.file);
    const result = await run(`
      INSERT INTO products (name, description, price, weight, image, available)
      VALUES (?, ?, ?, ?, ?, ?)
    `, product.name, product.description, product.price, product.weight, product.image, product.available);
    return res.status(201).json(await get("SELECT * FROM products WHERE id = ?", result.lastID));
  } catch (error) {
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    if (error.status === 400) return res.status(400).json({ error: error.message });
    throw error;
  }
}));

router.put("/admin/:id", requireAdmin, handleProductUpload, asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId < 1) {
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    return res.status(400).json({ error: "Некорректный номер товара." });
  }

  const existing = await get("SELECT * FROM products WHERE id = ?", productId);
  if (!existing) {
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    return res.status(404).json({ error: "Товар не найден." });
  }

  try {
    const product = parseProduct(req.body, req.file, existing.image);
    await run(`
      UPDATE products
      SET name = ?, description = ?, price = ?, weight = ?, image = ?, available = ?
      WHERE id = ?
    `, product.name, product.description, product.price, product.weight, product.image, product.available, productId);
    // Keep the old file until the database points at the replacement.
    if (req.file && existing.image !== product.image) removeUploadedImage(existing.image);
    return res.json(await get("SELECT * FROM products WHERE id = ?", productId));
  } catch (error) {
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    if (error.status === 400) return res.status(400).json({ error: error.message });
    throw error;
  }
}));

router.delete("/admin/:id", requireAdmin, asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId < 1) {
    return res.status(400).json({ error: "Некорректный номер товара." });
  }
  const product = await get("SELECT * FROM products WHERE id = ?", productId);
  if (!product) return res.status(404).json({ error: "Товар не найден." });

  const order = await get("SELECT id FROM orders WHERE product_id = ? LIMIT 1", productId);
  if (order) {
    return res.status(409).json({
      error: "Этот товар есть в заказах. Снимите его с продажи вместо удаления."
    });
  }

  await run("DELETE FROM products WHERE id = ?", productId);
  removeUploadedImage(product.image);
  return res.status(204).end();
}));

module.exports = router;
