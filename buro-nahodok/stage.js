// Decorative feedback uses public puzzle fields and never checks an answer.
const stageStations = [
  {
    title: 'Северная почта',
    short: 'Почта',
    setting: 'Под снежной крышей ждут письма и почтовые мешки.',
    celebration: 'На Северной почте зажглись окна!',
  },
  {
    title: 'Ёлочная площадь',
    short: 'Ёлка',
    setting: 'На площади покачиваются игрушки и мерцает снежная ёлка.',
    celebration: 'Праздничная ёлка засияла!',
  },
  {
    title: 'Мастерская подарков',
    short: 'Мастерская',
    setting: 'В тёплой мастерской готовят ленты, открытки и посылки.',
    celebration: 'Мастерская готова к празднику!',
  },
  {
    title: 'Станция саней',
    short: 'Сани',
    setting: 'Над заснеженными крышами ждут почтовые сани.',
    celebration: 'Почтовые сани готовы к полёту!',
  },
];

function stageEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function stageStationIndex(mission) {
  const index = mission?.station?.index;
  return Number.isInteger(index) && index >= 0 && index < 4 ? index : -1;
}

function stageState(missions, progress) {
  const tasks = Array.isArray(missions) ? missions : [];
  const validIndex = Number.isInteger(progress?.index)
    && progress.index >= 0 && progress.index < tasks.length;
  const phase = progress?.phase;
  const validPhase = ['intro', 'puzzle', 'find', 'treasure', 'done'].includes(phase)
    && (phase !== 'intro' || progress.index === 0)
    && (phase !== 'find' || progress.index < tasks.length - 1)
    && (!['treasure', 'done'].includes(phase) || progress.index === tasks.length - 1);
  const index = validIndex && validPhase ? progress.index : 0;
  const solved = validIndex && validPhase && phase !== 'intro'
    ? index + (['find', 'treasure', 'done'].includes(phase) ? 1 : 0)
    : 0;
  const members = stageStations.map((_, station) => tasks
    .map((mission, taskIndex) => stageStationIndex(mission) === station ? taskIndex : -1)
    .filter(taskIndex => taskIndex >= 0));
  const complete = members.map(indices => indices.length > 0
    && indices.every(taskIndex => taskIndex < solved));
  const current = stageStationIndex(tasks[index]);
  return { tasks, index, phase, solved, complete, current: current < 0 ? 0 : current };
}

function stageWindow(x, y, lit, width = 20, height = 25) {
  return `<g class="stage-window${lit ? ' is-lit' : ''}">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="${lit ? '#ffda8a' : '#405c70'}" stroke="#284958" stroke-width="3"/>
    <path d="M${x + width / 2} ${y}v${height}m${-width / 2} ${-height / 2}h${width}" stroke="#284958" stroke-width="2"/>
  </g>`;
}

function stagePine(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M-3 0h6v-42h-6z" fill="#765d52"/>
    <path d="m0-96 24 35H13l23 34H20L43-5h-86l23-22h-16l23-34h-11z" fill="#376b64"/>
    <path d="m0-96 12 19-12-4-12 4zm-19 44 19-7 19 7-10-16H-9zm-12 27 31-9 31 9-12-18H-19z" fill="#eff8f7"/>
  </g>`;
}

function stageBird(x, y) {
  return `<g transform="translate(${x} ${y})"><g class="stage-courier">
    <ellipse cx="0" cy="15" rx="23" ry="5" fill="#5c8292" opacity=".16"/>
    <path d="m-15 1-13 8 15 1" fill="#294756"/>
    <ellipse cx="0" cy="-1" rx="17" ry="15" fill="#e96657"/>
    <path d="M-11-11c10-17 27-8 27 2-7-4-17-4-27-2" fill="#294756"/>
    <path d="M-11-4c-9-1-11 12 0 14 10 2 12-10 0-14" fill="#3c6670"/>
    <circle cx="11" cy="-12" r="2" fill="#fffaf0"/>
    <path d="m16-8 9 4-9 3" fill="#eab96c"/>
    <path d="M-5 14v6m12-7v7" stroke="#294756" stroke-width="2.5" stroke-linecap="round"/>
    <path d="m-2-10 10 15" stroke="#f4ce85" stroke-width="3"/>
    <rect x="0" y="1" width="16" height="13" rx="2" fill="#fff5d8" stroke="#8e6c48" stroke-width="1.5"/>
    <path d="m1 2 7 6 7-6" fill="none" stroke="#bb634e" stroke-width="1.5"/>
  </g></g>`;
}

function stageScene(complete, current) {
  const [post, tree, workshop, sleigh] = complete;
  const stationClass = index => `stage-station${complete[index] ? ' is-complete' : ''}${current === index ? ' is-current' : ''}`;
  const snow = [[30, 38, 2], [79, 65, 2.5], [155, 25, 2], [201, 75, 2], [258, 30, 3], [355, 61, 2], [409, 25, 2.5], [449, 85, 2], [568, 38, 2.5], [622, 71, 2], [682, 26, 3], [785, 65, 2], [811, 22, 2.5]];
  return `<svg class="stage-scene" viewBox="0 0 840 270" aria-hidden="true" focusable="false">
    <rect width="840" height="270" rx="24" fill="#203e55"/>
    <circle cx="737" cy="47" r="18" fill="#f1d9a3"/><circle cx="746" cy="39" r="18" fill="#203e55"/>
    <path d="M0 151Q98 91 200 150T420 142T650 139T840 145V270H0z" fill="#426377"/>
    <path d="M0 181q113-29 213 1t204-1 207 0 216-7v96H0z" fill="#eaf4f4"/>
    <path d="M0 227q121-24 223 3t193-3 217-2 207-4v49H0z" fill="#fffaf0"/>
    <g fill="#fffdf8" class="stage-snow">${snow.map(([x, y, radius]) => `<circle cx="${x}" cy="${y}" r="${radius}"/>`).join('')}</g>
    <path class="stage-route" d="M109 221q100 25 202 0t210 0 205-12" fill="none" stroke="#a6bfc4" stroke-width="3" stroke-dasharray="4 10" stroke-linecap="round"/>
    ${stagePine(37, 203, .64)}${stagePine(202, 203, .47)}${stagePine(416, 202, .62)}${stagePine(620, 207, .5)}${stagePine(811, 193, .76)}
    <g class="${stationClass(0)}" data-station="0">
      <rect x="68" y="114" width="113" height="92" rx="3" fill="#cb7262" stroke="#795349" stroke-width="3"/>
      <path d="m54 118 72-58 70 58z" fill="#a04b4e" stroke="#795349" stroke-width="3" stroke-linejoin="round"/>
      <path d="m54 115 72-58 70 58-14 2-56-44-57 45z" fill="#fffcf0"/>
      <path d="M153 75V52h17v36" fill="#9f5651" stroke="#795349" stroke-width="3"/>
      <path d="M150 51h23" stroke="#fffaf0" stroke-width="7" stroke-linecap="round"/>
      <g class="stage-smoke" fill="#fffaf0" opacity=".75"><circle cx="163" cy="38" r="7"/><circle cx="169" cy="26" r="10"/></g>
      ${stageWindow(79, 137, post)}${stageWindow(148, 137, post)}
      <path d="M113 205v-49a14 14 0 0 1 28 0v49" fill="#355c68" stroke="#795349" stroke-width="3"/>
      <circle cx="133" cy="179" r="2.5" fill="#f5cb80"/>
      <rect x="107" y="121" width="40" height="18" rx="3" fill="#f8e5bb" stroke="#795349" stroke-width="2"/>
      <path d="m116 126 11 8 11-8m-22 0h22v10h-22z" fill="none" stroke="#a6524b" stroke-width="1.8"/>
      <path d="M63 205h122" stroke="#fffcf0" stroke-width="8" stroke-linecap="round"/>
      <rect x="56" y="173" width="20" height="19" rx="4" fill="#376b64"/>
      <path d="M66 193v18m-6-30h12" stroke="#284958" stroke-width="3"/>
    </g>
    <g class="${stationClass(1)}" data-station="1">
      <ellipse cx="314" cy="209" rx="64" ry="9" fill="#bfd4d5"/>
      <path d="M307 180h14v29h-14z" fill="#87644f"/>
      <path d="m314 63 31 42h-14l28 39h-17l32 46H254l32-46h-17l28-39h-14z" fill="#34796c" stroke="#285a55" stroke-width="3" stroke-linejoin="round"/>
      <path d="m314 65 15 22-15-4-15 4m-23 55 38-10 39 10m-82 34 43-12 44 12" fill="none" stroke="#ecf6e9" stroke-width="7" stroke-linecap="round"/>
      <path d="m293 107 41 12m-55 31 70 15" stroke="#e8c981" stroke-width="3" fill="none"/>
      <path class="stage-window${tree ? ' is-lit' : ''}" d="m314 47 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="${tree ? '#ffd67d' : '#d2ae76'}" stroke="#a9844a" stroke-width="2"/>
      ${[[296, 115], [333, 136], [286, 164], [322, 177], [346, 181]].map(([x, y], index) => `<circle class="stage-window${tree ? ' is-lit' : ''}" cx="${x}" cy="${y}" r="5" fill="${tree ? ['#ffe1a0', '#ec8c75', '#ffe1a0'][index % 3] : '#8fb3a1'}"/>`).join('')}
      <rect x="266" y="190" width="22" height="18" rx="2" fill="#cf7864"/><path d="M277 190v18m-11-12h22" stroke="#f2d597" stroke-width="3"/>
      <rect x="337" y="195" width="27" height="15" rx="2" fill="#c3a273"/><path d="M349 195v15" stroke="#a85350" stroke-width="4"/>
    </g>
    <g class="${stationClass(2)}" data-station="2">
      <rect x="466" y="123" width="117" height="83" rx="3" fill="#e5be87" stroke="#856b50" stroke-width="3"/>
      <path d="m451 126 72-57 76 57z" fill="#467975" stroke="#315c5c" stroke-width="3" stroke-linejoin="round"/>
      <path d="m451 123 72-58 76 58-16 1-60-45-57 45z" fill="#fffcf0"/>
      <path d="M470 154h108m-108 19h108m-108 19h108" stroke="#c59e70" stroke-width="2"/>
      ${stageWindow(476, 141, workshop, 28, 27)}${stageWindow(548, 141, workshop, 25, 27)}
      <path d="M515 205v-43h23v43" fill="#9c514e" stroke="#856b50" stroke-width="3"/>
      <circle cx="532" cy="183" r="2" fill="#f5cb80"/>
      <circle cx="524" cy="113" r="11" fill="#f6dfae" stroke="#315c5c" stroke-width="2"/>
      <path d="M518 113h12m-6-6v12" stroke="#a65750" stroke-width="3"/>
      <path d="M460 206h127" stroke="#fffcf0" stroke-width="8" stroke-linecap="round"/>
      <rect x="568" y="185" width="25" height="22" rx="2" fill="#b66358"/><path d="M580 185v22m-12-14h25" stroke="#eed299" stroke-width="3"/>
      <rect x="448" y="192" width="23" height="15" rx="2" fill="#59837a"/><path d="M460 192v15" stroke="#e8c981" stroke-width="3"/>
    </g>
    <g class="${stationClass(3)}" data-station="3">
      <path d="M653 170q60-22 126-4" stroke="#afcbd3" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M663 157V104m0 4h27" stroke="#7b6652" stroke-width="4" stroke-linecap="round"/>
      <path d="m670 101 23 4-4 14-19-4z" fill="#e5bc7c"/>
      <path class="stage-flight-trail${sleigh ? ' is-lit' : ''}" d="M676 78q60-42 119-13" fill="none" stroke="${sleigh ? '#d6a951' : '#a5c2ca'}" stroke-width="2" stroke-dasharray="3 7"/>
      <g class="stage-sleigh" transform="translate(689 92) rotate(-8)">
        <path d="m0 25 9 30h49l15-31-28 5-5-19H22v20z" fill="#b65b58" stroke="#754c48" stroke-width="3" stroke-linejoin="round"/>
        <path d="m9 55-5 11h58q17 0 16-13M20 55l-4 11m36-11-4 11" fill="none" stroke="#cfaa68" stroke-width="4" stroke-linecap="round"/>
        <rect x="15" y="9" width="24" height="23" rx="2" fill="#568978"/><path d="M27 9v23m-12-14h24" stroke="#efd18f" stroke-width="4"/>
        <rect x="36" y="3" width="23" height="28" rx="2" fill="#e4b56f"/><path d="M47 3v28m-11-18h23" stroke="#b45a56" stroke-width="3"/>
      </g>
      <path class="stage-window${sleigh ? ' is-lit' : ''}" d="m774 85 4 8 9 1-6 7 1 9-8-4-8 4 2-9-7-7 9-1z" fill="${sleigh ? '#ffd67d' : '#bfd5da'}"/>
      <path d="M653 209q64-17 138-4" stroke="#fffaf0" stroke-width="13" fill="none" stroke-linecap="round"/>
    </g>
    ${stageBird([111, 314, 521, 724][current], 230)}
  </svg>`;
}

/** A snowy route, with lights earned only by solving every task at a station. */
export function holidayStage(missions, progress) {
  const state = stageState(missions, progress);
  if (!state.tasks.some(mission => stageStationIndex(mission) >= 0)) return '';
  const current = stageStations[state.current];
  const count = state.complete.filter(Boolean).length;
  return `<section class="holiday-stage" aria-label="Снежный почтовый городок" data-current="${state.current}" data-completed="${count}">
    ${stageScene(state.complete, state.current)}
    <ol class="stage-labels">${stageStations.map((station, index) => `<li class="stage-stop${state.complete[index] ? ' is-complete' : ''}${state.current === index ? ' is-current' : ''}"${state.current === index ? ' aria-current="step"' : ''}><span aria-hidden="true">${state.complete[index] ? '✓' : index + 1}</span>${station.short}<span class="visually-hidden">: ${state.complete[index] ? 'станция готова' : state.current === index ? 'Снегирь здесь' : 'впереди'}</span></li>`).join('')}</ol>
    <p class="stage-current"><b>${count === 4 ? 'Городок готов к празднику!' : `Снегирь сейчас: ${current.title}.`}</b> <span>${count === 4 ? 'Все четыре фрагмента адресной бирки собраны.' : current.setting}</span></p>
  </section>`;
}

/** Illustrated world panel. It reads progress, never a puzzle answer or a real hiding place. */
export function holidayWorld(missions, progress, {imageUrl = './assets/winter-village.jpg', courierUrl = './assets/robin-postman.png'} = {}) {
  const state = stageState(missions, progress);
  const hasStations = state.tasks.some(mission => stageStationIndex(mission) >= 0);
  const station = stageStations[state.current];
  const count = state.complete.filter(Boolean).length;
  const finished = hasStations && count === 4;
  const focus = [17, 40, 65, 87][state.current];
  const title = finished ? 'Праздник спасён!' : hasStations ? station.title : 'Новогодняя почта';
  const status = hasStations ? `Фрагментов адреса: ${count} из 4` : `Разгадано: ${state.solved} из ${state.tasks.length}`;
  const guide = finished ? 'Все письма собраны. Самое время найти свой подарок!' : state.phase === 'intro' ? 'Письмо ждёт! Поможешь вернуть потерянный адрес?' : hasStations ? 'Собирай фрагменты адреса. Я сохраню каждый в твоём почтовом пропуске.' : 'Каждое решение делает сюрприз чуть ближе.';
  return `<section class="quest-scene" aria-label="Новогодний городок" data-current="${state.current}" data-completed="${count}" style="--scene-focus:${focus}%">
    <img class="quest-scene-art" src="${stageEscape(imageUrl)}" width="1774" height="887" alt="Заснеженный новогодний городок: тёплая почта, нарядная ёлка, мастерская и сани в звёздном небе" fetchpriority="high">
    <div class="quest-scene-snow" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="quest-scene-lights${count ? ' is-awake' : ''}" aria-hidden="true">${state.complete.map((done,index)=>`<i class="quest-earned-light${done?' is-lit':''}" data-station="${index}"></i>`).join('')}</div>
    <div class="quest-scene-caption"><span class="quest-scene-kicker">Особая доставка · новогодняя почта</span><h2 class="quest-scene-title">${stageEscape(title)}</h2><p>${stageEscape(finished ? 'Письма нашли дорогу домой.' : station.setting)}</p><span class="quest-scene-progress">${stageEscape(status)}</span></div>
  </section>
  ${hasStations ? `<ol class="quest-stops" aria-label="Станции приключения">${stageStations.map((stop,index) => `<li data-station="${index}" class="quest-stop${state.current === index ? ' is-current' : ''}${state.complete[index] ? ' is-complete' : ''}"${state.current === index ? ' aria-current="step"' : ''}><span class="quest-stop-number" aria-hidden="true">${state.complete[index] ? '✓' : index + 1}</span><span class="quest-stop-name">${stop.short}</span><span class="visually-hidden">${state.complete[index] ? ': пройдено' : state.current === index ? ': ты здесь' : ': впереди'}</span></li>`).join('')}</ol>` : ''}
  <div class="quest-guide"><img class="quest-guide-portrait" src="${stageEscape(courierUrl)}" width="256" height="256" alt="Снегирь-почтальон с письмом"><div><b>Снегирь на связи</b><p>${stageEscape(guide)}</p></div></div>`;
}

function stageIconDrawing(item) {
  const colors = { red: '#c66e60', blue: '#678fa7', green: '#558578', gold: '#d4ad6c' };
  const color = colors[item?.color] || '#c66e60';
  const ink = '#385565';
  if (item?.kind === 'card' || item?.kind === 'envelope') {
    return `<rect x="12" y="24" width="76" height="54" rx="5" fill="#fff8df" stroke="${ink}" stroke-width="3"/><path d="m14 27 36 29 36-29M14 76l24-23m48 23L62 53" fill="none" stroke="${ink}" stroke-width="3"/>`;
  }
  if (item?.kind === 'tree') {
    return `<path d="M45 75h10v17H45z" fill="#967450"/><path d="m50 13 22 29H61l18 25H66l19 19H15l19-19H21l18-25H28z" fill="#558578" stroke="${ink}" stroke-width="3"/><path d="m32 53 35 9m-39 9 42 9" stroke="#f5d898" stroke-width="4"/>`;
  }
  if (item?.kind === 'ribbon') {
    return `<path d="M49 44C17 52 13 13 37 25l13 17c16-35 49-16 31-1-9 7-21 7-30 4L73 81l-15-5-8 13-9-39-9 36-8-12-14 3 24-33" fill="${color}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><circle cx="48" cy="46" r="8" fill="#e6c17d"/>`;
  }
  if (item?.kind === 'snowball') {
    const size = Number.isFinite(item.size) ? Math.min(1, Math.max(.2, item.size)) : 1;
    return `<circle cx="50" cy="${85 - 32 * size}" r="${32 * size}" fill="#fffdf5" stroke="#6d96a9" stroke-width="3"/><path d="M22 87h57" stroke="#bfd4d8" stroke-width="3" stroke-linecap="round"/>`;
  }
  if (item?.kind === 'flake') {
    return Array.from({ length: 6 }, (_, index) => `<path transform="rotate(${index * 60} 50 50)" d="M50 50V14m0 17-10-10m10 10 10-10" fill="none" stroke="#678fa7" stroke-width="4" stroke-linecap="round"/>`).join('');
  }
  if (item?.kind === 'house') {
    const number = typeof item.number === 'string' ? stageEscape(item.number.slice(0, 3)) : '';
    return `<path d="M22 44h56v43H22z" fill="#e8c995" stroke="${ink}" stroke-width="3"/><path d="m12 45 38-31 38 31z" fill="${color}" stroke="${ink}" stroke-width="3"/><path d="M42 65h17v22H42z" fill="#558578"/>${number ? `<text x="50" y="60" fill="${ink}" font-size="19" font-weight="700" text-anchor="middle">${number}</text>` : ''}`;
  }
  return `<rect x="19" y="34" width="62" height="50" rx="4" fill="${color}" stroke="${ink}" stroke-width="3"/><path d="M16 29h68v15H16z" fill="${color}" stroke="${ink}" stroke-width="3"/><path d="M46 30h10v54H46z" fill="#f2d597"/><path d="M50 29C24 31 26 8 42 19l8 10c8-23 32-16 20-5-5 4-12 5-20 5" fill="none" stroke="#edcf8f" stroke-width="5"/>`;
}

function stageItemIcon(item) {
  const drawing = item ? stageIconDrawing(item)
    : '<rect x="18" y="28" width="64" height="56" rx="5" fill="none" stroke="#b3c8ca" stroke-width="3" stroke-dasharray="5 5"/><path d="M50 41v28m-14-14h28" stroke="#b3c8ca" stroke-width="3" stroke-linecap="round"/>';
  return `<svg class="workbench-item-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${drawing}</svg>`;
}

function stageCodeInput(task, input) {
  const length = Number.isInteger(task.length) ? Math.min(8, Math.max(0, task.length)) : 0;
  const alphabet = typeof task.alphabet === 'string' ? task.alphabet.slice(0, 64) : '0123456789';
  const value = typeof input === 'string'
    ? Array.from(input.slice(0, 128).toUpperCase()).filter(character => alphabet.includes(character)).slice(0, length).join('')
    : '';
  return { length, value };
}

function stageCodeWorkbench(task, input) {
  const { length, value } = stageCodeInput(task, input);
  if (!length) return '';
  const width = 68 + length * 51;
  const digits = Array.from({ length }, (_, index) => {
    const filled = index < value.length;
    const x = 34 + index * 51;
    return `<g class="workbench-digit${filled ? ' is-filled' : ''}">
      <rect x="${x}" y="80" width="41" height="47" rx="7" fill="${filled ? '#fff5d7' : '#d9e7e9'}" stroke="${filled ? '#c78a56' : '#a7bcc2'}" stroke-width="2"/>
      <text x="${x + 20.5}" y="113" text-anchor="middle" fill="${filled ? '#8a493d' : '#8b9fa7'}" font-size="29" font-weight="700">${filled ? stageEscape(value[index]) : '·'}</text>
    </g>`;
  }).join('');
  return `<div class="holiday-workbench workbench-code" data-input-count="${value.length}" data-input-limit="${length}">
    <svg class="workbench-lock" viewBox="0 0 ${width} 146" aria-hidden="true" focusable="false">
      <path d="M${width / 2 - 30} 69V42a30 30 0 0 1 60 0v27" fill="none" stroke="#aa8b62" stroke-width="11" stroke-linecap="round"/>
      <rect x="20" y="62" width="${width - 40}" height="76" rx="17" fill="#eacb94" stroke="#a78358" stroke-width="3"/>
      <path d="M29 70h${width - 58}" stroke="#fff0c9" stroke-width="5" stroke-linecap="round"/>
      ${digits}
      <path d="m${width / 2 - 11} 28 11 8 11-8m-22 0h22v15h-22z" fill="#fff5d7" stroke="#a78358" stroke-width="2"/>
    </svg>
    <div class="workbench-load workbench-envelopes" aria-hidden="true">${Array.from({ length }, (_, index) => `<span class="workbench-parcel${index < value.length ? ' is-loaded' : ''}"><svg viewBox="0 0 80 56" aria-hidden="true" focusable="false"><rect x="5" y="9" width="70" height="42" rx="5" fill="${index < value.length ? '#fff4d2' : '#e2ebeb'}" stroke="${index < value.length ? '#b58b5d' : '#b4c7ca'}" stroke-width="2"/><path d="m7 11 33 25 33-25" fill="none" stroke="${index < value.length ? '#b58b5d' : '#b4c7ca'}" stroke-width="2"/>${index < value.length ? '<rect x="57" y="16" width="10" height="12" rx="1" fill="#c06d5d"/>' : ''}</svg></span>`).join('')}</div>
    <p class="workbench-status">Набрано ${value.length} из ${length}. ${value.length === length ? 'Код готов к проверке.' : 'Письма появляются с каждой цифрой.'}</p>
  </div>`;
}

function stageSelectionWorkbench(task, input, interactive = false) {
  const items = Array.isArray(task.items) ? task.items.slice(0, 24) : [];
  const count = Number.isInteger(task.count) ? Math.min(6, items.length, Math.max(0, task.count)) : 0;
  if (!count) return '';
  const value = Array.isArray(input) ? [...new Set(input.slice(0, 128)
    .filter(id => typeof id === 'string' && items.some(item => item.id === id)))].slice(0, count) : [];
  const selected = value.map(id => items.find(item => item.id === id));
  return `<div class="holiday-workbench workbench-selection" data-input-count="${selected.length}" data-input-limit="${count}">
    <div class="workbench-load" aria-label="${task.type === 'order' ? 'Твой порядок' : 'Твоя загрузка'}">${Array.from({ length: count }, (_, index) => {
      const item = selected[index];
      const label = typeof item?.label === 'string' ? item.label.slice(0, 96) : '';
      const control = interactive && item;
      const tag = control ? 'button' : 'div';
      const action = control ? ` type="button" data-action="task-toggle" data-focus="slot-${index}" data-value="${stageEscape(item.id)}" aria-label="Убрать ${task.type === 'order' ? 'шаг' : 'посылку'} ${index + 1}: ${stageEscape(label)}"` : '';
      return `<${tag} class="workbench-parcel${item ? ' is-loaded' : ''}${control ? ' filled-slot' : ''}"${action}><span class="workbench-position">${index + 1}</span>${stageItemIcon(item)}<span class="workbench-item-label">${item ? stageEscape(label) : 'Свободно'}</span></${tag}>`;
    }).join('')}</div>
    <div class="workbench-runner" aria-hidden="true"><svg viewBox="0 0 400 32" aria-hidden="true" focusable="false"><path d="M14 6h354q25 0 19-3M36 6l-8 15m323-15-8 15M21 24h343q25 0 22-13" fill="none" stroke="#b68b56" stroke-width="5" stroke-linecap="round"/></svg></div>
    <p class="workbench-status">${task.type === 'order' ? 'На столе' : 'В санях'}: ${selected.length} из ${count}. ${selected.length === count ? 'Можно проверить свой выбор.' : 'Добавляй предметы кнопками ниже.'}</p>
  </div>`;
}

/** An input preview; full input stays a draft until the existing check action. */
export function holidayWorkbench(mission, input, interactive = false) {
  const task = mission?.interaction;
  if (!task) return '';
  if (task.type === 'code') return stageCodeWorkbench(task, input);
  if (task.type === 'order' || task.type === 'pick') return stageSelectionWorkbench(task, input, interactive);
  // The switch puzzle already has lamps that respond to its current state.
  return '';
}

/** The host owns the continue button and calls this after a genuine solve. */
export function stationReward(missions, progress) {
  const state = stageState(missions, progress);
  if (!['find', 'treasure', 'done'].includes(state.phase)
    || !state.solved || stageStationIndex(state.tasks[state.index]) < 0
    || !state.complete[state.current]) return '';
  const station = stageStations[state.current];
  return `<section class="station-reward" data-station="${state.current}">
    <div class="reward-stamp" aria-hidden="true"><svg viewBox="0 0 110 100" aria-hidden="true" focusable="false"><rect x="11" y="9" width="87" height="81" rx="13" fill="#fff2cc" stroke="#b56b54" stroke-width="3" stroke-dasharray="3 5"/><circle cx="55" cy="49" r="28" fill="#e9dcc0" stroke="#b56b54" stroke-width="2"/><path d="m40 49 11 11 21-25" fill="none" stroke="#3d7966" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 77h56" stroke="#b56b54" stroke-width="3"/></svg></div>
    <div><p class="reward-kicker">${station.title} · готово</p><h2>${station.celebration}</h2><p class="reward-fragment">Фрагмент адресной бирки ${state.current + 1} из 4 — в твоём пропуске.</p></div>
  </section>`;
}
