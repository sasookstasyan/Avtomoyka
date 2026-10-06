const api = async (url) => {
  const response = await fetch(url, { credentials: "same-origin" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Не удалось загрузить информацию.");
  return data;
};
const escapeText = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const weekdays = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const shortWeekdays = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const slots = ["Суп", "Горячее", "Салат", "Гарнир"];
let daily = [];
let menu = [];
let categories = [];
let selectedWeekday = new Date().getDay();
let selectedCategory = "Все меню";

function showError(container, error) {
  container.innerHTML = `<p class="empty-card">${escapeText(error.message)}</p>`;
}

function renderWeekdays() {
  const tabs = document.querySelector("#weekday-tabs");
  tabs.replaceChildren(...weekdays.map((day, index) => {
    const button = document.createElement("button");
    button.className = `weekday-button${index === selectedWeekday ? " is-active" : ""}`;
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(index === selectedWeekday));
    button.textContent = shortWeekdays[index];
    button.title = day;
    button.addEventListener("click", () => {
      selectedWeekday = index;
      renderWeekdays();
      renderDaily();
    });
    return button;
  }));
}

function renderDaily() {
  const host = document.querySelector("#daily-items");
  const slotOrder = new Map(slots.map((slot, index) => [slot, index]));
  const items = daily
    .filter((item) => item.weekday === selectedWeekday && item.available)
    .sort((first, second) =>
      (slotOrder.get(first.slot) ?? slots.length) - (slotOrder.get(second.slot) ?? slots.length) ||
      first.name.localeCompare(second.name, "ru")
    );
  if (!items.length) {
    host.innerHTML = `<p class="empty-card">На ${weekdays[selectedWeekday].toLowerCase()} меню дня ещё не опубликовано.</p>`;
    return;
  }
  host.replaceChildren(...items.map((item) => {
    const card = document.createElement("article");
    card.className = "daily-item";
    card.innerHTML = `<small>${escapeText(item.slot)}</small><h3>${escapeText(item.name)}</h3><p>${escapeText(item.description || "")}</p><strong class="daily-price">${item.test_data ? "ТЕСТ · " : ""}${Number(item.price).toLocaleString("ru-RU")} ₽</strong>`;
    return card;
  }));
}

function renderFilters() {
  const host = document.querySelector("#menu-filters");
  const choices = ["Все меню", ...categories.map((category) => category.name)];
  host.replaceChildren(...choices.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `menu-filter${category === selectedCategory ? " is-active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      selectedCategory = category;
      renderFilters();
      renderMenu();
    });
    return button;
  }));
}

function renderMenu() {
  const host = document.querySelector("#menu-grid");
  const visibleCategories = categories.filter((category) =>
    selectedCategory === "Все меню" || category.name === selectedCategory
  );
  const groups = visibleCategories.map((category) => ({
    category,
    items: menu
      .filter((item) => item.category === category.name)
      .sort((first, second) => first.name.localeCompare(second.name, "ru"))
  })).filter((group) => group.items.length);
  if (!groups.length) {
    host.innerHTML = '<p class="empty-card">Позиции меню пока не опубликованы. Администратор может добавить блюда в панели управления.</p>';
    return;
  }
  host.replaceChildren(...groups.map(({ category, items }) => {
    const group = document.createElement("section");
    group.className = "menu-category-group";
    const heading = document.createElement("h3");
    heading.className = "menu-category-heading";
    heading.textContent = category.name;
    const cards = document.createElement("div");
    cards.className = "menu-category-items";
    cards.replaceChildren(...items.map((item) => {
      const card = document.createElement("article");
      card.className = "menu-card";
      const image = item.image && /^https:\/\//.test(item.image)
        ? `<img src="${escapeText(item.image)}" alt="${escapeText(item.name)}" loading="lazy">`
        : '<div class="cafe-image-placeholder" aria-hidden="true">❀</div>';
      card.innerHTML = `${image}<div class="menu-card-body"><small>${item.test_data ? "ДЕМОНСТРАЦИОННАЯ ПОЗИЦИЯ" : escapeText(item.category)}</small><h4>${escapeText(item.name)}</h4><p>${escapeText(item.description || "Описание пока не добавлено.")}</p><strong>${item.test_data ? "ТЕСТ · " : ""}${Number(item.price).toLocaleString("ru-RU")} ₽</strong></div>`;
      return card;
    }));
    group.append(heading, cards);
    return group;
  }));
}

async function load() {
  try {
    const [settings, content, days, cats] = await Promise.all([
      api("/api/central/settings"),
      api("/api/central/menu"),
      api("/api/central/daily-menu"),
      api("/api/central/categories")
    ]);
    document.querySelectorAll("[data-setting]").forEach((node) => {
      const value = settings[node.dataset.setting];
      if (value) node.textContent = value;
    });
    const logoUrl = settings.cafe_logo?.trim();
    const logo = document.querySelector(".cafe-logo-text");
    if (logoUrl) {
      const image = document.createElement("img");
      image.src = logoUrl;
      image.alt = settings.cafe_name || "Маруся";
      logo.replaceChildren(image);
    }
    menu = content;
    daily = days;
    categories = cats.filter((category) => category.section === "menu");
    const phone = settings.cafe_phone?.trim();
    const phoneLink = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "#contacts";
    document.querySelectorAll(".cafe-phone-button").forEach((link) => {
      link.href = phoneLink;
      if (!phone) link.textContent = "Телефон не указан";
    });
    document.querySelector("#cafe-call").href = phoneLink;
    document.querySelector("#cafe-phone-nav").href = phoneLink;
    document.querySelector("#cafe-phone-nav").textContent = phone || "Контакты";
    document.querySelector("#cafe-phone-strip").textContent = phone || "Телефон не указан";
    document.querySelector("#cafe-phone-contact").textContent = phone || "Телефон кафе не указан.";
    const socialHost = document.querySelector("#cafe-social");
    const socialLinks = [["VK", settings.social_vk], ["Telegram", settings.social_telegram]].filter(([, url]) => url);
    socialHost.replaceChildren(...socialLinks.map(([label, url]) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;
      return link;
    }));
    renderWeekdays();
    renderDaily();
    renderFilters();
    renderMenu();
  } catch (error) {
    showError(document.querySelector("#daily-items"), error);
    showError(document.querySelector("#menu-grid"), error);
  }
}

const toggle = document.querySelector(".nav-toggle");
toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  document.querySelector(".main-nav").classList.toggle("is-open", open);
});
document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", () => {
  toggle.setAttribute("aria-expanded", "false");
  document.querySelector(".main-nav").classList.remove("is-open");
}));
load();
