import { loadCsrfToken, money, request, showToast } from "./api.js";

const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const productForm = document.querySelector("#product-form");
const productFormMessage = document.querySelector("#product-form-message");
const productEditor = document.querySelector("#product-editor");
const productsTable = document.querySelector("#products-table");
const mobileProducts = document.querySelector("#mobile-products");
const ordersTable = document.querySelector("#orders-table");
const mobileOrders = document.querySelector("#mobile-orders");
const ordersEmpty = document.querySelector("#orders-empty");
let products = [];
let orders = [];
let busy = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeButton(text, className, handler) {
  const button = element("button", className, text);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

async function initialize() {
  try {
    await loadCsrfToken();
    const state = await request("/api/auth/me");
    if (state.authenticated) showDashboard();
  } catch (error) {
    loginMessage.textContent = "Сервер пока не отвечает. В PowerShell выполните npm install, затем npm run dev; панель откроется на http://localhost:3000/admin.";
    loginMessage.className = "form-message is-error";
    console.error(error);
  }
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  refreshDashboard();
}

function showLogin(message = "") {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  loginMessage.textContent = message;
  loginMessage.className = message ? "form-message is-error" : "form-message";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector('[type="submit"]');
  submit.disabled = true;
  loginMessage.textContent = "Проверяем данные…";
  loginMessage.className = "form-message";

  try {
    await loadCsrfToken();
    await request("/api/auth/login", {
      method: "POST",
      body: Object.fromEntries(new FormData(loginForm).entries())
    });
    loginForm.reset();
    showDashboard();
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.className = "form-message is-error";
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await request("/api/auth/logout", { method: "POST", body: {} });
    await loadCsrfToken();
    showLogin("Вы вышли из панели управления.");
  } catch (error) {
    showAlert(error.message, true);
  }
});

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((button) => {
      const active = button === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".admin-panel").forEach((panel) => {
      panel.hidden = panel.id !== tab.dataset.panel;
    });
    if (tab.dataset.panel === "orders-panel") loadOrders();
  });
});

document.querySelector("#add-product-button").addEventListener("click", () => openProductEditor());
document.querySelector("#refresh-orders").addEventListener("click", loadOrders);

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => productEditor.close());
});

productEditor.addEventListener("click", (event) => {
  if (event.target === productEditor) productEditor.close();
});

function openProductEditor(product = null) {
  productForm.reset();
  productForm.elements.id.value = product ? String(product.id) : "";
  productForm.elements.name.value = product?.name || "";
  productForm.elements.description.value = product?.description || "";
  productForm.elements.price.value = product?.price || "";
  productForm.elements.weight.value = product?.weight || "";
  productForm.elements.image.value = product?.image.startsWith("http") ? product.image : "";
  productForm.elements.available.checked = product ? Boolean(product.available) : true;
  productFormMessage.textContent = "";
  productFormMessage.className = "form-message";
  document.querySelector("#product-form-eyebrow").textContent = product ? "Изменение товара" : "Новая позиция";
  const title = document.querySelector("#product-form-title");
  title.replaceChildren(product ? "Обновить " : "Добавить ");
  const titleAccent = element("em", "", "десерт.");
  title.append(titleAccent);
  productEditor.showModal();
  productForm.elements.name.focus();
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  const submit = productForm.querySelector('[type="submit"]');
  const id = productForm.elements.id.value;
  const formData = new FormData(productForm);
  formData.set("available", String(productForm.elements.available.checked));
  submit.disabled = true;
  productFormMessage.textContent = "Сохраняем изменения…";
  productFormMessage.className = "form-message";

  try {
    await request(id ? `/api/products/admin/${id}` : "/api/products/admin", {
      method: id ? "PUT" : "POST",
      body: formData
    });
    productEditor.close();
    showAlert(id ? "Товар обновлён." : "Товар добавлен.");
    await loadProducts();
  } catch (error) {
    productFormMessage.textContent = error.message;
    productFormMessage.className = "form-message is-error";
  } finally {
    busy = false;
    submit.disabled = false;
  }
});

async function setAvailability(product, available) {
  const data = new FormData();
  data.set("name", product.name);
  data.set("description", product.description);
  data.set("price", String(product.price));
  data.set("weight", product.weight);
  data.set("image", product.image);
  data.set("available", String(available));
  try {
    await request(`/api/products/admin/${product.id}`, { method: "PUT", body: data });
    showAlert(available ? "Товар снова появился в каталоге." : "Товар снят с продажи.");
    await loadProducts();
  } catch (error) {
    showAlert(error.message, true);
  }
}

async function deleteProduct(product) {
  const confirmed = window.confirm(`Удалить «${product.name}»? Это действие нельзя отменить.`);
  if (!confirmed) return;

  try {
    await request(`/api/products/admin/${product.id}`, { method: "DELETE" });
    showAlert("Товар удалён.");
    await loadProducts();
  } catch (error) {
    showAlert(error.message, true);
  }
}

function renderProductRow(product) {
  const row = document.createElement("tr");
  const nameCell = document.createElement("td");
  const productIdentity = element("div", "table-product");
  const image = document.createElement("img");
  image.src = product.image;
  image.alt = "";
  image.loading = "lazy";
  const name = element("strong", "", product.name);
  const description = element("small", "", product.description);
  productIdentity.append(image, element("span", "", ""));
  productIdentity.lastChild.append(name, description);
  nameCell.append(productIdentity);
  const price = element("td", "admin-price", money(product.price));
  const weight = element("td", "", product.weight);
  const availabilityCell = document.createElement("td");
  const availability = element("span", `status-pill ${product.available ? "status-available" : "status-unavailable"}`, product.available ? "В продаже" : "Скрыт");
  availabilityCell.append(availability);
  const actions = element("td", "row-actions");
  actions.append(
    makeButton("Изменить", "table-action", () => openProductEditor(product)),
    makeButton(product.available ? "Скрыть" : "Показать", "table-action", () => setAvailability(product, !product.available)),
    makeButton("Удалить", "table-action action-delete", () => deleteProduct(product))
  );
  row.append(nameCell, price, weight, availabilityCell, actions);
  return row;
}

function renderMobileProduct(product) {
  const card = element("article", "mobile-record");
  const heading = element("div", "mobile-record-heading");
  const image = document.createElement("img");
  image.src = product.image;
  image.alt = "";
  image.loading = "lazy";
  const title = element("strong", "", product.name);
  const availability = element("span", `status-pill ${product.available ? "status-available" : "status-unavailable"}`, product.available ? "В продаже" : "Скрыт");
  heading.append(image, title, availability);
  const details = element("p", "mobile-record-detail", `${money(product.price)} · ${product.weight}`);
  const actions = element("div", "mobile-record-actions");
  actions.append(
    makeButton("Изменить", "table-action", () => openProductEditor(product)),
    makeButton(product.available ? "Скрыть" : "Показать", "table-action", () => setAvailability(product, !product.available)),
    makeButton("Удалить", "table-action action-delete", () => deleteProduct(product))
  );
  card.append(heading, details, actions);
  return card;
}

function renderProducts() {
  document.querySelector("#stat-products").textContent = String(products.length);
  document.querySelector("#stat-available").textContent = String(products.filter((product) => product.available).length);
  productsTable.replaceChildren();
  mobileProducts.replaceChildren();

  if (!products.length) {
    const row = document.createElement("tr");
    row.append(element("td", "table-loading", "Пока нет товаров. Добавьте первую позицию."));
    productsTable.append(row);
    return;
  }

  productsTable.append(...products.map(renderProductRow));
  mobileProducts.append(...products.map(renderMobileProduct));
}

function renderOrderRow(order) {
  const row = document.createElement("tr");
  const customerCell = document.createElement("td");
  const customer = element("div", "customer-cell");
  customer.append(element("strong", "", order.customer_name));
  const phone = document.createElement("a");
  phone.href = `tel:${order.phone.replace(/[^\d+]/g, "")}`;
  phone.textContent = order.phone;
  customer.append(phone);
  customerCell.append(customer);
  const product = element("td", "", order.product_name);
  const quantity = element("td", "", String(order.quantity));
  const comment = element("td", "order-comment", order.comment || "—");
  const date = element("td", "order-date", new Date(`${order.created_at.replace(" ", "T")}Z`).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"
  }));
  const statusCell = document.createElement("td");
  const status = document.createElement("select");
  status.className = `status-select ${statusClass(order.status)}`;
  status.setAttribute("aria-label", `Статус заказа №${order.id}`);
  for (const optionLabel of ["Новый", "В обработке", "Выполнен", "Отменён"]) {
    const option = document.createElement("option");
    option.value = optionLabel;
    option.textContent = optionLabel;
    option.selected = optionLabel === order.status;
    status.append(option);
  }
  status.addEventListener("change", () => updateOrderStatus(order.id, status.value));
  statusCell.append(status);
  row.append(customerCell, product, quantity, comment, date, statusCell);
  return row;
}

function renderMobileOrder(order) {
  const card = element("article", "mobile-record order-record");
  const heading = element("div", "mobile-record-heading");
  heading.append(element("strong", "", order.customer_name));
  heading.append(element("span", `status-pill ${statusClass(order.status)}`, order.status));
  const phone = document.createElement("a");
  phone.className = "order-phone";
  phone.href = `tel:${order.phone.replace(/[^\d+]/g, "")}`;
  phone.textContent = order.phone;
  const product = element("p", "mobile-record-detail", `${order.product_name} · ${order.quantity} шт.`);
  const comment = element("p", "mobile-order-comment", order.comment || "Комментария нет");
  const status = document.createElement("select");
  status.className = `status-select ${statusClass(order.status)}`;
  status.setAttribute("aria-label", `Статус заказа №${order.id}`);
  for (const value of ["Новый", "В обработке", "Выполнен", "Отменён"]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === order.status;
    status.append(option);
  }
  status.addEventListener("change", () => updateOrderStatus(order.id, status.value));
  card.append(heading, phone, product, comment, status);
  return card;
}

function statusClass(status) {
  if (status === "Новый") return "status-new";
  if (status === "В обработке") return "status-processing";
  if (status === "Выполнен") return "status-done";
  return "status-cancelled";
}

async function updateOrderStatus(orderId, status) {
  try {
    await request(`/api/orders/admin/${orderId}/status`, { method: "PATCH", body: { status } });
    showAlert("Статус заказа обновлён.");
    await loadOrders();
  } catch (error) {
    showAlert(error.message, true);
    await loadOrders();
  }
}

async function loadProducts() {
  const result = await request("/api/products/admin/list");
  products = result;
  renderProducts();
}

async function loadOrders() {
  try {
    orders = await request("/api/orders/admin");
    ordersTable.replaceChildren();
    mobileOrders.replaceChildren();
    ordersEmpty.hidden = orders.length !== 0;

    if (orders.length) {
      ordersTable.append(...orders.map(renderOrderRow));
      mobileOrders.append(...orders.map(renderMobileOrder));
    } else {
      const row = document.createElement("tr");
      row.append(element("td", "table-loading", "Заказов пока нет."));
      ordersTable.append(row);
    }

    const newCount = orders.filter((order) => order.status === "Новый").length;
    document.querySelector("#stat-orders").textContent = String(newCount);
    document.querySelector("#orders-badge").textContent = newCount ? String(newCount) : "";
  } catch (error) {
    showAlert(error.message, true);
    if (error.status === 401) showLogin("Сессия завершилась. Войдите снова.");
  }
}

async function refreshDashboard() {
  try {
    await loadProducts();
    await loadOrders();
  } catch (error) {
    showAlert(error.message, true);
    if (error.status === 401) showLogin("Сессия завершилась. Войдите снова.");
  }
}

function showAlert(message, isError = false) {
  const alert = document.querySelector("#admin-alert");
  alert.textContent = message;
  alert.classList.toggle("is-error", isError);
  alert.classList.add("is-visible");
  window.clearTimeout(showAlert.timeout);
  showAlert.timeout = window.setTimeout(() => alert.classList.remove("is-visible"), 3500);
}

initialize();
