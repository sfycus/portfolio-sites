(() => {
  const key = "beryl-sol-configuration";
  const form = document.querySelector("#config-form");
  const shelf = document.querySelector("#shelf");
  const status = document.querySelector("#config-status");
  const fields = {
    cols: document.querySelector("#cols"),
    rows: document.querySelector("#rows"),
    doors: document.querySelector("#doors"),
    finish: document.querySelector("#finish")
  };
  const materials = {
    oak: { title: "Натуральный дуб", short: "Дуб", factor: 1, wood: "#c49b72", inner: "#7f634d", dark: "#866345" },
    walnut: { title: "Тёмный орех", short: "Орех", factor: 1.28, wood: "#76513d", inner: "#483528", dark: "#4d3125" },
    ash: { title: "Светлый ясень", short: "Ясень", factor: .94, wood: "#d9c8a7", inner: "#a89a83", dark: "#98836b" }
  };
  const presets = {
    library: { cols: 5, rows: 5, doors: 4, material: "walnut", finish: "oil" },
    console: { cols: 3, rows: 2, doors: 2, material: "ash", finish: "lacquer" }
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || min));
  const money = n => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

  let saved;
  try { saved = JSON.parse(localStorage.getItem(key) || "null"); } catch { saved = null; }
  if (saved && typeof saved === "object") applyState(saved);

  function applyState(state) {
    fields.cols.value = clamp(state.cols, 2, 5);
    fields.rows.value = clamp(state.rows, 2, 5);
    fields.doors.value = clamp(state.doors, 0, 25);
    fields.finish.value = state.finish === "lacquer" ? "lacquer" : "oil";
    const material = materials[state.material] ? state.material : "oak";
    form.querySelector('[name="material"][value="' + material + '"]').checked = true;
    render();
  }

  function getState() {
    const cols = clamp(fields.cols.value, 2, 5);
    const rows = clamp(fields.rows.value, 2, 5);
    return {
      cols, rows,
      doors: clamp(fields.doors.value, 0, cols * rows),
      material: form.querySelector('[name="material"]:checked').value,
      finish: fields.finish.value
    };
  }

  function calculate(state) {
    const cells = state.cols * state.rows;
    const frame = 7900 + (state.cols - 2) * 1850;
    const cellsCost = cells * 4050 * materials[state.material].factor;
    const doorsCost = state.doors * 2750 * materials[state.material].factor;
    const finished = (frame + cellsCost + doorsCost) * (state.finish === "lacquer" ? 1.08 : 1);
    return Math.round(finished / 100) * 100;
  }

  function render() {
    const state = getState();
    const cellCount = state.cols * state.rows;
    fields.doors.max = cellCount;
    fields.doors.value = state.doors;
    document.querySelector("#cols-value").textContent = state.cols;
    document.querySelector("#rows-value").textContent = state.rows;
    document.querySelector("#doors-value").textContent = state.doors;
    document.querySelector("#doors-max-label").textContent = "До " + cellCount + " дверец";
    const mat = materials[state.material];
    document.querySelector("#preview-material").textContent = mat.short + " / " + (state.finish === "lacquer" ? "матовый лак" : "масло");
    document.querySelector("#dimensions").textContent = (state.cols * 36 + 2) + " × " + (state.rows * 39 + 4) + " × 36 см";
    document.querySelector("#price").textContent = money(calculate(state));
    shelf.style.setProperty("--cols", state.cols);
    shelf.style.setProperty("--rows", state.rows);
    shelf.style.setProperty("--wood", mat.wood);
    shelf.style.setProperty("--wood-inner", mat.inner);
    shelf.style.setProperty("--wood-dark", mat.dark);
    shelf.setAttribute("aria-label", "Стеллаж: " + state.cols + " секции, " + state.rows + " уровня, " + state.doors + " закрытых ячеек, " + mat.title);
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < cellCount; i++) {
      const cell = document.createElement("span");
      cell.className = "shelf-cell";
      if (i >= cellCount - state.doors) cell.classList.add("door");
      fragment.append(cell);
    }
    shelf.replaceChildren(fragment);
    return state;
  }

  form.addEventListener("input", () => { render(); status.textContent = ""; });
  form.addEventListener("change", () => { render(); status.textContent = ""; });
  form.addEventListener("submit", event => event.preventDefault());
  document.querySelectorAll("[data-preset]").forEach(button => {
    button.addEventListener("click", () => {
      applyState(presets[button.dataset.preset]);
      status.textContent = "Идея загружена. Теперь можно изменить любую деталь.";
    });
  });
  document.querySelector("#save-config").addEventListener("click", () => {
    const state = render();
    try {
      localStorage.setItem(key, JSON.stringify(state));
      status.textContent = "Конфигурация сохранена в этом браузере.";
    } catch {
      status.textContent = "Браузер не разрешил сохранение. Скачайте спецификацию.";
    }
  });
  document.querySelector("#download-spec").addEventListener("click", () => {
    const state = render();
    const lines = [
      "BERYL — СИСТЕМА SŌL",
      "Спецификация конфигурации",
      "",
      "Секций по ширине: " + state.cols,
      "Уровней по высоте: " + state.rows,
      "Закрытых ячеек: " + state.doors,
      "Материал: " + materials[state.material].title,
      "Покрытие: " + (state.finish === "lacquer" ? "Матовый лак" : "Натуральное масло"),
      "Размеры (Ш × В × Г): " + document.querySelector("#dimensions").textContent,
      "Ориентировочная стоимость: " + money(calculate(state)),
      "",
      "Стоимость рассчитана для выбранной конфигурации; доставка рассчитывается отдельно."
    ];
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "beryl-sol-specification.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = "Спецификация скачана.";
  });
  render();
})();
