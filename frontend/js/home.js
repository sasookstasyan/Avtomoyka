import { bindMobileMenu, createProductCard, request, showToast, updateFooterYear } from "./api.js";

bindMobileMenu();
updateFooterYear();

const productContainer = document.querySelector("#popular-products");

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
  const order = document.createElement("button");
  order.className = "button button-dark";
  order.type = "button";
  order.textContent = "Заказать десерт";
  order.addEventListener("click", () => {
    modal.close();
    openOrderForm(product);
  });
  copy.append(eyebrow, title, description, price, order);
  content.append(image, copy);
  modal.showModal();
}

let availableProducts = [];

function openOrderForm(product) {
  const orderModal = document.querySelector("#order-modal");
  const select = document.querySelector("#order-product");
  const orderForm = document.querySelector("#order-form");
  const message = document.querySelector("#order-message");
  select.replaceChildren();
  for (const item of availableProducts) {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = `${item.name} — ${item.price.toLocaleString("ru-RU")} ₽ / ${item.weight}`;
    select.append(option);
  }
  if (product) select.value = String(product.id);
  message.textContent = "";
  message.className = "form-message";
  orderForm.reset();
  if (product) select.value = String(product.id);
  orderModal.showModal();
  orderForm.elements.customer_name.focus();
}

for (const modal of document.querySelectorAll("dialog.modal")) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal || event.target.closest("[data-close-modal]")) modal.close();
  });
}

document.querySelector("#order-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  const message = document.querySelector("#order-message");
  const formData = new FormData(form);
  const order = Object.fromEntries(formData.entries());
  order.product_id = Number(order.product_id);
  order.quantity = Number(order.quantity);
  submit.disabled = true;
  message.textContent = "Отправляем заказ…";
  message.className = "form-message";

  try {
    const result = await request("/api/orders", { method: "POST", body: order });
    message.textContent = result.message;
    message.className = "form-message is-success";
    showToast("Заказ принят — скоро свяжемся!");
    form.reset();
    window.setTimeout(() => document.querySelector("#order-modal").close(), 1400);
  } catch (error) {
    message.textContent = error.message;
    message.className = "form-message is-error";
  } finally {
    submit.disabled = false;
  }
});

async function renderPopularProducts() {
  try {
    availableProducts = await request("/api/products");
    if (!availableProducts.length) {
      const empty = document.createElement("p");
      empty.className = "loading-state";
      empty.textContent = "Скоро здесь появятся наши десерты. Напишите нам, и мы расскажем о меню.";
      productContainer.replaceChildren(empty);
      return;
    }
    productContainer.replaceChildren(
      ...availableProducts.slice(0, 3).map((product) =>
        createProductCard(product, showProductDetails, openOrderForm)
      )
    );
  } catch (error) {
    productContainer.textContent = "Не удалось загрузить меню. Пожалуйста, обновите страницу.";
    console.error(error);
  }
}

renderPopularProducts();
