(() => {
  const products = [
    { id: "polden", name: "Полдень", mood: "bright", tag: "Хит мастерской", detail: "Розы, хризантемы, гвоздики и зелень", price: 3400 },
    { id: "tikho", name: "Тихо", mood: "soft", tag: "Нежный", detail: "Ранункулюсы, маттиола, эвкалипт", price: 3100 },
    { id: "matcha", name: "Матча", mood: "green", tag: "Сезонный", detail: "Белые хризантемы, рускус, сезонная зелень", price: 2900 },
    { id: "shum", name: "Шум", mood: "bright", tag: "Смелый", detail: "Герберы, садовые розы и зелень", price: 4400 },
    { id: "sliva", name: "Слива", mood: "soft", tag: "Авторский", detail: "Лизиантус, белые цветы и зелень", price: 4200 },
    { id: "iyul", name: "Июль", mood: "bright", tag: "Летний", detail: "Подсолнухи и сезонные цветы", price: 3900 },
    { id: "sad", name: "После дождя", mood: "green", tag: "Зелёный", detail: "Белая гортензия и сезонная зелень", price: 3600 },
    { id: "ponedelnik", name: "Понедельник", mood: "soft", tag: "Просто так", detail: "Тюльпаны в бумажной упаковке", price: 2500 }
  ];
  const byId = Object.fromEntries(products.map(product => [product.id, product]));
  const cartKey = "pollen-cart";
  const ordersKey = "pollen-orders";
  const lastKey = "pollen-last-order";
  const grid = document.querySelector("#product-grid");
  const cartItems = document.querySelector("#basket-items");
  const form = document.querySelector("#order-form");
  const result = document.querySelector("#order-result");
  const currency = value => new Intl.NumberFormat("ru-RU").format(value) + " ₽";
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
  let cart = read(cartKey, {});
  let lastOrder = read(lastKey, null);
  let activeFilter = "all";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const localDate = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  document.querySelector("#delivery-date").min = localDate(tomorrow);
  document.querySelector("#delivery-date").value = localDate(tomorrow);

  const productImages = Object.fromEntries(products.map(product => [product.id, "assets/" + product.id + ".jpg"]));

  function renderProducts() {
    const query = document.querySelector("#search").value.trim().toLocaleLowerCase("ru");
    const visible = products.filter(p => (activeFilter === "all" || p.mood === activeFilter) && (p.name.toLocaleLowerCase("ru").includes(query) || p.detail.toLocaleLowerCase("ru").includes(query)));
    const fragment = document.createDocumentFragment();
    visible.forEach(product => {
      const card = document.createElement("article");
      card.className = "product-card";
      card.innerHTML = '<div class="product-figure"><span class="product-tag">' + product.tag + '</span><img src="' + productImages[product.id] + '" alt="Цветочная композиция «' + product.name + '»" loading="lazy"></div><div class="product-bottom"><div><h3>' + product.name + '</h3><p>' + product.detail + '</p></div><strong>' + currency(product.price) + '</strong><button type="button" class="product-add" data-add="' + product.id + '">В корзину <span aria-hidden="true">＋</span></button></div>';
      fragment.append(card);
    });
    grid.replaceChildren(fragment);
    document.querySelector("#empty-products").hidden = visible.length > 0;
  }

  function saveCart() {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch {}
  }
  function subtotal() {
    return Object.entries(cart).reduce((sum, [id, qty]) => sum + (byId[id]?.price || 0) * qty, 0);
  }
  function renderCart() {
    Object.keys(cart).forEach(id => { if (!byId[id] || cart[id] <= 0) delete cart[id]; });
    saveCart();
    const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    document.querySelector("#cart-count").textContent = count;
    const fragment = document.createDocumentFragment();
    if (!count) {
      const empty = document.createElement("p");
      empty.className = "basket-empty";
      empty.textContent = "Пока здесь пусто. Выберите букет выше.";
      fragment.append(empty);
    }
    Object.entries(cart).forEach(([id, qty]) => {
      const product = byId[id];
      const row = document.createElement("div");
      row.className = "basket-item";
      row.innerHTML = '<div class="basket-thumb" aria-hidden="true"><img src="' + productImages[product.id] + '" alt=""></div><div><div class="basket-name">' + product.name + '</div><div class="basket-price">' + currency(product.price) + ' / букет</div></div><div class="basket-qty"><button type="button" data-qty="' + id + '" data-delta="-1" aria-label="Уменьшить количество «' + product.name + '»">−</button><span>' + qty + '</span><button type="button" data-qty="' + id + '" data-delta="1" aria-label="Увеличить количество «' + product.name + '»">+</button></div>';
      fragment.append(row);
    });
    cartItems.replaceChildren(fragment);
    const goods = subtotal();
    const delivery = count ? (goods >= 6000 ? 0 : 390) : 0;
    document.querySelector("#subtotal").textContent = currency(goods);
    document.querySelector("#delivery").textContent = count ? (delivery ? currency(delivery) : "Бесплатно") : "—";
    document.querySelector("#total").textContent = currency(goods + delivery);
    form.querySelector(".order-button").disabled = !count;
  }

  document.querySelector(".filters").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(item => {
      const current = item === button;
      item.classList.toggle("active", current);
      item.setAttribute("aria-pressed", String(current));
    });
    renderProducts();
  });
  document.querySelector("#search").addEventListener("input", renderProducts);
  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (!button) return;
    addToCart(button.dataset.add);
    const oldText = button.innerHTML;
    button.textContent = "Добавлено ✓";
    setTimeout(() => { if (button.isConnected) button.innerHTML = oldText; }, 1300);
  });
  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    renderCart();
    result.hidden = true;
  }
  document.querySelector("#featured-add").addEventListener("click", event => {
    addToCart("polden");
    const button = event.currentTarget;
    button.textContent = "Полдень добавлен ✓";
    setTimeout(() => { button.innerHTML = 'Добавить в корзину <span aria-hidden="true">＋</span>'; }, 1300);
  });
  cartItems.addEventListener("click", event => {
    const button = event.target.closest("[data-qty]");
    if (!button) return;
    cart[button.dataset.qty] = Math.max(0, (cart[button.dataset.qty] || 0) + Number(button.dataset.delta));
    renderCart();
    result.hidden = true;
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity() || !Object.keys(cart).length) return;
    const date = document.querySelector("#delivery-date").value;
    if (date < localDate(tomorrow)) {
      document.querySelector("#delivery-date").setCustomValidity("Выберите завтрашний день или позже.");
      form.reportValidity();
      return;
    }
    document.querySelector("#delivery-date").setCustomValidity("");
    const goods = subtotal();
    const delivery = goods >= 6000 ? 0 : 390;
    const order = {
      number: "PL-" + Date.now().toString(36).toUpperCase(),
      createdAt: new Date().toLocaleString("ru-RU"),
      date,
      recipient: document.querySelector("#recipient").value.trim(),
      address: document.querySelector("#address").value.trim(),
      message: document.querySelector("#message").value.trim(),
      items: Object.entries(cart).map(([id, qty]) => ({ name: byId[id].name, qty, price: byId[id].price })),
      goods, delivery, total: goods + delivery
    };
    try {
      const orders = read(ordersKey, []);
      orders.unshift(order);
      localStorage.setItem(ordersKey, JSON.stringify(orders.slice(0, 20)));
      localStorage.setItem(lastKey, JSON.stringify(order));
      lastOrder = order;
      cart = {};
      renderCart();
      form.reset();
      document.querySelector("#delivery-date").value = localDate(tomorrow);
      showResult();
      result.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      document.querySelector("#order-result-text").textContent = "Браузер не разрешил сохранение. Проверьте настройки хранилища.";
      result.hidden = false;
    }
  });
  document.querySelector("#delivery-date").addEventListener("input", event => event.target.setCustomValidity(""));
  function showResult() {
    if (!lastOrder) return;
    document.querySelector("#order-result-text").textContent = "Заказ " + lastOrder.number + " сохранён на этом устройстве. Скачайте детали, чтобы передать их мастерской.";
    result.hidden = false;
  }
  document.querySelector("#download-order").addEventListener("click", () => {
    if (!lastOrder) return;
    const lines = [
      "ПЫЛЬЦА — ДЕТАЛИ ЗАКАЗА " + lastOrder.number,
      "Создан: " + lastOrder.createdAt,
      "Дата доставки: " + lastOrder.date,
      "Получатель: " + lastOrder.recipient,
      "Адрес: " + lastOrder.address,
      "Открытка: " + (lastOrder.message || "Без открытки"),
      "",
      ...lastOrder.items.map(item => item.name + " × " + item.qty + " — " + currency(item.price * item.qty)),
      "Букеты: " + currency(lastOrder.goods),
      "Доставка: " + currency(lastOrder.delivery),
      "Итого: " + currency(lastOrder.total)
    ];
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pollen-" + lastOrder.number + ".txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  renderProducts();
  renderCart();
  if (lastOrder) showResult();
})();
