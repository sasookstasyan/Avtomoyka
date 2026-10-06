const fs = require("node:fs");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

const dataDirectory = path.join(__dirname, "..", "database");
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new sqlite3.Database(path.join(dataDirectory, "shop.db"));

function run(sql, ...params) {
  return new Promise((resolve, reject) => {
    db.run(sql, ...params, function (error) {
      if (error) return reject(error);
      return resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, ...params) {
  return new Promise((resolve, reject) => {
    db.get(sql, ...params, (error, row) => {
      if (error) return reject(error);
      return resolve(row);
    });
  });
}

function all(sql, ...params) {
  return new Promise((resolve, reject) => {
    db.all(sql, ...params, (error, rows) => {
      if (error) return reject(error);
      return resolve(rows);
    });
  });
}

const initialProducts = [
  {
    name: "Советские торты",
    description: "Ассорти тортов из каталога сообщества. Варианты, состав и вес уточняются перед заказом.",
    price: 2000,
    weight: "торт",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Бенто",
    description: "Небольшой торт для подарка или личного праздника. Оформление обсудите с кондитером.",
    price: 1500,
    weight: "торт",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Торты на заказ",
    description: "Праздничный торт по вашей идее. Вкус, оформление, вес и срок согласуются при заказе.",
    price: 2100,
    weight: "торт",
    image: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Медовик",
    description: "Классический медовый торт из каталога. Размер и оформление уточняются перед заказом.",
    price: 2100,
    weight: "торт",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Наполеон",
    description: "Слоёный торт из каталога. Размер и оформление уточняются перед заказом.",
    price: 2100,
    weight: "торт",
    image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Ромовая баба",
    description: "Сладкая выпечка к чаю из каталога сообщества. Актуальную цену и наличие уточните при заказе.",
    price: 1200,
    weight: "шт.",
    image: "https://images.unsplash.com/photo-1524351199678-941a58a3df50?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Трайфл",
    description: "Порционный десерт в стаканчике из каталога сообщества.",
    price: 300,
    weight: "стаканчик",
    image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Кейк-бокс",
    description: "Подарочный набор десертов. Состав набора уточните перед оформлением заказа.",
    price: 850,
    weight: "набор",
    image: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Капкейки",
    description: "Порционные капкейки из каталога. Количество и декор согласуются при заказе.",
    price: 220,
    weight: "шт.",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=960&q=85"
  }
];

const starterProducts = [
  {
    name: "Медовик",
    description: "Тонкие медовые коржи, нежный сметанный крем и немного домашнего уюта.",
    price: 1850,
    weight: "1 кг",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Наполеон",
    description: "Хрустящие слоёные коржи и заварной крем с натуральной ванилью.",
    price: 2100,
    weight: "1 кг",
    image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Красный бархат",
    description: "Бархатный бисквит, лёгкий сливочный крем и ягоды по сезону.",
    price: 2450,
    weight: "1 кг",
    image: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Шоколадный",
    description: "Насыщенный шоколадный бисквит, ганаш из тёмного шоколада.",
    price: 2300,
    weight: "1 кг",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Три шоколада",
    description: "Три воздушных мусса: тёмный, молочный и белый шоколад.",
    price: 2700,
    weight: "1 кг",
    image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=960&q=85"
  },
  {
    name: "Чизкейк",
    description: "Запечённый сливочный чизкейк на хрустящей песочной основе.",
    price: 1950,
    weight: "1 кг",
    image: "https://images.unsplash.com/photo-1524351199678-941a58a3df50?auto=format&fit=crop&w=960&q=85"
  }
];

async function initializeDatabase() {
  await run("PRAGMA journal_mode = WAL");
  await run("PRAGMA foreign_keys = ON");
  await new Promise((resolve, reject) => {
    db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    weight TEXT NOT NULL,
    image TEXT NOT NULL,
    available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
    comment TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Новый'
      CHECK (status IN ('Новый', 'В обработке', 'Выполнен', 'Отменён')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires);

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    duration TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    test_data INTEGER NOT NULL DEFAULT 0 CHECK (test_data IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    car TEXT NOT NULL,
    service_id INTEGER,
    service_name TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Новая'
      CHECK (status IN ('Новая', 'Подтверждена', 'Выполнена', 'Отменена')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    image TEXT NOT NULL DEFAULT '',
    available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
    test_data INTEGER NOT NULL DEFAULT 0 CHECK (test_data IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS dish_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    image TEXT NOT NULL DEFAULT '',
    available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
    test_data INTEGER NOT NULL DEFAULT 0 CHECK (test_data IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS daily_menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    slot TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL CHECK (price >= 0),
    image TEXT NOT NULL DEFAULT '',
    available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
    test_data INTEGER NOT NULL DEFAULT 0 CHECK (test_data IN (0, 1)),
    UNIQUE (weekday, slot)
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL CHECK (section IN ('service', 'menu')),
    name TEXT NOT NULL,
    UNIQUE (section, name)
  );
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`, (error) => error ? reject(error) : resolve());
  });

  const dailyMenuSchema = await get("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'daily_menu'");
  if (dailyMenuSchema?.sql?.includes("UNIQUE (weekday, slot)")) {
    await run("BEGIN IMMEDIATE");
    try {
      await run(`CREATE TABLE daily_menu_multi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
        slot TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price REAL NOT NULL CHECK (price >= 0),
        image TEXT NOT NULL DEFAULT '',
        available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
        test_data INTEGER NOT NULL DEFAULT 0 CHECK (test_data IN (0, 1))
      )`);
      await run(`INSERT INTO daily_menu_multi
        (id, weekday, slot, name, description, price, image, available, test_data)
        SELECT id, weekday, slot, name, description, price, image, available, test_data
        FROM daily_menu ORDER BY id`);
      await run("DROP TABLE daily_menu");
      await run("ALTER TABLE daily_menu_multi RENAME TO daily_menu");
      await run("COMMIT");
    } catch (error) {
      await run("ROLLBACK");
      throw error;
    }
  }

  const washCategories = ["Мойка кузова", "Мойка салона", "Комплексная мойка", "Дополнительные услуги"];
  const cafeCategories = ["Блюда дня", "Супы", "Салаты", "Горячие блюда", "Шашлык", "Плов", "Гарниры", "Выпечка", "Напитки"];
  for (const name of washCategories) {
    await run("INSERT OR IGNORE INTO categories (section, name) VALUES ('service', ?)", name);
  }
  for (const name of cafeCategories) {
    await run("INSERT OR IGNORE INTO categories (section, name) VALUES ('menu', ?)", name);
  }

  for (const table of ["services", "menu_items"]) {
    const columns = await all(`PRAGMA table_info(${table})`);
    if (!columns.some((column) => column.name === "category_id")) {
      await run(`ALTER TABLE ${table} ADD COLUMN category_id INTEGER REFERENCES categories(id)`);
    }
    const section = table === "services" ? "service" : "menu";
    await run(`UPDATE ${table} SET category_id = (
      SELECT id FROM categories WHERE categories.section = ? AND categories.name = ${table}.category
    ) WHERE category_id IS NULL`, section);
    await run(`CREATE INDEX IF NOT EXISTS ${table}_category_id_idx ON ${table} (category_id)`);
  }
  await run(`CREATE INDEX IF NOT EXISTS dish_library_category_name_idx
    ON dish_library (category_id, name COLLATE NOCASE)`);

  const initialSettings = {
    wash_name: "Автомойка Центральная",
    wash_slogan: "Чистый автомобиль — лёгкое начало нового дня.",
    wash_address: "Иваново, ул. Багаева, 5",
    wash_phone: "+7 (4932) 21-66-90",
    wash_hours: "Ежедневно, 08:00–21:00",
    wash_map_query: "Иваново, ул. Багаева, 5",
    cafe_name: "Кафе Маруся",
    cafe_description: "Страница кафе «Маруся». Информация о меню, режиме и контактах будет опубликована владельцем.",
    cafe_address: "Иваново, ул. Багаева, 5, 1 этаж",
    cafe_phone: "",
    cafe_hours: "",
    cafe_logo: "",
    social_vk: "",
    social_telegram: ""
  };
  for (const [key, value] of Object.entries(initialSettings)) {
    await run("INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)", key, value);
  }

  const demoCafeMenuSeeded = await get("SELECT value FROM app_meta WHERE key = 'central_cafe_demo_menu_v1'");
  if (!demoCafeMenuSeeded) {
    const demoMenu = [
      ["Демо: суп дня", "Демонстрационный пример. Не подтверждает, что блюдо есть в меню кафе.", "Супы", "photo-1547592180-85f173990554"],
      ["Демо: свежий салат", "Демонстрационный пример. Состав и наличие необходимо подтвердить у владельца.", "Салаты", "photo-1546069901-ba9599a7e63c"],
      ["Демо: горячее дня", "Демонстрационный пример. Не является подтверждённой позицией меню.", "Горячие блюда", "photo-1540189549336-e6e99c3679fe"],
      ["Демо: шашлык", "Демонстрационный пример фотографии. Блюдо и наличие необходимо подтвердить.", "Шашлык", "photo-1529193591184-b1d58069ecdd"],
      ["Демо: плов", "Демонстрационный пример. Не является подтверждённой позицией меню.", "Плов", "photo-1512058564366-18510be2db19"],
      ["Демо: выпечка", "Демонстрационный пример фотографии. Ассортимент необходимо подтвердить.", "Выпечка", "photo-1509440159596-0249088772ff"],
      ["Демо: чай", "Демонстрационный пример фотографии. Наличие необходимо подтвердить у владельца.", "Напитки", "photo-1544787219-7f47ccb76574"]
    ];
    await run("BEGIN IMMEDIATE");
    try {
      for (const [name, description, category, photoId] of demoMenu) {
        await run(`INSERT INTO menu_items
          (name, description, price, category, category_id, image, available, test_data)
          VALUES (?, ?, 1, ?, (SELECT id FROM categories WHERE section = 'menu' AND name = ?),
            ?, 1, 1)`,
        name, description, category, category,
        `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=960&q=85`);
      }
      await run("INSERT INTO app_meta (key, value) VALUES ('central_cafe_demo_menu_v1', '1')");
      await run("COMMIT");
    } catch (error) {
      await run("ROLLBACK");
      throw error;
    }
  }

  const dishLibrarySeeded = await get("SELECT value FROM app_meta WHERE key = 'central_dish_library_v1'");
  if (!dishLibrarySeeded) {
    await run(`INSERT INTO dish_library
      (name, description, price, category, category_id, image, available, test_data)
      SELECT name, description, price, category, category_id, image, available, test_data
      FROM menu_items
      ORDER BY category_id, name COLLATE NOCASE`);
    await run("INSERT INTO app_meta (key, value) VALUES ('central_dish_library_v1', '1')");
  }

  const washCatalogSeeded = await get("SELECT value FROM app_meta WHERE key = 'central_wash_catalog_v1'");
  if (!washCatalogSeeded) {
    const demoServices = [
      ["Демо: мойка кузова", "Тестовая позиция. Наличие услуги и стоимость необходимо подтвердить у владельца до публикации.", 1, washCategories[0], "30 мин"],
      ["Демо: уборка салона", "Тестовая позиция. Наличие услуги и стоимость необходимо подтвердить у владельца до публикации.", 1, washCategories[1], "45 мин"],
      ["Демо: комплексная мойка", "Тестовая позиция. Наличие услуги и стоимость необходимо подтвердить у владельца до публикации.", 1, washCategories[2], "60 мин"],
      ["Демо: дополнительная услуга", "Тестовая позиция. Замените на услугу и цену, подтверждённые владельцем.", 1, washCategories[3], "По договорённости"]
    ];
    for (const service of demoServices) {
      await run(
        `INSERT INTO services (name, description, price, category, category_id, duration, active, test_data)
          VALUES (?, ?, ?, ?, (SELECT id FROM categories WHERE section = 'service' AND name = ?), ?, 1, 1)`,
        service[0], service[1], service[2], service[3], service[3], service[4]
      );
    }
    await run("INSERT INTO app_meta (key, value) VALUES ('central_wash_catalog_v1', '1')");
  }

  await run("BEGIN IMMEDIATE");
  try {
    const seeded = await get("SELECT value FROM app_meta WHERE key = 'initial_products_seeded'");
    if (!seeded) {
      for (const product of initialProducts) {
        await run(`
          INSERT INTO products (name, description, price, weight, image)
          VALUES (?, ?, ?, ?, ?)
        `, product.name, product.description, product.price, product.weight, product.image);
      }
      await run("INSERT INTO app_meta (key, value) VALUES ('initial_products_seeded', '1')");
    } else {
      const catalogMigrated = await get("SELECT value FROM app_meta WHERE key = 'enot_catalog_v1'");
      if (!catalogMigrated) {
        const existingProducts = await all("SELECT id, name, description, price, weight, image, available FROM products ORDER BY id");
        const orderCount = await get("SELECT COUNT(*) AS count FROM orders");
        const starterProductsByName = new Map(starterProducts.map((product) => [product.name, product]));
        const isUntouchedStarterCatalog = existingProducts.length === starterProducts.length &&
          orderCount.count === 0 &&
          existingProducts.every((product) => {
            const starter = starterProductsByName.get(product.name);
            return starter &&
              product.description === starter.description &&
              product.price === starter.price &&
              product.weight === starter.weight &&
              product.image === starter.image &&
              product.available === 1;
          });

        if (isUntouchedStarterCatalog) {
          const productsByName = new Map(initialProducts.map((product) => [product.name, product]));
          const starterProductMap = new Map([
            ["Медовик", "Медовик"],
            ["Наполеон", "Наполеон"],
            ["Красный бархат", "Советские торты"],
            ["Шоколадный", "Бенто"],
            ["Три шоколада", "Торты на заказ"],
            ["Чизкейк", "Ромовая баба"]
          ]);
          const seededIds = new Set();

          for (const existing of existingProducts) {
            const product = productsByName.get(starterProductMap.get(existing.name));
            await run(`
              UPDATE products
              SET name = ?, description = ?, price = ?, weight = ?, image = ?, available = 1
              WHERE id = ?
            `, product.name, product.description, product.price, product.weight, product.image, existing.id);
            seededIds.add(product.name);
          }

          for (const product of initialProducts) {
            if (seededIds.has(product.name)) continue;
            await run(`
              INSERT INTO products (name, description, price, weight, image)
              VALUES (?, ?, ?, ?, ?)
            `, product.name, product.description, product.price, product.weight, product.image);
          }
        }
        await run("INSERT INTO app_meta (key, value) VALUES ('enot_catalog_v1', '1')");
      }
    }
    await run("DELETE FROM sessions WHERE expires <= ?", Date.now());

    const catalogCleaned = await get("SELECT value FROM app_meta WHERE key = 'enot_catalog_v2'");
    if (!catalogCleaned) {
      const unpricedItem = await get(
        "SELECT id FROM products WHERE name = ? AND price = ?",
        "Клубника в шоколаде",
        850
      );
      if (unpricedItem) {
        const linkedOrder = await get(
          "SELECT id FROM orders WHERE product_id = ? LIMIT 1",
          unpricedItem.id
        );
        if (linkedOrder) {
          await run("UPDATE products SET available = 0 WHERE id = ?", unpricedItem.id);
        } else {
          await run("DELETE FROM products WHERE id = ?", unpricedItem.id);
        }
      }
      await run("INSERT INTO app_meta (key, value) VALUES ('enot_catalog_v2', '1')");
    }
    const bentoUnitFixed = await get("SELECT value FROM app_meta WHERE key = 'enot_catalog_v3'");
    if (!bentoUnitFixed) {
      await run(
        "UPDATE products SET weight = ? WHERE name = ? AND price = ? AND weight = ?",
        "бенто-торт",
        "Бенто",
        1500,
        "торт"
      );
      await run("INSERT INTO app_meta (key, value) VALUES ('enot_catalog_v3', '1')");
    }
    await run("COMMIT");
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
}

module.exports = { all, db, get, initializeDatabase, run };
