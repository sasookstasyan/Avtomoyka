let csrfToken;

export async function request(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    csrfToken ||= await loadCsrfToken();
    headers.set("X-CSRF-Token", csrfToken);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, { ...options, method, headers, credentials: "same-origin" });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (data?.csrfToken) csrfToken = data.csrfToken;
  if (!response.ok) {
    const error = new Error(data?.error || `Не удалось выполнить запрос (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function loadCsrfToken() {
  const response = await fetch("/api/auth/csrf-token", { credentials: "same-origin" });
  if (!response.ok) throw new Error("Не удалось подготовить защищённую сессию. Обновите страницу.");
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

export const money = (amount) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(amount);

export function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

export function createProductCard(product, onDetails, onOrder) {
  const card = document.createElement("article");
  card.className = "product-card";

  const imageLink = document.createElement("button");
  imageLink.className = "product-image-button";
  imageLink.type = "button";
  imageLink.setAttribute("aria-label", `Подробнее о десерте «${product.name}»`);
  const image = document.createElement("img");
  image.src = product.image;
  image.alt = product.name;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.hidden = true;
    imageLink.classList.add("image-unavailable");
    imageLink.setAttribute("aria-label", `Фотография «${product.name}» недоступна`);
  }, { once: true });
  imageLink.append(image);
  imageLink.addEventListener("click", () => onDetails(product));

  const body = document.createElement("div");
  body.className = "product-card-body";
  const topLine = document.createElement("div");
  topLine.className = "product-card-topline";
  const name = document.createElement("h3");
  name.textContent = product.name;
  const weight = document.createElement("span");
  weight.textContent = product.weight;
  topLine.append(name, weight);

  const description = document.createElement("p");
  description.textContent = product.description;
  const bottom = document.createElement("div");
  bottom.className = "product-card-bottom";
  const price = document.createElement("strong");
  price.textContent = money(product.price);
  const actions = document.createElement("div");
  actions.className = "product-actions";
  const detailsButton = document.createElement("button");
  detailsButton.className = "product-detail-button";
  detailsButton.type = "button";
  detailsButton.textContent = "Подробнее";
  detailsButton.addEventListener("click", () => onDetails(product));
  const orderButton = document.createElement("button");
  orderButton.className = "product-order-button";
  orderButton.type = "button";
  orderButton.textContent = "Заказать";
  orderButton.addEventListener("click", () => onOrder(product));
  actions.append(detailsButton, orderButton);
  bottom.append(price, actions);
  body.append(topLine, description, bottom);
  card.append(imageLink, body);
  return card;
}

export function bindMobileMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#site-navigation");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    toggle.setAttribute("aria-label", open ? "Открыть меню" : "Закрыть меню");
    nav.classList.toggle("is-open", !open);
  });

  nav.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Открыть меню");
    nav.classList.remove("is-open");
  });
}

export function updateFooterYear() {
  const year = document.querySelector("#current-year");
  if (year) year.textContent = String(new Date().getFullYear());
}
