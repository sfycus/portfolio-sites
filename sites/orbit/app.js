(() => {
  const films = [
    { id: "posle-sveta", title: "После света", genre: "fantasy", genreName: "Фантастика", duration: 108, age: "12+", text: "Ночью весь город теряет электричество. Двое незнакомцев идут навстречу рассвету.", bg: "#5b554b", main: "#b4a278", secondary: "#866f5d" },
    { id: "tihaya-reka", title: "Тихая река", genre: "drama", genreName: "Драма", duration: 96, age: "16+", text: "Возвращение в маленький город становится разговором, который откладывали много лет.", bg: "#465653", main: "#a4a091", secondary: "#806b5c" },
    { id: "zemlya-sadov", title: "Земля садов", genre: "documentary", genreName: "Документальное", duration: 83, age: "6+", text: "История людей, которые превращают пустующие дворы в городские сады.", bg: "#47574b", main: "#a7ab83", secondary: "#9b8165" },
    { id: "steklyannyy-gorod", title: "Стеклянный город", genre: "fantasy", genreName: "Фантастика", duration: 114, age: "16+", text: "Архивист находит карту города, которого ещё нет, и решает пройти по ней.", bg: "#424d50", main: "#8f9892", secondary: "#8d7962" },
    { id: "tri-nedeli", title: "Три недели лета", genre: "drama", genreName: "Драма", duration: 102, age: "12+", text: "Случайная поездка к морю меняет планы троих друзей на целый год.", bg: "#72594c", main: "#c1a572", secondary: "#af7e60" },
    { id: "golosa-doma", title: "Голоса дома", genre: "documentary", genreName: "Документальное", duration: 78, age: "12+", text: "Наблюдение за одним домом и его жителями в течение четырёх сезонов.", bg: "#5f5b54", main: "#a6a092", secondary: "#718678" }
  ];
  const byId = Object.fromEntries(films.map(film => [film.id, film]));
  const key = "orbit-local-tickets";
  const readTickets = () => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
  let tickets = readTickets();
  let selectedDate = 0;
  let selectedGenre = "all";
  let activeSession = null;
  let selectedSeats = new Set();
  const dialog = document.querySelector("#seat-dialog");
  const seatGrid = document.querySelector("#seat-grid");
  const dateStrip = document.querySelector("#date-strip");
  const filmGrid = document.querySelector("#film-grid");
  const priceForSeat = seat => {
    const row = seat.charAt(0);
    return row === "A" || row === "B" ? 490 : row === "C" || row === "D" ? 590 : 690;
  };
  const currency = value => new Intl.NumberFormat("ru-RU").format(value) + " ₽";
  const localDate = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  const times = ["12:20", "15:00", "17:40", "20:20"];
  const now = new Date();
  const lastSessionToday = new Date(localDate(now) + "T" + times.at(-1) + ":00");
  const firstDateOffset = now >= lastSessionToday ? 1 : 0;
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + i + firstDateOffset);
    return d;
  });
  const isUpcomingSession = session => new Date(session.date + "T" + session.time + ":00").getTime() > Date.now();
  const fullDate = date => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "long" }).format(date);

  function sessionsForDay(dayIndex) {
    return Array.from({ length: 4 }, (_, position) => {
      const film = films[(dayIndex * 2 + position) % films.length];
      const date = localDate(dates[dayIndex]);
      const time = times[position];
      return { film, date, time, key: date + "/" + time + "/" + film.id };
    });
  }
  function fixtureSold(sessionKey) {
    let seed = Array.from(sessionKey).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
    const seats = new Set();
    while (seats.size < 8) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const row = "ABCDEF"[seed % 6];
      const col = Math.floor(seed / 6) % 9 + 1;
      seats.add(row + col);
    }
    return seats;
  }
  function bookedSeats(sessionKey) {
    return new Set(tickets.filter(ticket => ticket.sessionKey === sessionKey).flatMap(ticket => ticket.seats));
  }
  function persistTickets(next) {
    localStorage.setItem(key, JSON.stringify(next));
    tickets = next;
  }

  function renderDates() {
    const fragment = document.createDocumentFragment();
    dates.forEach((date, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.day = index;
      button.className = index === selectedDate ? "active" : "";
      button.setAttribute("aria-pressed", String(index === selectedDate));
      const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date).replace(".", "").toUpperCase();
      const month = new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(date).replace(".", "").toUpperCase();
      button.innerHTML = '<span class="date-day">' + date.getDate() + '</span><span class="date-meta">' + (localDate(date) === localDate(new Date()) ? "СЕГОДНЯ" : weekday) + '<br>' + month + '</span>';
      fragment.append(button);
    });
    dateStrip.replaceChildren(fragment);
  }
  function renderSchedule() {
    const upcoming = sessionsForDay(selectedDate).filter(isUpcomingSession);
    const sessions = upcoming.filter(session => selectedGenre === "all" || session.film.genre === selectedGenre);
    document.querySelector("#film-count").textContent = sessions.length + (sessions.length === 1 ? " ПОКАЗ" : " ПОКАЗА");
    const fragment = document.createDocumentFragment();
    sessions.forEach(session => {
      const film = session.film;
      const card = document.createElement("article");
      card.className = "film-card";
      card.innerHTML = '<div class="film-art" role="img" aria-label="Плакат фильма «' + film.title + '»" style="--poster-bg:' + film.bg + ';--poster-main:' + film.main + ';--poster-secondary:' + film.secondary + '"><span class="shape-one"></span><span class="shape-two"></span><span class="shape-three"></span><span class="film-art-title">' + film.title + '</span></div><div class="film-content"><div class="film-top"><span>' + film.genreName + '</span><span>' + film.age + ' / ' + film.duration + ' МИН</span></div><h3>' + film.title + '</h3><p>' + film.text + '</p><div class="session-list"><button type="button" class="session-button" data-session="' + session.key + '">' + session.time + '<small>ВЫБРАТЬ МЕСТО ↗</small></button></div></div>';
      fragment.append(card);
    });
    filmGrid.replaceChildren(fragment);
    const empty = document.querySelector("#empty-schedule");
    empty.hidden = sessions.length > 0;
    empty.textContent = upcoming.length ? "На этот день фильмов выбранного жанра нет. Попробуйте другой фильтр." : "Сеансы на выбранную дату уже начались. Выберите другой день.";
  }
  function openSession(session) {
    if (!isUpcomingSession(session)) {
      window.alert("Сеанс уже начался. Выберите другое время.");
      renderSchedule();
      return;
    }
    activeSession = session;
    selectedSeats = new Set();
    document.querySelector("#dialog-title").textContent = session.film.title.toUpperCase();
    document.querySelector("#dialog-info").textContent = fullDate(new Date(session.date + "T12:00:00")) + " · " + session.time + " · " + session.film.duration + " мин";
    renderSeats();
    dialog.showModal();
  }
  function renderSeats() {
    if (!activeSession) return;
    const sold = fixtureSold(activeSession.key);
    const booked = bookedSeats(activeSession.key);
    const fragment = document.createDocumentFragment();
    for (const row of "ABCDEF") {
      const label = document.createElement("span");
      label.className = "seat-row-label";
      label.textContent = row;
      fragment.append(label);
      for (let col = 1; col <= 9; col++) {
        const seat = row + col;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "seat";
        button.dataset.seat = seat;
        button.textContent = col;
        button.setAttribute("aria-label", "Ряд " + row + ", место " + col + ", " + currency(priceForSeat(seat)));
        button.setAttribute("aria-pressed", String(selectedSeats.has(seat)));
        if (sold.has(seat) || booked.has(seat)) {
          button.disabled = true;
          button.setAttribute("aria-label", "Ряд " + row + ", место " + col + " занято");
        }
        if (selectedSeats.has(seat)) button.classList.add("selected");
        fragment.append(button);
      }
    }
    seatGrid.replaceChildren(fragment);
    const seats = [...selectedSeats].sort();
    document.querySelector("#selected-seats").textContent = seats.length ? seats.join(", ") : "МЕСТА НЕ ВЫБРАНЫ";
    document.querySelector("#seat-total").textContent = currency(seats.reduce((sum, seat) => sum + priceForSeat(seat), 0));
    document.querySelector("#book-seats").disabled = seats.length === 0;
  }

  dateStrip.addEventListener("click", event => {
    const button = event.target.closest("[data-day]");
    if (!button) return;
    selectedDate = Number(button.dataset.day);
    renderDates();
    renderSchedule();
  });
  document.querySelector(".genre-filters").addEventListener("click", event => {
    const button = event.target.closest("[data-genre]");
    if (!button) return;
    selectedGenre = button.dataset.genre;
    document.querySelectorAll("[data-genre]").forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderSchedule();
  });
  filmGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-session]");
    if (!button) return;
    const session = sessionsForDay(selectedDate).find(item => item.key === button.dataset.session);
    if (session) openSession(session);
  });
  seatGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-seat]");
    if (!button || button.disabled) return;
    const seat = button.dataset.seat;
    if (selectedSeats.has(seat)) selectedSeats.delete(seat);
    else if (selectedSeats.size < 6) selectedSeats.add(seat);
    else { window.alert("За один раз можно выбрать до шести мест."); return; }
    renderSeats();
  });
  document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  document.querySelector("#book-seats").addEventListener("click", () => {
    if (!activeSession || !selectedSeats.size) return;
    if (!isUpcomingSession(activeSession)) {
      dialog.close();
      window.alert("Сеанс уже начался. Выберите другое время.");
      renderSchedule();
      return;
    }
    const unavailable = new Set([...fixtureSold(activeSession.key), ...bookedSeats(activeSession.key)]);
    if ([...selectedSeats].some(seat => unavailable.has(seat))) {
      window.alert("Одно из мест уже занято. Выберите другое.");
      renderSeats();
      return;
    }
    const seats = [...selectedSeats].sort();
    const ticket = {
      id: "OR-" + Date.now().toString(36).toUpperCase(),
      sessionKey: activeSession.key,
      filmId: activeSession.film.id,
      date: activeSession.date,
      time: activeSession.time,
      seats,
      total: seats.reduce((sum, seat) => sum + priceForSeat(seat), 0)
    };
    try {
      persistTickets([ticket, ...tickets]);
      dialog.close();
      renderTickets();
      document.querySelector("#tickets").scrollIntoView({ behavior: "smooth" });
    } catch {
      window.alert("Браузер не разрешил сохранить билеты. Проверьте настройки хранилища.");
    }
  });
  function renderTickets() {
    const list = document.querySelector("#ticket-list");
    const fragment = document.createDocumentFragment();
    if (!tickets.length) {
      const empty = document.createElement("p");
      empty.className = "ticket-empty";
      empty.textContent = "Пока билетов нет. Выберите фильм в афише и сохраните места.";
      fragment.append(empty);
    }
    tickets.forEach(ticket => {
      const film = byId[ticket.filmId];
      if (!film) return;
      const card = document.createElement("article");
      card.className = "ticket";
      card.innerHTML = '<div class="ticket-main"><span class="ticket-meta">' + ticket.id + '</span><h3>' + film.title + '</h3><p>' + fullDate(new Date(ticket.date + "T12:00:00")) + ' · ' + ticket.time + ' · Места ' + ticket.seats.join(", ") + '</p><button type="button" data-download="' + ticket.id + '">СКАЧАТЬ ↓</button><button type="button" data-cancel="' + ticket.id + '">ОСВОБОДИТЬ МЕСТА</button></div><div class="ticket-stub"><small>ОРБИТА / ВХОД</small><strong>' + ticket.seats.length + '</strong><small>' + currency(ticket.total) + '</small></div>';
      fragment.append(card);
    });
    list.replaceChildren(fragment);
  }
  document.querySelector("#ticket-list").addEventListener("click", event => {
    const download = event.target.closest("[data-download]");
    if (download) {
      const ticket = tickets.find(item => item.id === download.dataset.download);
      if (!ticket) return;
      const film = byId[ticket.filmId];
      const lines = ["ОРБИТА — БИЛЕТ " + ticket.id, film.title, fullDate(new Date(ticket.date + "T12:00:00")) + " · " + ticket.time, "Места: " + ticket.seats.join(", "), "Стоимость: " + currency(ticket.total), "", "Сохранено локально на этом устройстве. Для реального прохода требуется подтверждение кинотеатра."];
      const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "orbita-" + ticket.id + ".txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const cancel = event.target.closest("[data-cancel]");
    if (cancel && window.confirm("Освободить выбранные места?")) {
      try { persistTickets(tickets.filter(item => item.id !== cancel.dataset.cancel)); renderTickets(); }
      catch { window.alert("Не удалось изменить сохранённые билеты."); }
    }
  });
  const graphic = document.querySelector(".graphic-seats");
  for (let i = 0; i < 54; i++) graphic.append(document.createElement("span"));
  renderDates();
  renderSchedule();
  renderTickets();
})();
