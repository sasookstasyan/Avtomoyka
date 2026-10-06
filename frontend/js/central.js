const api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "Не удалось выполнить запрос.");
  return data;
};

const settingsNodes = document.querySelectorAll("[data-setting]");
async function loadSiteContent() {
  try {
    const [settings, services] = await Promise.all([
      api("/api/central/settings"),
      api("/api/central/services")
    ]);
    settingsNodes.forEach((node) => {
      const value = settings[node.dataset.setting];
      if (value) node.textContent = value;
    });
    document.querySelectorAll("[data-phone-link]").forEach((link) => {
      if (settings.wash_phone) link.href = `tel:${settings.wash_phone.replace(/[^\d+]/g, "")}`;
    });
    const query = settings.wash_map_query || settings.wash_address;
    if (query) {
      const mapUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(query)}`;
      document.querySelector(".map-link").href = mapUrl;
    }
    renderSocialLinks(settings, "#wash-social");
    renderServices(services);
  } catch (error) {
    document.querySelector("#services-grid").innerHTML = `<p class="empty-card">Не удалось загрузить каталог: ${escapeText(error.message)}</p>`;
  }

  function renderSocialLinks(settings, selector) {
    const host = document.querySelector(selector);
    const links = [
      ["VK", settings.social_vk],
      ["Telegram", settings.social_telegram]
    ].filter(([, url]) => url);
    host.replaceChildren(...links.map(([label, url]) => {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = label;
      return link;
    }));
  }
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

const serviceIcons = ["✧", "◉", "◌", "✳"];
function renderServices(services) {
  const grid = document.querySelector("#services-grid");
  const select = document.querySelector("#booking-service");
  select.replaceChildren(new Option("Пока не выбрана", ""));
  if (!services.length) {
    grid.innerHTML = '<p class="empty-card">Услуги ещё не опубликованы. Свяжитесь с автомойкой, чтобы уточнить ассортимент.</p>';
    return;
  }
  grid.replaceChildren(...services.map((service, index) => {
    const card = document.createElement("article");
    card.className = "service-card";
    const testTag = service.test_data ? '<span class="test-badge">ТЕСТОВАЯ ЦЕНА</span>' : "";
    const image = service.image && /^https:\/\//.test(service.image)
      ? `<img class="service-photo" src="${escapeText(service.image)}" alt="" loading="lazy">`
      : `<span class="service-icon" aria-hidden="true">${serviceIcons[index % serviceIcons.length]}</span>`;
    card.innerHTML = `<div class="service-top">${image}<span class="service-category">${escapeText(service.category)}</span></div><h3>${escapeText(service.name)}</h3><p>${escapeText(service.description)}</p>${testTag}<div class="service-bottom"><strong class="service-price">${Number(service.price).toLocaleString("ru-RU")} ₽<small>${service.test_data ? "тестовая сумма" : "стоимость"}</small></strong><span class="service-time">${escapeText(service.duration)}</span></div>`;
    select.add(new Option(`${service.name} — ${service.test_data ? "цена тестовая" : `${Number(service.price).toLocaleString("ru-RU")} ₽`}`, service.id));
    return card;
  }));
}

const bookingForm = document.querySelector("#booking-form");
const bookingResult = document.querySelector("#booking-result");
const dateInput = bookingForm.elements.date;
dateInput.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = bookingForm.querySelector('[type="submit"]');
  const data = Object.fromEntries(new FormData(bookingForm).entries());
  button.disabled = true;
  bookingResult.textContent = "Отправляем заявку…";
  bookingResult.className = "form-result form-wide";
  try {
    const { csrfToken } = await api("/api/auth/csrf-token");
    const result = await api("/api/central/appointments", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken },
      body: JSON.stringify(data)
    });
    bookingResult.textContent = result.message;
    bookingForm.reset();
    dateInput.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  } catch (error) {
    bookingResult.textContent = error.message;
    bookingResult.classList.add("is-error");
  } finally {
    button.disabled = false;
  }
});

const navToggle = document.querySelector(".nav-toggle");
navToggle.addEventListener("click", () => {
  const open = navToggle.getAttribute("aria-expanded") !== "true";
  navToggle.setAttribute("aria-expanded", String(open));
  document.querySelector(".main-nav").classList.toggle("is-open", open);
});
document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", () => {
  navToggle.setAttribute("aria-expanded", "false");
  document.querySelector(".main-nav").classList.remove("is-open");
}));

loadSiteContent();
