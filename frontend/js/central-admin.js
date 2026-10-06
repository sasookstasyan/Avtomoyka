import { loadCsrfToken, request } from "./api.js";

const loginWrap = document.querySelector("#login-wrap");
const layout = document.querySelector("#admin-layout");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const toast = (message) => {
  const node = document.querySelector("#admin-toast");
  node.textContent = message;
  node.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node.classList.remove("is-visible"), 2800);
};
const pageNames = {
  "dashboard-page": ["ОБЗОР", "Добрый день"],
  "services-page": ["АВТОМОЙКА", "Услуги"],
  "appointments-page": ["АВТОМОЙКА", "Записи"],
  "wash-settings-page": ["АВТОМОЙКА", "Настройки автомойки"],
  "menu-page": ["КАФЕ «МАРУСЯ»", "Меню кафе"],
  "daily-page": ["КАФЕ «МАРУСЯ»", "Блюда дня"],
  "categories-page": ["КАФЕ «МАРУСЯ»", "Категории"],
  "cafe-settings-page": ["КАФЕ «МАРУСЯ»", "Настройки кафе"],
  "contacts-page": ["ОБЩИЕ НАСТРОЙКИ", "Контакты и адрес"]
};
const menuCategories = document.querySelector("#menu-categories");
const serviceCategories = document.querySelector("#service-categories");
const itemDialog = document.querySelector("#item-dialog");
const itemForm = document.querySelector("#item-form");
const dailyForm = document.querySelector("#daily-form");
const libraryDialog = document.querySelector("#library-dialog");
const libraryForm = document.querySelector("#library-form");
let services = [];
let appointments = [];
let menuItems = [];
let dailyItems = [];
let dishLibrary = [];
let categories = [];
let settings = {};
let dailyMeta = { weekdays: [], dailySlots: [] };
let toastTimer;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const money = (value) => `${Number(value).toLocaleString("ru-RU")} ₽`;
const countDishes = (count) => {
  const lastTwo = count % 100;
  const last = count % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? "блюд" :
    last === 1 ? "блюдо" : last >= 2 && last <= 4 ? "блюда" : "блюд";
  return `${count} ${word}`;
};
const renderError = (container, error) => {
  container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
};

async function initialize() {
  try {
    await loadCsrfToken();
    const state = await request("/api/auth/me");
    if (state.authenticated) openAdmin();
  } catch (error) {
    loginMessage.textContent = `Сервер пока не отвечает: ${error.message}. Запустите npm run dev.`;
  }
}

function openAdmin() {
  loginWrap.hidden = true;
  layout.hidden = false;
  loadAll();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('[type="submit"]');
  button.disabled = true;
  loginMessage.textContent = "Проверяем данные…";
  try {
    await loadCsrfToken();
    await request("/api/auth/login", {
      method: "POST",
      body: Object.fromEntries(new FormData(loginForm).entries())
    });
    loginForm.reset();
    openAdmin();
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await request("/api/auth/logout", { method: "POST", body: {} });
    await loadCsrfToken();
    layout.hidden = true;
    loginWrap.hidden = false;
    loginMessage.textContent = "Вы вышли из панели управления.";
  } catch (error) {
    toast(error.message);
  }
});

function setPage(pageId) {
  document.querySelectorAll(".admin-page").forEach((page) => page.classList.toggle("is-visible", page.id === pageId));
  document.querySelectorAll(".side-link").forEach((button) => button.classList.toggle("is-active", button.dataset.page === pageId));
  const [kicker, title] = pageNames[pageId] || ["", ""];
  document.querySelector("#page-kicker").textContent = kicker;
  document.querySelector("#page-title").textContent = title;
  document.querySelector("#sidebar-nav").classList.remove("is-open");
}
document.querySelectorAll(".side-link").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.page)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.go)));
document.querySelector("#sidebar-toggle").addEventListener("click", () => document.querySelector("#sidebar-nav").classList.toggle("is-open"));

async function loadAll() {
  try {
    [services, appointments, menuItems, dailyItems, dishLibrary, categories, settings, dailyMeta] = await Promise.all([
      request("/api/central/services?admin=1"),
      request("/api/central/appointments"),
      request("/api/central/menu?admin=1"),
      request("/api/central/daily-menu?admin=1"),
      request("/api/central/dish-library"),
      request("/api/central/categories"),
      request("/api/central/settings"),
      request("/api/central/meta")
    ]);
    renderDashboard();
    renderServices();
    renderAppointments();
    renderMenuItems();
    renderCategories();
    renderDaily();
    renderDishLibrary();
    populateSettings();
    setupDailyOptions();
  } catch (error) {
    toast(`Не удалось загрузить данные: ${error.message}`);
    console.error(error);
  }
}

function renderDashboard() {
  document.querySelector("#stat-services").textContent = services.length;
  document.querySelector("#stat-appointments").textContent = appointments.filter((item) => item.status === "Новая").length;
  document.querySelector("#stat-menu").textContent = menuItems.length;
  document.querySelector("#stat-daily").textContent = dailyItems.filter((item) => item.available).length;
  const count = appointments.filter((item) => item.status === "Новая").length;
  document.querySelector("#new-bookings").hidden = count === 0;
  document.querySelector("#new-bookings").title = `${count} новых записей`;
}

function recordCard(item, kind) {
  const active = kind === "service" ? item.active : item.available;
  const category = item.category || item.slot || "";
  const name = escapeHtml(item.name);
  const icon = kind === "service" ? "◈" : "❀";
  const image = item.image && /^https:\/\//.test(item.image)
    ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">`
    : icon;
  return `<article class="record-card">
    <div class="record-main"><span class="record-thumb">${image}</span><span><strong>${name}</strong><small>${escapeHtml(category)} · ${escapeHtml(item.description || "Описание не добавлено")}</small></span></div>
    <div class="record-main"><span><strong>${escapeHtml(kind === "service" ? item.duration : "Позиция меню")}</strong><small>${active ? "Показывается на сайте" : "Скрыта на сайте"}</small></span></div>
    <div class="record-price">${money(item.price)}${item.test_data ? "<small>ТЕСТОВАЯ ЦЕНА / ДАННЫЕ</small>" : ""}</div>
    <div class="record-actions"><button class="small-action" data-edit-kind="${kind}" data-id="${item.id}">Изменить</button><button class="small-action delete" data-delete-kind="${kind}" data-id="${item.id}">Удалить</button></div>
  </article>`;
}

function renderServices() {
  const host = document.querySelector("#services-list");
  host.innerHTML = services.length ? services.map((item) => recordCard(item, "service")).join("") : '<div class="empty-state">Услуг пока нет. Добавьте первую позицию.</div>';
}

function renderMenuItems() {
  const host = document.querySelector("#menu-list");
  host.innerHTML = menuItems.length ? menuItems.map((item) => recordCard(item, "menu")).join("") : '<div class="empty-state">В меню пока нет позиций. Добавьте подтверждённые блюда и цены.</div>';
}

document.querySelector("#services-list").addEventListener("click", handleRecordAction);
document.querySelector("#menu-list").addEventListener("click", handleRecordAction);
async function handleRecordAction(event) {
  const edit = event.target.closest("[data-edit-kind]");
  const remove = event.target.closest("[data-delete-kind]");
  if (edit) {
    const kind = edit.dataset.editKind;
    const collection = kind === "service" ? services : menuItems;
    openItemEditor(kind, collection.find((item) => item.id === Number(edit.dataset.id)));
  }
  if (remove) {
    const kind = remove.dataset.deleteKind;
    const id = Number(remove.dataset.id);
    if (!window.confirm("Удалить эту позицию?")) return;
    try {
      await request(`/api/central/${kind === "service" ? "services" : "menu"}/${id}`, { method: "DELETE" });
      await loadAll();
      toast("Позиция удалена.");
    } catch (error) {
      toast(error.message);
    }
  }
}

function categoryList(section) {
  return categories.filter((item) => item.section === section);
}

function openItemEditor(kind, item = null) {
  itemForm.reset();
  itemForm.elements.id.value = item?.id || "";
  itemForm.elements.kind.value = kind;
  itemForm.elements.name.value = item?.name || "";
  itemForm.elements.description.value = item?.description || "";
  itemForm.elements.price.value = item?.price ?? "";
  itemForm.elements.duration.value = item?.duration || "";
  itemForm.elements.image.value = item?.image || "";
  itemForm.elements.active.checked = item ? Boolean(item.active) : true;
  itemForm.elements.available.checked = item ? Boolean(item.available) : true;
  itemForm.elements.test_data.checked = item ? Boolean(item.test_data) : true;
  itemForm.elements.active.closest("label").hidden = kind !== "service";
  itemForm.elements.available.closest("label").hidden = kind !== "menu";
  document.querySelector(".duration-field").hidden = kind !== "service";
  const categorySelect = itemForm.elements.category;
  categorySelect.replaceChildren(...categoryList(kind).map((category) => new Option(category.name, category.name)));
  if (item?.category) categorySelect.value = item.category;
  document.querySelector("#editor-title").textContent = `${item ? "Изменить" : "Добавить"} ${kind === "service" ? "услугу" : "блюдо"}`;
  document.querySelector("#editor-kicker").textContent = kind === "service" ? "АВТОМОЙКА · УСЛУГИ" : "КАФЕ «МАРУСЯ» · МЕНЮ";
  document.querySelector("#editor-message").textContent = "";
  itemDialog.showModal();
}

document.querySelector("#add-service").addEventListener("click", () => openItemEditor("service"));
document.querySelector("#add-menu-item").addEventListener("click", () => openItemEditor("menu"));
document.querySelectorAll(".dialog-x").forEach((button) => button.addEventListener("click", () => itemDialog.close()));
itemDialog.addEventListener("click", (event) => { if (event.target === itemDialog) itemDialog.close(); });

itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const kind = itemForm.elements.kind.value;
  const id = itemForm.elements.id.value;
  const body = Object.fromEntries(new FormData(itemForm).entries());
  body.price = Number(body.price);
  body.active = itemForm.elements.active.checked;
  body.available = itemForm.elements.available.checked;
  body.test_data = itemForm.elements.test_data.checked;
  const endpoint = kind === "service" ? "services" : "menu";
  const button = itemForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await request(`/api/central/${endpoint}${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body });
    itemDialog.close();
    await loadAll();
    toast(id ? "Изменения сохранены." : "Позиция добавлена.");
  } catch (error) {
    document.querySelector("#editor-message").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function renderAppointments() {
  const host = document.querySelector("#appointments-table");
  if (!appointments.length) {
    host.innerHTML = '<tr><td colspan="6"><div class="empty-state">Новых записей пока нет. Онлайн-заявки появятся здесь.</div></td></tr>';
    return;
  }
  const statuses = ["Новая", "Подтверждена", "Выполнена", "Отменена"];
  host.innerHTML = appointments.map((item) => `<tr>
    <td><strong>${escapeHtml(item.name)}</strong><br><a href="tel:${escapeHtml(item.phone)}">${escapeHtml(item.phone)}</a></td>
    <td>${escapeHtml(item.car)}</td><td>${escapeHtml(item.service_name)}</td>
    <td>${escapeHtml(item.appointment_date)}<br>${escapeHtml(item.appointment_time)}</td>
    <td>${escapeHtml(item.comment || "—")}</td>
    <td><select data-appointment-id="${item.id}" aria-label="Статус записи">${statuses.map((status) => `<option${status === item.status ? " selected" : ""}>${status}</option>`).join("")}</select></td>
  </tr>`).join("");
}

document.querySelector("#appointments-table").addEventListener("change", async (event) => {
  const id = event.target.dataset.appointmentId;
  if (!id) return;
  try {
    await request(`/api/central/appointments/${id}`, { method: "PATCH", body: { status: event.target.value } });
    await loadAll();
    toast("Статус записи обновлён.");
  } catch (error) {
    toast(error.message);
  }
});
document.querySelector("#refresh-appointments").addEventListener("click", async () => {
  try {
    appointments = await request("/api/central/appointments");
    renderAppointments();
    renderDashboard();
  } catch (error) { toast(error.message); }
});

function renderCategories() {
  const render = (section, host) => {
    host.innerHTML = categoryList(section).map((item) => `<div class="category-chip"><span>${escapeHtml(item.name)}</span><button type="button" data-delete-category="${item.id}">Удалить</button></div>`).join("");
  };
  render("service", serviceCategories);
  render("menu", menuCategories);
}

document.querySelectorAll(".category-add").forEach((form) => form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await request("/api/central/categories", {
      method: "POST",
      body: { section: form.dataset.section, name: form.elements.name.value }
    });
    form.reset();
    categories = await request("/api/central/categories");
    renderCategories();
    toast("Категория добавлена.");
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}));
document.querySelector("#service-categories").addEventListener("click", removeCategory);
document.querySelector("#menu-categories").addEventListener("click", removeCategory);
async function removeCategory(event) {
  const button = event.target.closest("[data-delete-category]");
  if (!button || !window.confirm("Удалить категорию?")) return;
  try {
    await request(`/api/central/categories/${button.dataset.deleteCategory}`, { method: "DELETE" });
    categories = await request("/api/central/categories");
    renderCategories();
    toast("Категория удалена.");
  } catch (error) { toast(error.message); }
}

function setupDailyOptions() {
  dailyForm.elements.weekday.replaceChildren(...dailyMeta.weekdays.map((day, index) => new Option(day, index)));
  dailyForm.elements.slot.replaceChildren(...dailyMeta.dailySlots.map((slot) => new Option(slot, slot)));
  libraryForm.elements.category.replaceChildren(...categoryList("menu").map((category) => new Option(category.name, category.name)));
}

function renderDaily() {
  const host = document.querySelector("#daily-admin-list");
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  host.innerHTML = weekdayOrder.map((weekday) => {
    const day = dailyMeta.weekdays[weekday];
    const items = dailyItems.filter((item) => item.weekday === weekday);
    const slots = dailyMeta.dailySlots.map((slot) => {
      const slotItems = items.filter((entry) => entry.slot === slot);
      const availableByCategory = categoryList("menu").map((category) => {
        const choices = dishLibrary.filter((dish) => dish.available && dish.category === category.name);
        if (!choices.length) return "";
        return `<optgroup label="${escapeHtml(category.name)}">${choices.map((dish) =>
          `<option value="${dish.id}">${escapeHtml(dish.name)} · ${money(dish.price)}${dish.test_data ? " · ТЕСТ" : ""}</option>`
        ).join("")}</optgroup>`;
      }).join("");
      const rows = slotItems.length
        ? slotItems.map((item) => `<article class="daily-slot-item${item.available ? "" : " is-unavailable"}"><div><strong>${escapeHtml(item.name)}</strong><em>${item.test_data ? "ТЕСТ · " : ""}${money(item.price)}${item.available ? "" : " · НЕТ В НАЛИЧИИ"}</em></div><div class="daily-slot-item-actions"><button type="button" class="small-action" data-edit-daily="${item.id}">Изменить</button><button type="button" class="small-action delete" data-delete-daily="${item.id}">Удалить</button></div></article>`).join("")
        : '<p class="daily-slot-empty">Пока нет блюд этого типа.</p>';
      return `<section class="daily-slot-group"><header><h4>${escapeHtml(slot)} <span>${slotItems.length}</span></h4><button type="button" class="daily-add-manual" data-add-daily="${weekday}" data-slot="${escapeHtml(slot)}">＋ Вручную</button></header><div class="daily-slot-items">${rows}</div><div class="daily-quick-add"><select data-quick-dish="${weekday}" data-slot="${escapeHtml(slot)}"><option value="">Добавить блюдо из каталога…</option>${availableByCategory}</select><button type="button" class="small-action" data-add-library-to-day="${weekday}" data-slot="${escapeHtml(slot)}">Добавить</button></div></section>`;
    }).join("");
    const total = items.length;
    return `<article class="daily-admin-day"><header class="daily-admin-day-header"><h3>${escapeHtml(day)} <span>${countDishes(total)}</span></h3><button type="button" class="admin-button secondary" data-add-daily="${weekday}" data-slot="${escapeHtml(dailyMeta.dailySlots[0])}">＋ Добавить позицию</button></header><div class="daily-slot-list">${slots}</div></article>`;
  }).join("");
}

function renderDishLibrary() {
  const host = document.querySelector("#dish-library-list");
  const groups = categoryList("menu").map((category) => ({
    category,
    items: dishLibrary
      .filter((dish) => dish.category === category.name)
      .sort((first, second) => first.name.localeCompare(second.name, "ru"))
  })).filter((group) => group.items.length);
  if (!groups.length) {
    host.innerHTML = '<div class="empty-state">Каталог заготовок пуст. Добавьте блюдо, чтобы использовать его для быстрой замены в расписании.</div>';
    renderDaily();
    return;
  }
  host.innerHTML = groups.map(({ category, items }) => `
    <section class="dish-library-group">
      <h3>${escapeHtml(category.name)}</h3>
      <div class="dish-library-items">${items.map((dish) => `
        <article class="dish-library-card${dish.available ? "" : " is-unavailable"}">
          <div><strong>${escapeHtml(dish.name)}</strong><p>${escapeHtml(dish.description || "Описание не добавлено.")}</p></div>
          <span class="dish-library-price">${dish.test_data ? "ТЕСТ · " : ""}${money(dish.price)}</span>
          <span class="dish-library-state">${dish.available ? "Доступно для выбора" : "Скрыто из быстрых замен"}</span>
          <div class="dish-library-actions"><button class="small-action" type="button" data-edit-library="${dish.id}">Изменить</button><button class="small-action delete" type="button" data-delete-library="${dish.id}">Удалить</button></div>
        </article>`).join("")}</div>
    </section>`).join("");
  renderDaily();
}

function selectDaily(weekday, slot, itemId = null) {
  const item = itemId === null ? null : dailyItems.find((entry) => entry.id === itemId);
  dailyForm.elements.id.value = item?.id || "";
  dailyForm.elements.weekday.value = String(weekday);
  dailyForm.elements.slot.value = slot;
  dailyForm.elements.name.value = item?.name || "";
  dailyForm.elements.description.value = item?.description || "";
  dailyForm.elements.price.value = item?.price ?? "";
  dailyForm.elements.image.value = item?.image || "";
  dailyForm.elements.available.checked = item ? Boolean(item.available) : true;
  dailyForm.elements.test_data.checked = item ? Boolean(item.test_data) : true;
  document.querySelector("#daily-form-title").textContent = `${item ? "Изменить" : "Добавить"} блюдо · ${dailyMeta.weekdays[weekday]} · ${slot}`;
  document.querySelector("#daily-message").textContent = "";
  document.querySelector("#daily-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

document.querySelector("#daily-admin-list").addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit-daily]");
  if (edit) {
    const item = dailyItems.find((entry) => entry.id === Number(edit.dataset.editDaily));
    if (item) selectDaily(item.weekday, item.slot, item.id);
    return;
  }
  const add = event.target.closest("[data-add-daily]");
  if (add) {
    selectDaily(Number(add.dataset.addDaily), add.dataset.slot);
    return;
  }
  const addFromLibrary = event.target.closest("[data-add-library-to-day]");
  if (addFromLibrary) {
    const slotGroup = addFromLibrary.closest(".daily-slot-group");
    const select = slotGroup.querySelector("[data-quick-dish]");
    const dish = dishLibrary.find((item) => item.id === Number(select.value));
    if (!dish) {
      toast("Сначала выберите блюдо-заготовку из списка.");
      return;
    }
    addFromLibrary.disabled = true;
    try {
      await request(`/api/central/daily-menu/${addFromLibrary.dataset.addLibraryToDay}`, {
        method: "POST",
        body: {
          slot: addFromLibrary.dataset.slot,
          name: dish.name,
          description: dish.description,
          price: dish.price,
          image: dish.image,
          available: true,
          test_data: Boolean(dish.test_data)
        }
      });
      dailyItems = await request("/api/central/daily-menu?admin=1");
      renderDaily();
      renderDashboard();
      toast(`${dish.name} добавлено в ${dailyMeta.weekdays[Number(addFromLibrary.dataset.addLibraryToDay)]}.`);
    } catch (error) {
      toast(`Не удалось добавить блюдо: ${error.message}`);
    } finally {
      addFromLibrary.disabled = false;
    }
    return;
  }
  const remove = event.target.closest("[data-delete-daily]");
  if (!remove || !window.confirm("Удалить блюдо из расписания этого дня?")) return;
  try {
    await request(`/api/central/daily-menu/item/${remove.dataset.deleteDaily}`, { method: "DELETE" });
    dailyItems = await request("/api/central/daily-menu?admin=1");
    renderDaily();
    renderDashboard();
    toast("Блюдо удалено из расписания.");
  } catch (error) {
    toast(`Не удалось удалить блюдо: ${error.message}`);
  }
});

function openLibraryEditor(dish = null) {
  libraryForm.reset();
  libraryForm.elements.id.value = dish?.id || "";
  libraryForm.elements.name.value = dish?.name || "";
  libraryForm.elements.description.value = dish?.description || "";
  libraryForm.elements.price.value = dish?.price ?? "";
  libraryForm.elements.image.value = dish?.image || "";
  libraryForm.elements.available.checked = dish ? Boolean(dish.available) : true;
  libraryForm.elements.test_data.checked = dish ? Boolean(dish.test_data) : true;
  libraryForm.elements.category.replaceChildren(...categoryList("menu").map((category) => new Option(category.name, category.name)));
  if (dish?.category) libraryForm.elements.category.value = dish.category;
  document.querySelector("#library-dialog-title").textContent = dish ? "Изменить блюдо-заготовку" : "Добавить блюдо-заготовку";
  document.querySelector("#library-message").textContent = "";
  libraryDialog.showModal();
}

document.querySelector("#add-library-dish").addEventListener("click", () => openLibraryEditor());
document.querySelectorAll(".library-dialog-close").forEach((button) => button.addEventListener("click", () => libraryDialog.close()));
libraryDialog.addEventListener("click", (event) => { if (event.target === libraryDialog) libraryDialog.close(); });
document.querySelector("#dish-library-list").addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit-library]");
  if (edit) {
    openLibraryEditor(dishLibrary.find((dish) => dish.id === Number(edit.dataset.editLibrary)));
    return;
  }
  const remove = event.target.closest("[data-delete-library]");
  if (!remove || !window.confirm("Удалить блюдо-заготовку? Уже опубликованные блюда дня останутся без изменений.")) return;
  try {
    await request(`/api/central/dish-library/${remove.dataset.deleteLibrary}`, { method: "DELETE" });
    dishLibrary = await request("/api/central/dish-library");
    renderDishLibrary();
    toast("Блюдо-заготовка удалено.");
  } catch (error) {
    toast(error.message);
  }
});

libraryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = libraryForm.elements.id.value;
  const body = Object.fromEntries(new FormData(libraryForm).entries());
  body.price = Number(body.price);
  body.available = libraryForm.elements.available.checked;
  body.test_data = libraryForm.elements.test_data.checked;
  const button = libraryForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await request(`/api/central/dish-library${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body
    });
    dishLibrary = await request("/api/central/dish-library");
    libraryDialog.close();
    renderDishLibrary();
    toast(id ? "Заготовка обновлена." : "Заготовка добавлена в каталог.");
  } catch (error) {
    document.querySelector("#library-message").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#today-editor").addEventListener("click", () => {
  setPage("daily-page");
  selectDaily(new Date().getDay(), "Суп");
});

dailyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(dailyForm).entries());
  body.price = Number(body.price);
  body.available = dailyForm.elements.available.checked;
  body.test_data = dailyForm.elements.test_data.checked;
  const weekday = body.weekday;
  const slot = body.slot;
  const id = body.id;
  delete body.id;
  const button = dailyForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await request(`/api/central/daily-menu${id ? `/${id}` : `/${weekday}`}`, { method: id ? "PUT" : "POST", body });
    dailyItems = await request("/api/central/daily-menu?admin=1");
    renderDaily();
    renderDashboard();
    document.querySelector("#daily-message").textContent = "Блюдо дня сохранено.";
    toast("Меню дня обновлено.");
  } catch (error) { document.querySelector("#daily-message").textContent = error.message; }
  finally { button.disabled = false; }
});
document.querySelector("#clear-daily-form").addEventListener("click", () => {
  dailyForm.reset();
  dailyForm.elements.id.value = "";
  dailyForm.elements.available.checked = true;
  dailyForm.elements.test_data.checked = true;
});

function populateSettings() {
  document.querySelectorAll(".settings-form").forEach((form) => {
    Array.from(form.elements).forEach((field) => {
      if (field.name && settings[field.name] !== undefined) field.value = settings[field.name];
    });
  });
}
document.querySelectorAll(".settings-form").forEach((form) => form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = form.querySelector(".inline-message");
  const body = Object.fromEntries(new FormData(form).entries());
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  message.textContent = "";
  try {
    settings = await request("/api/central/settings", { method: "PUT", body });
    populateSettings();
    message.textContent = "Настройки сохранены.";
    toast("Настройки обновлены на сайте.");
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
}));

document.querySelector("#admin-toast")?.addEventListener("click", () => clearTimeout(toastTimer));
initialize();
