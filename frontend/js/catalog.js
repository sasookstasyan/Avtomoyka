import { bindMobileMenu, createProductCard, request, showToast, updateFooterYear } from "./api.js";

bindMobileMenu();
updateFooterYear();

const grid = document.querySelector("#catalog-grid");
const emptyState = document.querySelector("#catalog-empty");
const countLabel = document.querySelector("#catalog-count");
const searchInput = document.querySelector("#product-search");
const clearSearchButton = document.querySelector("#product-search-clear");
const orderSelect = document.querySelector("#order-product");
const orderForm = document.querySelector("#order-form");
const orderMessage = document.querySelector("#order-message");
const filterButtons = [...document.querySelectorAll(".catalog-filter")];
let products = [];
let activeFilter = "all";

function classifyProduct(product) {
  const name = product.name.toLocaleLowerCase("ru");
  if (["бенто", "капкей", "трайфл", "кейк-бокс", "ромовая баба", "клубника"].some((part) => name.includes(part))) {
    return "small";
  }
  return "cakes";
}

function showProductDetails(product) {
  const modal = document.querySelector("#product-modal");
  const content = document.querySelector("#product-modal-content");
  content.replaceChildren();

  const image = document.createElement("img");
  image.className = "product-modal-image";
  image.src = product.image;
  image.alt = product.name;
  const copy = document.createElement("div");
  copy.className = "product-modal-copy";
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Десерт · ${product.weight}`;
  const title = document.createElement("h2");
  title.textContent = product.name;
  const description = document.createElement("p");
  description.textContent = product.description;
  const price = document.createElement("strong");
  price.className = "product-modal-price";
  price.textContent = `${new Intl.NumberFormat("ru-RU").format(product.price)} ₽`;
  const orderButton = document.createElement("button");
  orderButton.className = "button button-dark";
  orderButton.type = "button";
  orderButton.textContent = "Заказать десерт";
  orderButton.addEventListener("click", () => {
    modal.close();
    openOrderForm(product);
  });
  copy.append(eyebrow, title, description, price, orderButton);
  content.append(image, copy);
  modal.showModal();
}

function openOrderForm(product) {
  orderSelect.replaceChildren();
  for (const item of products) {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = `${item.name} — ${item.price.toLocaleString("ru-RU")} ₽ / ${item.weight}`;
    orderSelect.append(option);
  }
  if (product) orderSelect.value = String(product.id);
  orderMessage.textContent = "";
  orderMessage.className = "form-message";
  orderForm.reset();
  if (product) orderSelect.value = String(product.id);
  const modal = document.querySelector("#order-modal");
  modal.showModal();
  orderForm.elements.customer_name.focus();
}

function matchesSearch(product, query) {
  const searchable = `${product.name} ${product.description} ${product.weight}`.toLocaleLowerCase("ru");
  return searchable.includes(query);
}

function renderProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase("ru");
  const shown = products.filter((product) =>
    (activeFilter === "all" || classifyProduct(product) === activeFilter) &&
    matchesSearch(product, query)
  );
  countLabel.textContent = `${shown.length} ${productWord(shown.length)} в меню`;
  emptyState.hidden = shown.length !== 0;
  grid.hidden = shown.length === 0;
  grid.replaceChildren(
    ...shown.map((product) => createProductCard(product, showProductDetails, openOrderForm))
  );
}

function productWord(count) {
  const lastTwo = count % 100;
  const lastDigit = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "десертов";
  if (lastDigit === 1) return "десерт";
  if (lastDigit >= 2 && lastDigit <= 4) return "десерта";
  return "десертов";
}

searchInput.addEventListener("input", () => {
  clearSearchButton.hidden = searchInput.value.length === 0;
  renderProducts();
});

clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  clearSearchButton.hidden = true;
  renderProducts();
  searchInput.focus();
});

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    for (const filterButton of filterButtons) {
      const isActive = filterButton === button;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    }
    renderProducts();
  });
}

document.querySelector("#reset-catalog").addEventListener("click", () => {
  searchInput.value = "";
  clearSearchButton.hidden = true;
  activeFilter = "all";
  for (const button of filterButtons) {
    const isActive = button.dataset.filter === "all";
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
  renderProducts();
});

for (const modal of document.querySelectorAll("dialog.modal")) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-close-modal]")) modal.close();
  });
}

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = orderForm.querySelector('[type="submit"]');
  const order = Object.fromEntries(new FormData(orderForm).entries());
  order.product_id = Number(order.product_id);
  order.quantity = Number(order.quantity);
  submit.disabled = true;
  orderMessage.textContent = "Отправляем заказ…";
  orderMessage.className = "form-message";

  try {
    const result = await request("/api/orders", { method: "POST", body: order });
    orderMessage.textContent = result.message;
    orderMessage.className = "form-message is-success";
    showToast("Заказ принят — скоро свяжемся!");
    orderForm.reset();
    window.setTimeout(() => document.querySelector("#order-modal").close(), 1400);
  } catch (error) {
    orderMessage.textContent = error.message;
    orderMessage.className = "form-message is-error";
  } finally {
    submit.disabled = false;
  }
});

async function loadCatalog() {
  try {
    products = await request("/api/products");
    renderProducts();
  } catch (error) {
    countLabel.textContent = "Не удалось загрузить меню";
    grid.textContent = error.message;
    showToast(error.message);
    console.error(error);
  }
}

loadCatalog();
