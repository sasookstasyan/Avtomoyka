import { loadCsrfToken, request } from "./api.js";

const grid = document.querySelector("#menu-admin-grid");
const filters = document.querySelector("#menu-admin-filters");
const notice = document.querySelector("#menu-notice");
const dialog = document.querySelector("#menu-item-dialog");
const form = document.querySelector("#menu-item-form");
const formMessage = document.querySelector("#menu-form-message");
let categories = [];
let items = [];
let activeCategory = "Все меню";
let toastTimer;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const priceText = (price) => `${Number(price).toLocaleString("ru-RU")} ₽`;

function showToast(message) {
  const toast = document.querySelector("#menu-toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

async function initialize() {
  try {
    await loadCsrfToken();
    const session = await request("/api/auth/me");
    if (!session.authenticated) {
      window.location.replace("/admin");
      return;
    }
    await refresh();
  } catch (error) {
    notice.textContent = `Не удалось загрузить редактор меню: ${error.message}`;
    notice.classList.add("is-error");
  }
}

async function refresh() {
  try {
    [items, categories] = await Promise.all([
      request("/api/central/menu?admin=1"),
      request("/api/central/categories")
    ]);
    categories = categories.filter((category) => category.section === "menu");
    renderFilters();
    renderItems();
    notice.textContent = "";
    notice.classList.remove("is-error");
  } catch (error) {
    if (error.status === 401) {
      window.location.replace("/admin");
      return;
    }
    notice.textContent = `Не удалось обновить меню: ${error.message}`;
    notice.classList.add("is-error");
  }
}

function renderFilters() {
  const names = ["Все меню", ...categories.map((category) => category.name)];
  filters.replaceChildren(...names.map((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `menu-admin-filter${name === activeCategory ? " is-active" : ""}`;
    button.textContent = name;
    button.addEventListener("click", () => {
      activeCategory = name;
      renderFilters();
      renderItems();
    });
    return button;
  }));
}

function renderItems() {
  const shown = items.filter((item) => activeCategory === "Все меню" || item.category === activeCategory);
  document.querySelector("#menu-count").textContent = String(items.length);
  if (!shown.length) {
    grid.innerHTML = `<div class="menu-admin-empty">${items.length ? "В этой категории блюд пока нет." : "В меню пока нет позиций. Добавьте блюдо, чтобы оно появилось на странице кафе."}</div>`;
    return;
  }
  grid.replaceChildren(...shown.map((item) => {
    const card = document.createElement("article");
    card.className = `menu-preview-card${item.available ? "" : " is-unavailable"}`;
    card.innerHTML = `<div class="menu-preview-placeholder" aria-hidden="true">✿</div><div class="menu-preview-body"><div class="menu-preview-meta"><span>${escapeHtml(item.category)}</span><span class="${item.available ? "availability available" : "availability"}">${item.available ? "В наличии" : "Скрыто"}</span></div><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.description || "Описание не добавлено.")}</p><div class="menu-preview-footer"><strong>${item.test_data ? "ТЕСТ · " : ""}${priceText(item.price)}</strong>${item.test_data ? '<span class="demo-label">ДЕМО-ДАННЫЕ</span>' : ""}</div><div class="menu-preview-actions"><button type="button" class="small-action" data-edit="${item.id}">Изменить</button><button type="button" class="small-action delete" data-delete="${item.id}">Удалить</button></div></div>`;
    const imageContainer = card.firstElementChild;
    if (item.image && /^https:\/\//.test(item.image)) {
      const photo = document.createElement("img");
      photo.src = item.image;
      photo.alt = item.name;
      photo.loading = "lazy";
      photo.addEventListener("error", () => {
        const placeholder = document.createElement("div");
        placeholder.className = "menu-preview-placeholder";
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.textContent = "✿";
        photo.replaceWith(placeholder);
      }, { once: true });
      imageContainer.className = "";
      imageContainer.replaceWith(photo);
    }
    return card;
  }));
}

function openEditor(item = null) {
  form.reset();
  form.elements.id.value = item?.id || "";
  form.elements.name.value = item?.name || "";
  form.elements.description.value = item?.description || "";
  form.elements.price.value = item?.price ?? "";
  form.elements.image.value = item?.image || "";
  form.elements.available.checked = item ? Boolean(item.available) : true;
  form.elements.test_data.checked = item ? Boolean(item.test_data) : true;
  form.elements.category.replaceChildren(...categories.map((category) => new Option(category.name, category.name)));
  if (item?.category) form.elements.category.value = item.category;
  document.querySelector("#menu-form-title").textContent = item ? "Редактировать блюдо" : "Добавить блюдо";
  formMessage.textContent = "";
  formMessage.classList.remove("is-error");
  dialog.showModal();
  form.elements.name.focus();
}

document.querySelector("#add-item").addEventListener("click", () => openEditor());
grid.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]");
  if (edit) {
    const item = items.find((candidate) => candidate.id === Number(edit.dataset.edit));
    if (item) openEditor(item);
    return;
  }
  const remove = event.target.closest("[data-delete]");
  if (!remove || !window.confirm("Удалить эту позицию из меню?")) return;
  try {
    await request(`/api/central/menu/${remove.dataset.delete}`, { method: "DELETE" });
    await refresh();
    showToast("Позиция удалена из меню.");
  } catch (error) {
    notice.textContent = error.message;
    notice.classList.add("is-error");
  }
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => dialog.close());
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = form.elements.id.value;
  const body = Object.fromEntries(new FormData(form).entries());
  body.price = Number(body.price);
  body.available = form.elements.available.checked;
  body.test_data = form.elements.test_data.checked;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  formMessage.textContent = "Сохраняем…";
  try {
    await request(`/api/central/menu${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body
    });
    dialog.close();
    await refresh();
    showToast(id ? "Изменения сохранены и опубликованы." : "Блюдо добавлено в меню.");
  } catch (error) {
    if (error.status === 401) {
      window.location.replace("/admin");
      return;
    }
    formMessage.textContent = error.message;
    formMessage.classList.add("is-error");
  } finally {
    submit.disabled = false;
  }
});

initialize();
