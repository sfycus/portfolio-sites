/** Pure, dependency-free quest generation. Treat all returned text as text, never HTML. */
export const LOCATIONS = Object.freeze([
  { id: 'books', title: 'Рядом с книгами', hint: 'Истории стоят плечом к плечу. Поищи у книг.', safety: 'Низкая доступная полка. Книги и тяжёлые предметы не двигать.' },
  { id: 'sofa', title: 'На диване', hint: 'Здесь удобно сидеть всей семьёй. Поищи под лёгкой диванной подушкой.', safety: 'Тайник под лёгкой подушкой. Диван не двигать и не разбирать.' },
  { id: 'wardrobe', title: 'В шкафу с одеждой', hint: 'Здесь отдыхают футболки и свитеры. Поищи на нижней полке шкафа.', safety: 'Только открытая нижняя полка. Не залезать внутрь и не тянуть вещи сверху.' },
  { id: 'shoes', title: 'Рядом с обувью', hint: 'Здесь пары ждут следующей прогулки. Посмотри рядом со своей обувью.', safety: 'На полу у чистой обуви, вдали от входной двери.' },
  { id: 'desk', title: 'На письменном столе', hint: 'Карандаши и бумага любят это место. Поищи на письменном столе.', safety: 'На свободном краю стола. Убрать ножницы и другие острые предметы.' },
  { id: 'bed', title: 'На кровати', hint: 'Здесь снятся самые разные сны. Посмотри под подушкой на кровати.', safety: 'Только обычная низкая кровать. Не использовать верхний ярус.' },
  { id: 'toys', title: 'В коробке с игрушками', hint: 'После игры друзья собираются здесь. Поищи сверху в коробке с игрушками.', safety: 'Открытая лёгкая коробка на полу. Без крышки и тяжёлых игрушек сверху.' },
  { id: 'mirror', title: 'Возле зеркала', hint: 'Здесь тебя встречает твой двойник. Поищи возле зеркала.', safety: 'Тайник рядом с надёжно закреплённым зеркалом. Зеркало не трогать.' },
  { id: 'drawer', title: 'В нижнем ящике', hint: 'У этого маленького хранилища есть ручка. Поищи в заранее выбранном нижнем ящике.', safety: 'Взрослый заранее приоткрывает лёгкий нижний ящик. Другие ящики не открывать.' },
  { id: 'blanket', title: 'Под пледом', hint: 'Этот мягкий помощник согревает без слов. Поищи под пледом.', safety: 'Лёгкий плед на диване или полу. Не накрываться им с головой.' },
].map(Object.freeze));

export const AGE_GROUPS = Object.freeze([
  { id: '5-7', title: '5–7 лет', description: 'Картинки, игрушечные шифры и простые цепочки. Взрослый может читать вслух.' },
  { id: '8-10', title: '8–10 лет', description: 'Письма с шифрами, сборка посылок и маршруты саней.' },
  { id: '11-13', title: '11–13 лет', description: 'Ледяные решётки, переключатели и логические задачи в несколько шагов.' },
].map(Object.freeze));

export const THEMES = Object.freeze([
  { id: 'everyday', title: 'Тайная экспедиция', description: 'Домашнее приключение в любой день.' },
  { id: 'winter', title: 'Новогодняя почта', description: 'Праздничные загадки и тайники на пути к новогоднему подарку.' },
].map(Object.freeze));

const LOCATION_IDS = new Set(LOCATIONS.map((item) => item.id));
const AGE_IDS = new Set(AGE_GROUPS.map((item) => item.id));
const THEME_IDS = new Set(THEMES.map((item) => item.id));
const MAX_SEED = 2147483647;
const MAX_PAYLOAD = 6000;
const NOT_PRINTABLE = /[\p{C}\p{Zl}\p{Zp}]/u;

function ownValue(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, 'value')) throw new Error('Настройки должны содержать обычные значения.');
  return descriptor.value;
}

function textField(value, label, min, max) {
  if (typeof value !== 'string' || NOT_PRINTABLE.test(value)) {
    throw new Error(`${label}: используйте обычный текст без скрытых и управляющих символов.`);
  }
  const result = value.normalize('NFC').trim();
  const length = [...result].length;
  if (length < min || length > max) throw new Error(`${label}: допустимо от ${min} до ${max} символов.`);
  return result;
}

/** Validates untrusted input and copies only supported own properties. No type coercion. */
export function validateConfig(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Не удалось прочитать настройки квеста.');
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new Error('Неверный формат настроек квеста.');
  if (ownValue(input, 'v') !== 1) throw new Error('Эта версия ссылки не поддерживается. Создайте новый квест.');
  const name = textField(ownValue(input, 'name'), 'Имя', 1, 24);
  const age = ownValue(input, 'age');
  if (typeof age !== 'string' || !AGE_IDS.has(age)) throw new Error('Выберите возраст: 5–7, 8–10 или 11–13 лет.');
  const theme = ownValue(input, 'theme');
  if (typeof theme !== 'string' || !THEME_IDS.has(theme)) throw new Error('Выберите тему квеста из списка.');
  const mode = ownValue(input, 'mode');
  if (mode !== undefined && mode !== 'cards' && mode !== 'screen') throw new Error('Выберите формат игры: в браузере или с карточками.');
  const edition = ownValue(input, 'edition');
  if (edition !== undefined && edition !== 2 && edition !== 3) throw new Error('Этот набор загадок не поддерживается. Создайте новый квест.');
  const suppliedRoute = ownValue(input, 'route');
  if (!Array.isArray(suppliedRoute) || suppliedRoute.length < 4 || suppliedRoute.length > 8) {
    throw new Error('Выберите от 4 до 8 разных тайников.');
  }
  // A sparse array must not bypass validation, and array accessors are not executed.
  const route = [];
  for (let index = 0; index < suppliedRoute.length; index += 1) {
    const location = ownValue(suppliedRoute, String(index));
    if (typeof location !== 'string' || !LOCATION_IDS.has(location)) throw new Error('В маршруте есть неизвестный тайник.');
    route.push(location);
  }
  if (new Set(route).size !== route.length) throw new Error('Каждый тайник можно выбрать только один раз.');
  const seed = ownValue(input, 'seed');
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > MAX_SEED) throw new Error('Номер квеста должен быть целым числом от 1 до 2147483647.');
  const suppliedNote = ownValue(input, 'giftNote');
  const giftNote = suppliedNote === undefined ? '' : textField(suppliedNote, 'Записка к подарку', 0, 120);
  // Keep the legacy canonical shape (and its IDs) for games with physical cards.
  return Object.freeze({ v: 1, name, age, theme, route: Object.freeze(route), seed, giftNote, ...(mode === 'screen' ? { mode } : {}), ...(edition !== undefined ? { edition } : {}) });
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary);
  if (typeof globalThis.Buffer !== 'undefined') return globalThis.Buffer.from(bytes).toString('base64');
  throw new Error('Этот браузер не умеет создавать ссылки квеста.');
}

function toBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encodeConfig(input) {
  const config = validateConfig(input);
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(config)));
  if (encoded.length > MAX_PAYLOAD) throw new Error('Настройки слишком длинные для ссылки.');
  return encoded;
}

export function decodeConfig(encoded) {
  if (typeof encoded !== 'string' || !encoded.length || encoded.length > MAX_PAYLOAD) {
    throw new Error('Ссылка квеста пуста или слишком длинная.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) {
    throw new Error('Ссылка квеста повреждена. Скопируйте её целиком.');
  }
  let input;
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    let bytes;
    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } else if (typeof globalThis.Buffer !== 'undefined') {
      bytes = new Uint8Array(globalThis.Buffer.from(base64, 'base64'));
    } else {
      throw new Error('Unsupported browser');
    }
    if (toBase64Url(bytes) !== encoded) throw new Error('Non-canonical base64');
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('Не удалось прочитать ссылку квеста. Скопируйте её целиком или создайте новую.');
  }
  return validateConfig(input);
}

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

const integer = (random, min, max) => min + Math.floor(random() * (max - min + 1));
const numbers = (answer) => [answer, answer + 1, answer - 1, answer + 2].map(String);
const puzzle = (id, title, prompt, answer, choices, hint, explanation) => ({ id, title, prompt, answer: String(answer), choices: choices.map(String), hint, explanation });
const chooseWord = (theme, winter, everyday) => theme === 'winter' ? winter : everyday;
function counted(number, one, few, many) {
  const lastTwo = number % 100;
  const word = lastTwo >= 11 && lastTwo <= 14 ? many : number % 10 === 1 ? one : number % 10 >= 2 && number % 10 <= 4 ? few : many;
  return `${number} ${word}`;
}

const YOUNG_PUZZLES = [
  (r, theme) => {
    const a = integer(r, 2, 5), b = integer(r, 1, 3), answer = a + b;
    const item = chooseWord(theme, counted(a, 'новогоднюю звёздочку', 'новогодние звёздочки', 'новогодних звёздочек'), counted(a, 'бумажную звёздочку', 'бумажные звёздочки', 'бумажных звёздочек'));
    return puzzle('young-add', 'Звёздная коллекция', `Лиса собрала ${item}. Ей подарили ещё ${b}. Сколько звёздочек стало?`, answer, numbers(answer), 'Прибавь новые звёздочки к тем, что уже были.', `${a} + ${b} = ${answer}. Считаем все звёздочки вместе.`);
  },
  (r, theme) => {
    const a = integer(r, 6, 9), b = integer(r, 2, 4), answer = a - b;
    return puzzle('young-subtract', 'Почта для друзей', `У Зайца ${a} ${chooseWord(theme, 'новогодних открыток', 'приглашений')}. Он отдал друзьям ${b}. Сколько осталось?`, answer, numbers(answer), 'Из общего числа убери то, что Заяц уже отдал.', `${a} − ${b} = ${answer}. Столько осталось у Зайца.`);
  },
  (r) => {
    const a = integer(r, 2, 4), values = [a, a + 2, a + 4, a + 1], answer = a + 4;
    return puzzle('young-largest', 'Самое большое число', `На карточках числа: ${values.join(', ')}. Какое число самое большое?`, answer, values, 'Посчитай от 1: самое большое из этих чисел назовёшь последним.', `${answer} больше каждого из остальных чисел на карточках.`);
  },
  (r, theme) => {
    const count = integer(r, 2, 3), answer = count * 3;
    return puzzle('young-triangles', 'Треугольные флажки', `На ${chooseWord(theme, 'новогодней гирлянде', 'праздничной гирлянде')} ${count} отдельных треугольника. У каждого 3 стороны. Сколько сторон у них всего?`, answer, numbers(answer), `Посчитай по три ${count} раза.`, `${Array(count).fill(3).join(' + ')} = ${answer}. Стороны каждого треугольника считаем отдельно.`);
  },
  (r, theme) => {
    const pairs = [['Красный', 'Синий'], ['Зелёный', 'Жёлтый'], ['Синий', 'Жёлтый']];
    const [a, b] = pairs[integer(r, 0, pairs.length - 1)];
    return puzzle('young-pattern', chooseWord(theme, 'Цветная гирлянда', 'Цветная дорожка'), `${chooseWord(theme, 'Новогоднюю гирлянду украшают флажками', 'Дорожку выкладывают цветными карточками')}, повторяя пару «${a.toLowerCase()}, ${b.toLowerCase()}». Цвета идут так: ${a.toLowerCase()}, ${b.toLowerCase()}, ${a.toLowerCase()}, ${b.toLowerCase()}, ${a.toLowerCase()}. Какой цвет следующий?`, b, ['Красный', 'Синий', 'Зелёный', 'Жёлтый'], 'В каждой паре сначала один цвет, затем второй.', `После цвета «${a.toLowerCase()}» идёт цвет «${b.toLowerCase()}». Так повторяется одна и та же пара.`);
  },
  (r, theme) => {
    const item = chooseWord(theme, 'Санки', 'Мяч');
    return puzzle('young-category', 'Лишнее слово', 'Три слова называют животных. Какое слово называет предмет?', item, ['Лиса', 'Заяц', item, 'Белка'], 'Лиса, заяц и белка — живые существа. А что в этом списке сделано человеком?', `${item} — предмет. Лиса, заяц и белка — животные.`);
  },
  (r) => {
    const start = integer(r, 1, 5), answer = start + 2;
    return puzzle('young-count', 'Потерянное число', `Считаем по одному: ${start}, ${start + 1}, …, ${start + 3}. Какое число пропущено?`, answer, numbers(answer), 'После каждого числа идёт число на один больше.', `После ${start + 1} идёт ${answer}, а затем ${start + 3}.`);
  },
  (r) => {
    const colors = ['Красная', 'Синяя', 'Зелёная'];
    const answer = colors[integer(r, 0, 2)];
    const excluded = colors.filter((color) => color !== answer);
    return puzzle('young-box', 'Три коробки', `В загадке только три коробки: красная, синяя и зелёная. Звезда не в ${excluded[0] === 'Красная' ? 'красной' : excluded[0] === 'Синяя' ? 'синей' : 'зелёной'} и не в ${excluded[1] === 'Красная' ? 'красной' : excluded[1] === 'Синяя' ? 'синей' : 'зелёной'}. В какой коробке звезда?`, answer, colors, 'Исключи две коробки, в которых звезда точно не лежит.', `Остаётся одна коробка — ${answer.toLowerCase()}. Другие две исключены условием.`);
  },
];

const MIDDLE_PUZZLES = [
  (r, theme) => {
    const groups = integer(r, 3, 5), each = integer(r, 3, 6), answer = groups * each;
    return puzzle('middle-multiply', 'Запас мастерской', `Для ${chooseWord(theme, 'новогодней мастерской', 'мастерской открытий')} приготовили ${counted(groups, 'пакет', 'пакета', 'пакетов')}. В каждом по ${counted(each, 'наклейке', 'наклейки', 'наклеек')}. Сколько наклеек во всех пакетах?`, answer, numbers(answer), 'Одинаковые группы удобно посчитать умножением.', `${groups} × ${each} = ${answer}. Всего ${counted(answer, 'наклейка', 'наклейки', 'наклеек')}.`);
  },
  (r, theme) => {
    const friends = integer(r, 3, 5), each = integer(r, 3, 6), total = friends * each;
    const item = chooseWord(theme, counted(total, 'новогодний жетон', 'новогодних жетона', 'новогодних жетонов'), counted(total, 'цветной жетон', 'цветных жетона', 'цветных жетонов'));
    const friendsWord = ['тремя', 'четырьмя', 'пятью'][friends - 3];
    return puzzle('middle-divide', 'Поровну для всех', `${item} разделили поровну между ${friendsWord} друзьями. Сколько жетонов получил каждый?`, each, numbers(each), 'Нужно общее число разделить на число друзей.', `${total} ÷ ${friends} = ${each}. У каждого одинаковое количество.`);
  },
  (r) => {
    const start = integer(r, 2, 8), step = integer(r, 3, 5), answer = start + 4 * step;
    return puzzle('middle-sequence', 'Ритм чисел', `Каждый раз прибавляют ${step}: ${start}, ${start + step}, ${start + 2 * step}, ${start + 3 * step}, … Какое число дальше?`, answer, numbers(answer), `Прибавь ${step} к последнему записанному числу.`, `${start + 3 * step} + ${step} = ${answer}.`);
  },
  (r, theme) => {
    return puzzle('middle-order', 'Финишная ленточка', `${chooseWord(theme, 'В новогоднем забеге', 'На лесной дорожке')} Белка финишировала раньше Зайца, а Заяц — раньше Ёжика. Других участников нет. Кто финишировал вторым?`, 'Заяц', ['Белка', 'Заяц', 'Ёжик'], 'Поставь участников по порядку от первого к последнему.', 'Порядок такой: Белка, Заяц, Ёжик. Вторым был Заяц.');
  },
  (r) => {
    const variants = [
      { code: '1–2–3', answer: 'КОТ' },
      { code: '3–2–1', answer: 'ТОК' },
      { code: '4–2–1', answer: 'СОК' },
      { code: '1–3–2', answer: 'КТО' },
    ];
    const { code, answer } = variants[integer(r, 0, variants.length - 1)];
    return puzzle('middle-cipher', 'Буквенный шифр', `Ключ: 1 = К, 2 = О, 3 = Т, 4 = С. Какое слово записано кодом ${code}?`, answer, variants.map((item) => item.answer), 'Заменяй каждую цифру буквой из ключа, сохраняя порядок.', `Заменяем цифры по ключу и получаем «${answer}».`);
  },
  (r) => {
    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    const start = integer(r, 0, 6), after = integer(r, 2, 5), answerIndex = (start + after) % 7;
    const choices = [0, 1, 2, 3].map((offset) => days[(answerIndex + offset) % 7]);
    return puzzle('middle-calendar', 'Встреча по календарю', `Сегодня — ${days[start].toLowerCase()}. Какой день недели будет через ${counted(after, 'день', 'дня', 'дней')}? Завтра считается первым днём.`, days[answerIndex], choices, 'Отсчитывай дни после сегодняшнего. После воскресенья идёт понедельник.', `Отсчитываем ${counted(after, 'день', 'дня', 'дней')} после сегодняшнего. Получается: ${days[answerIndex].toLowerCase()}.`);
  },
  (r, theme) => {
    const first = integer(r, 2, 4) * 5, second = integer(r, 3, 6) * 5, answer = 100 - first - second;
    return puzzle('middle-length', 'Лента для посылки', `Был 1 метр ленты, то есть 100 см. На ${chooseWord(theme, 'новогоднюю посылку', 'секретную посылку')} отрезали ${first} см, затем ещё ${second} см. Сколько сантиметров осталось?`, answer, numbers(answer), 'Вычти оба отрезка из 100 сантиметров.', `100 − ${first} − ${second} = ${answer} см.`);
  },
  (r) => {
    const start = integer(r, 2, 5), forward = integer(r, 5, 9), backward = integer(r, 2, 4), answer = start + forward - backward;
    return puzzle('middle-steps', 'Шаги робота', `Клетки дорожки пронумерованы по порядку. Вперёд — к большим номерам, назад — к меньшим. Робот начинает на клетке ${start}, проходит ${counted(forward, 'клетку', 'клетки', 'клеток')} вперёд, затем ${counted(backward, 'клетку', 'клетки', 'клеток')} назад. На какой клетке он окажется?`, answer, numbers(answer), 'Вперёд — прибавляем, назад — вычитаем. Исходную клетку шагом не считаем.', `${start} + ${forward} − ${backward} = ${answer}. Это номер конечной клетки.`);
  },
];

const OLDER_PUZZLES = [
  (r) => {
    const x = integer(r, 3, 9), a = integer(r, 3, 6), b = integer(r, 4, 12), total = a * x + b;
    return puzzle('older-equation', 'Секретное число', `Секретное число умножили на ${a}, затем прибавили ${b} и получили ${total}. Какое число было секретным?`, x, numbers(x), 'Выполни обратные действия: сначала вычти, потом раздели.', `(${total} − ${b}) ÷ ${a} = ${x}. Проверка: ${x} × ${a} + ${b} = ${total}.`);
  },
  (r, theme) => {
    const total = integer(r, 4, 8) * 6, half = total / 2, third = half / 3, answer = half - third;
    return puzzle('older-fractions', 'Две доставки', `${chooseWord(theme, 'На новогодней почте', 'В бюро находок')} было ${counted(total, 'жетон', 'жетона', 'жетонов')}. Утром отправили половину всех жетонов, а вечером — треть оставшихся. Сколько жетонов осталось после двух отправок?`, answer, numbers(answer), 'Сначала найди половину исходного числа. Треть для второй отправки считай от остатка.', `После утра: ${total} ÷ 2 = ${half}. Вечером отправили ${half} ÷ 3 = ${third}. Осталось ${half} − ${third} = ${answer}.`);
  },
  (r) => {
    const unit = integer(r, 1, 4), tens = unit * 2, sum = unit + tens, answer = 10 * tens + unit;
    const choices = [answer, 10 * unit + tens, answer + 1, answer + 10];
    return puzzle('older-code', 'Двузначный пароль', `Пароль — двузначное число. Сумма его цифр равна ${sum}, а цифра десятков вдвое больше цифры единиц. Какой это пароль?`, answer, choices, 'Одна доля — цифра единиц, две такие доли — цифра десятков. Всего три доли.', `${sum} ÷ 3 = ${unit} — цифра единиц. Цифра десятков: ${unit} × 2 = ${tens}. Пароль: ${answer}.`);
  },
  (r) => {
    const start = integer(r, 1, 7), step = integer(r, 2, 4), answer = start + 10 * step;
    return puzzle('older-differences', 'Растущие прыжки', `Начали с числа ${start}. Прибавляют ${step}, потом ${2 * step}, потом ${3 * step} и так далее, увеличивая прибавку на ${step}. Ряд: ${start}, ${start + step}, ${start + 3 * step}, ${start + 6 * step}, … Какое число следующее?`, answer, numbers(answer), `Следующая прибавка равна ${4 * step}.`, `${start + 6 * step} + ${4 * step} = ${answer}. Прибавки растут на ${step}.`);
  },
  (r, theme) => {
    const base = integer(r, 2, 4), batches = integer(r, 3, 5), answer = base * batches;
    return puzzle('older-proportion', 'Рецепт мастерской', `Для двух одинаковых ${chooseWord(theme, 'новогодних бумажных фонариков', 'бумажных фонариков')} нужно ${counted(base, 'лист бумаги', 'листа бумаги', 'листов бумаги')}. Сколько листов нужно для ${2 * batches} таких фонариков? Бумагу расходуют в той же пропорции.`, answer, numbers(answer), `Фонариков стало в ${counted(batches, 'раз', 'раза', 'раз')} больше. Во столько же раз увеличится расход бумаги.`, `${2 * batches} ÷ 2 = ${batches}; ${base} × ${batches} = ${answer}. Понадобится ${counted(answer, 'лист', 'листа', 'листов')}.`);
  },
  (r) => {
    const short = integer(r, 5, 8), gap = integer(r, 3, 6), long = short + gap;
    const answer = counted(gap, 'минута', 'минуты', 'минут');
    return puzzle('older-timer', 'Два песочных таймера', `Два песочных таймера на ${short} и ${long} минут запустили одновременно. Сколько времени пройдёт между моментом, когда опустеет короткий, и моментом, когда опустеет длинный?`, answer, [gap, gap + 1, short, long].map((n) => counted(n, 'минута', 'минуты', 'минут')).filter((value, index, all) => all.indexOf(value) === index), 'Оба таймера начали отсчёт в один момент. Нужна разница длительностей.', `${long} − ${short} = ${gap}. Между окончаниями пройдёт ${counted(gap, 'минута', 'минуты', 'минут')}.`);
  },
  (r, theme) => {
    const colors = integer(r, 3, 5), patterns = integer(r, 2, 4), answer = colors * patterns;
    return puzzle('older-combinations', chooseWord(theme, 'Значки новогодней почты', 'Значки экспедиции'), `Значок ${chooseWord(theme, 'новогодней почты', 'экспедиции')} состоит из одного фона и одного узора. Есть ${counted(colors, 'цвет фона', 'цвета фона', 'цветов фона')} и ${counted(patterns, 'узор', 'узора', 'узоров')}. Любой цвет можно соединить с любым узором. Сколько разных значков получится?`, answer, numbers(answer), 'Для каждого цвета доступны все узоры.', `${colors} × ${patterns} = ${answer}. Всего ${counted(answer, 'сочетание', 'сочетания', 'сочетаний')}. Для каждого цвета посчитаны все узоры.`);
  },
  (r) => {
    const small = integer(r, 2, 6), large = small + 3, total = small + large;
    return puzzle('older-balance', 'Два мешочка', `В двух мешочках вместе ${total} камешков. В большом на 3 камешка больше, чем в маленьком. Сколько камешков в маленьком мешочке?`, small, numbers(small), 'Мысленно убери 3 лишних камешка из большого мешочка. Оставшееся раздели поровну.', `(${total} − 3) ÷ 2 = ${small}. В большом мешочке — ${counted(large, 'камешек', 'камешка', 'камешков')}, вместе — ${total}.`);
  },
];

const BANKS = { '5-7': YOUNG_PUZZLES, '8-10': MIDDLE_PUZZLES, '11-13': OLDER_PUZZLES };

// Edition 2 is opt-in. The original arrays and PRNG call order above remain immutable for saved links.
const distinctNumbers = (answer, ...others) => [...new Set([answer, ...others, answer + 1, answer - 1, answer + 2])].slice(0, 4).map(String);
const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const entry = (kind, make) => ({kind, make});
const V2_BANKS = {
  '5-7': [
    ...YOUNG_PUZZLES.map((make,index) => entry(['count','count','count','count','logic','word','count','logic'][index], index === 3 ? (r) => {
      const pairs=integer(r,2,5), total=pairs*2;
      return puzzle('young-pairs','Варежки для друзей',`На столе ${counted(total,'варежка','варежки','варежек')}. В каждой паре две варежки. Сколько полных пар получится?`,pairs,distinctNumbers(pairs,total,pairs+1),'Собирай варежки по две. Каждая такая группа — одна пара.',`${Array(pairs).fill('2').join(' + ')} = ${total}. Получается ${counted(pairs,'пара','пары','пар')}.`);
    } : index === 4 ? (r) => {
      const colors=[['Красный','Синий'],['Зелёный','Жёлтый'],['Синий','Жёлтый']];const [a,b]=colors[integer(r,0,2)];
      return puzzle('young-pattern','Цветная дорожка',`Цвета повторяются парами: ${a.toLowerCase()}, ${b.toLowerCase()}. Дорожка: ${a.toLowerCase()}, ${b.toLowerCase()}, ${a.toLowerCase()}, ${b.toLowerCase()}, ${a.toLowerCase()}, … Какой цвет следующий?`,b,['Красный','Синий','Зелёный','Жёлтый'],'После первого цвета пары каждый раз идёт второй.',`После цвета «${a.toLowerCase()}» идёт цвет «${b.toLowerCase()}».`);
    } : make)),
    entry('logic',(r) => {
      const animals=shuffle(['Лиса','Заяц','Белка'],r);
      return puzzle('young-position','Дружная очередь',`Друзья стоят в таком порядке: ${animals.join(', ')}. Кто стоит в середине?`,animals[1],animals,'В середине тот, у кого есть сосед с каждой стороны.',`Сначала ${animals[0]}, в середине ${animals[1]}, в конце ${animals[2]}.`);
    }),
    entry('logic',(r) => {
      const variants=[{corners:0,answer:'Круг'},{corners:3,answer:'Треугольник'},{corners:4,answer:'Квадрат'}];const chosen=variants[integer(r,0,2)];
      return puzzle('young-shape','Фигуры на открытке',chosen.corners===0?'У какой из этих фигур нет углов?':`У какой из этих фигур ${counted(chosen.corners,'угол','угла','углов')}?`,chosen.answer,['Круг','Квадрат','Треугольник'],'Вспомни, как выглядит каждая фигура. Можешь обвести её пальцем в воздухе.',chosen.corners===0?'У круга плавный край, углов нет.':`${chosen.answer}: ${counted(chosen.corners,'угол','угла','углов')}.`);
    }),
    entry('word',(r) => {
      const sets=[['Нарисовали','Раскрасили','Подписали'],['Открыли','Положили письмо','Закрыли']];const actions=sets[integer(r,0,1)];
      return puzzle('young-actions','Что было потом?',`Действия идут по порядку: «${actions[0]}», «${actions[1]}», «${actions[2]}». Что делали вторым?`,actions[1],actions,'Назови действия по порядку. Второе находится между первым и третьим.',`Первое — «${actions[0]}», второе — «${actions[1]}», третье — «${actions[2]}».`);
    }),
    entry('word',(r) => {
      const words=['Лиса','Заяц','Кот','Дом'];const answer=words[integer(r,0,3)],letter=answer[0].toUpperCase();
      return puzzle('young-letter','Буква на конверте',`На конверте буква «${letter}». Какое слово начинается с этой буквы?`,answer,words,'Произнеси каждое слово медленно. Послушай первый звук.',`Слово «${answer}» начинается с буквы «${letter}».`);
    }),
  ],
  '8-10': [
    ...MIDDLE_PUZZLES.map((make,index)=>entry(['count','count','logic','logic','word','time','count','logic'][index],make)),
    entry('time',(r)=>{
      const hour=integer(r,9,17),minute=integer(r,9,11)*5,duration=integer(r,4,7)*5,start=hour*60+minute,end=start+duration;
      return puzzle('middle-clock','Посылка к сроку',`Мастерская начала работу в ${clock(start)}. На упаковку ушло ${duration} минут. Во сколько закончили?`,clock(end),[clock(end),clock(end+15),clock(end-10),clock(end-60)],`До следующего часа осталось ${60-minute} минут. Сколько времени останется потом?`,`До ${clock((hour+1)*60)} проходит ${60-minute} минут. Ещё ${duration-(60-minute)} минут — и получается ${clock(end)}.`);
    }),
    entry('count',(r)=>{
      const a=integer(r,5,10),b=integer(r,2,4),answer=2*(a+b);
      return puzzle('middle-perimeter','Рамка для открытки',`У прямоугольной открытки две стороны по ${a} см и две по ${b} см. Какова длина её края по кругу?`,answer,distinctNumbers(answer,a+b,a*b), 'Сложи длины всех четырёх сторон.',`${a} + ${b} + ${a} + ${b} = ${answer} см. Это периметр открытки.`);
    }),
    entry('logic',(r)=>{
      const names=shuffle(['Аня','Вера','Маша'],r),gifts=shuffle([{word:'книгу'},{word:'мяч'},{word:'пазл'}],r);
      return puzzle('middle-gifts','Три разных подарка',`Аня, Вера и Маша получили разные подарки: книгу, мяч и пазл. ${names[0]} получила ${gifts[0].word}. ${names[1]} не получила ${gifts[1].word}. Кто получил ${gifts[1].word}?`,names[2],names,'Один подарок уже занят. Из двух оставшихся один не подходит второй девочке.',`${names[0]} уже получила ${gifts[0].word}. ${names[1]} не получила ${gifts[1].word}, поэтому этот подарок получила ${names[2]}.`);
    }),
    entry('logic',(r)=>{
      const lower=integer(r,1,5)*10,upper=lower+10,answer=lower+2*integer(r,1,4);
      return puzzle('middle-conditions','Подходящий номер',`Нужен чётный номер, который больше ${lower} и меньше ${upper}. Какой из предложенных номеров подходит?`,answer,[answer,lower+1,upper,lower-2],'Проверь два условия: номер делится на два и лежит строго между границами.',`${answer} — чётное число. Оно больше ${lower} и меньше ${upper}. Другие варианты нарушают хотя бы одно условие.`);
    }),
  ],
  '11-13': [
    ...OLDER_PUZZLES.map((make,index)=>entry(['count','count','pattern','pattern','count','logic','count','logic'][index],make)),
    entry('count',(r)=>{
      const total=[40,60,80,100,120,160][integer(r,0,5)],percent=[25,50,75][integer(r,0,2)],answer=total*percent/100;
      return puzzle('older-percent','Цветные жетоны',`В мастерской ${total} жетонов. Из них ${percent}% — синие. Сколько синих жетонов?`,answer,distinctNumbers(answer,total-answer,percent,total),'Найди нужную долю от общего числа. 25% — четверть, 50% — половина, 75% — три четверти.',`${total} × ${percent} ÷ 100 = ${answer}. Столько синих жетонов.`);
    }),
    entry('logic',(r)=>{
      const red=integer(r,2,5),blue=integer(r,1,4),total=red+blue,options=[...new Set([red,red-1,red+1,total,0])].slice(0,4).map(n=>`${n}/${total}`);
      return puzzle('older-chance','Жетон наугад',`В мешке ${counted(red,'красный жетон','красных жетона','красных жетонов')} и ${counted(blue,'синий жетон','синих жетона','синих жетонов')}. Все одинаковые на ощупь. Один выбирают наугад, не глядя. Какова вероятность достать красный?`,`${red}/${total}`,options,'В числителе — число подходящих жетонов, в знаменателе — общее число.',`Всего ${red} + ${blue} = ${total} жетонов. Красных ${red}, поэтому вероятность равна ${red}/${total}.`);
    }),
    entry('pattern',(r)=>{
      const answer=integer(r,2,5)*12+9;
      return puzzle('older-remainders','Номер с двумя условиями',`Номер больше ${answer-8} и меньше ${answer+8}. Он делится на 3 без остатка, а при делении на 4 даёт остаток 1. Какой это номер?`,answer,[answer,answer-3,answer-4,answer+2],'Сначала оставь числа, которые делятся на 3. Затем проверь остаток при делении на 4.',`${answer} = 3 × ${answer/3}; ${answer} = 4 × ${Math.floor(answer/4)} + 1. Оба условия выполнены.`);
    }),
    entry('logic',(r)=>{
      const first=integer(r,2,4),second=first+1,duration=first*second,answer=first+second;
      return puzzle('older-work','Работаем одновременно',`Первый мастер упаковывает один подарок за ${counted(first,'минуту','минуты','минут')}, второй — за ${counted(second,'минуту','минуты','минут')}. Они начали вместе и работали без перерывов. Сколько подарков полностью готовы через ${duration} минут?`,answer,distinctNumbers(answer,duration,second),'Посчитай работу каждого мастера за всё время, затем сложи результаты.',`Первый: ${duration} ÷ ${first} = ${second}. Второй: ${duration} ÷ ${second} = ${first}. Вместе ${second} + ${first} = ${answer} подарков.`);
    }),
  ],
};

function editionTwoMakers(age, count, random) {
  const shuffled=shuffle(V2_BANKS[age],random);
  const kinds=age==='5-7'?['count','logic','word']:age==='8-10'?['count','logic','time']:['count','logic','pattern'];
  const selected=kinds.map(kind=>shuffled.find(record=>record.kind===kind));
  for(const record of shuffled)if(!selected.includes(record)&&selected.length<count)selected.push(record);
  return shuffle(selected,random).map(record=>record.make);
}

// Edition three is a separate story. Never change earlier banks: printed codes and
// family links must continue to lead to exactly the same puzzles.
const WINTER_STATIONS = [
  {title:'Северная почта',stamp:'Письмо',discovery:'На дне почтового лотка нашёлся первый кусочек адресной бирки.',clueTitle:'След на почте',clueText:'Мы справились с делами Северной почты. Я сохранил первый кусочек: начало адресной бирки восстановлено! — Снегирь.'},
  {title:'Ёлочная площадь',stamp:'Ёлка',discovery:'В нижних ветках ёлки застрял второй кусочек бирки. Снегирь снял его клювом.',clueTitle:'Огни площади',clueText:'Площадь готова встречать праздник. Я забрал второй кусочек с ёлки и соединил его с первым. — Снегирь.'},
  {title:'Мастерская подарков',stamp:'Подарок',discovery:'Под мотком золотой ленты лежал третий кусочек бирки.',clueTitle:'Секрет мастерской',clueText:'Мы разобрались с поручениями мастерской. Я нашёл третий кусочек и добавил его к бирке. Остался один! — Снегирь.'},
  {title:'Станция саней',stamp:'Сани',discovery:'Из-под полоза выглянул четвёртый кусочек бирки. Теперь адрес можно собрать целиком!',clueTitle:'Маршрут восстановлен',clueText:'Все дела у саней закончены. Я соединил четыре кусочка — адресная бирка снова цела, маршрут можно продолжать! — Снегирь.'},
];
// The courier's lines refer to the work just done. Any mission can close its
// station, so finding the piece belongs to the station, not a particular puzzle.
const WINTER_NOTES = {
  'young-tags':['На этом письме вместо цифр нарисованы игрушки. Поможешь мне прочитать номер?','Теперь номер можно переписать в почтовую книгу.'],
  'young-house':['У меня письмо для дома с вывеской из двух картинок. Давай сверим вывески.','Письмо с картинками попало в нужный почтовый ящик.'],
  'young-stamps':['Кто-то оставил на конверте три следа. Похоже, это работа наших штампов!','Штампы нашлись. На конверте снова есть почтовый номер.'],
  'young-garland':['Слышишь звон? Пока я вешал гирлянду, одна игрушка соскользнула в снег.','Новая игрушка продолжает узор. Можно снова любоваться гирляндой.'],
  'young-shadow':['С фонарика на ветке свисает бирка с тёмным силуэтом. Какая игрушка здесь висела?','Колокольчик вернулся на ветку и тихонько звенит.'],
  'young-pack':['Я держу коробку крыльями. Командуй, что мне делать с лентой и открыткой!','Коробка закрыта, бант завязан, открытка держится крепко.'],
  'young-snowman':['У дверей мастерской три снежных кома. Давай слепим из них сторожа!','У дверей теперь стоит снеговик и встречает гостей.'],
  'young-card':['Посмотри, мастер оставил нам открытку и набор таких же наклеек. Сделаем пару?','Две открытки теперь одинаковые. Одну мастер отдаст оленям.'],
  'young-road':['Метель занесла стрелки у развилки. Хорошо, что на дороге ещё видны знаки!','Три звезды ведут в одну сторону. Укажем оленям эту дорогу.'],
  'young-delivery':['Олени готовы ехать, но домики на моей схеме перепутались. Поставишь их по порядку?','Я перенёс три дома на схему. Теперь возница знает, у кого остановиться первым.'],
  'middle-tags':['Мешок заперт. Я спрятал подсказку на бирках, пока снег не замёл цифры.','Замок щёлкнул. Можно достать письма и проверить адреса.'],
  'middle-houses':['Три письма выскользнули из сумки. Хорошо, что я зарисовал крыши и двери!','На каждом из трёх конвертов снова стоит номер дома.'],
  'middle-stamps':['У штемпельной машины стёрлось табло. Восстановим номер по оттискам на письме.','По оттискам удалось восстановить запись в журнале отправлений.'],
  'middle-garland':['Я нашёл почти целую гирлянду. Подвесим недостающую игрушку, пока не зажгли огни.','Игрушка на месте. Узор снова тянется по всей ветке.'],
  'middle-flake':['Снежинки рассыпались на снег. Среди них затесилась одна из соседней мастерской.','Лишнюю снежинку отложили для соседей. Остальные можно вешать на ёлку.'],
  'middle-pack':['Мастер уже уложил подарок в коробку и оставил нам три дела по упаковке.','Посылку можно переносить за дно. Открытка на ленте укажет, кому она предназначена.'],
  'middle-card':['Ветер унёс запасную открытку. У нас остался образец, по которому можно сделать новую.','Запасная открытка готова. Я положу её рядом с образцом.'],
  'middle-address':['Я учился чинить письма на этом конверте. Попробуешь восстановить тренировочный адрес?','Учебный конверт снова цел. Теперь мы знаем, как соединять обрывки по буквам.'],
  'middle-route':['На карте замело названия улиц. Проложим путь саней по клеткам и запишем ориентиры.','Три цифры переданы вознице. По ним он проверит каждый поворот.'],
  'middle-delivery':['Диспетчер запомнил только две приметы маршрута. Этого хватит, чтобы выстроить остановки.','В расписании снова стоят все три остановки по порядку.'],
  'older-sorter':['Номер на выходе читается, но в книге нужен исходный. Пора проверить машину задом наперёд.','Исходный номер вернулся в книгу. Он совпал с номером отправления.'],
  'older-stencil':['Нашёл две ледяные решётки и табличку под ними. Сквозь отверстия можно прочитать номер.','Скрытый номер проступил сквозь лёд. Я занёс его в реестр.'],
  'older-bags':['На почту прислали три мешка с неверными ярлыками. Проверить разрешили только одну игрушку.','Одной проверки хватит, чтобы подписать все мешки заново.'],
  'older-lights':['Я дёрнул одну цепочку, а мигнули сразу две лампы. Помоги разобраться с выключателями.','Все три лампы горят. Их свет достигает даже нижних веток.'],
  'older-fold':['У меня есть сложенная бумага и дырокол. Угадаешь рисунок до того, как я разверну лист?','Я развернул лист. Четыре отверстия сложились в предсказанный узор.'],
  'older-load':['Весы на погрузочной площадке готовы. Подберём груз для этой пары саней.','Обе посылки взвешены и уложены. Весы показывают нужный вес.'],
  'older-cube':['Мастер напечатал узор на плоском картоне. Проверим, какие рисунки сойдутся на коробке.','Угол коробки сложился как задумано. Теперь мастер может склеить края.'],
  'older-card':['После метели остался только образец открытки. Восстановим порядок слоёв по перекрытиям.','Все четыре слоя на своих местах, до самого верхнего банта.'],
  'older-gates':['У трёх дорог стоят грузовые ворота. Продумай рейсы так, чтобы ни разу не пришлось разворачиваться перед ними.','Возница проверил груз для каждого рейса. Теперь все нужные ворота откроются.'],
  'older-midnight':['Путь начнётся в старом году, а закончится уже в новом. Какое время передать встречающим?','Время прибытия отправлено встречающим. Они выйдут к саням вовремя.'],
};
function winterTask(stage,id,title,prompt,answer,choices,hint,explanation,visual,interaction,choiceArt){
  const [story,reward]=WINTER_NOTES[id.slice('snow-'.length)];
  return {...puzzle(id,title,prompt,answer,choices,hint,explanation),station:{index:stage,...WINTER_STATIONS[stage],story,reward},visual,...(interaction?{interaction}:{}),...(choiceArt?{choiceArt}:{})};
}
const toy = (kind,label,extra={}) => ({kind,label,...extra});
const codeTask = (answer) => ({type:'code',answer:String(answer),length:String(answer).length,alphabet:'0123456789'});
const orderTask = (items,answer) => ({type:'order',items,answer,count:answer.length});
function ornamentCode(r,young){
  const digits=shuffle(['2','3','5','7','8','9'],r).slice(0,4);
  const kinds=[toy('star','Звезда'),toy('bell','Колокольчик'),toy('mitten','Варежка'),toy('ball','Шар')];
  const order=shuffle([0,1,2],r),answer=order.map(i=>digits[i]).join('');
  const legends=kinds.map((item,i)=>({...item,value:digits[i]}));
  return winterTask(0,young?'snow-young-tags':'snow-middle-tags',young?'Бирки с ёлки':'Замок почтового мешка',`Каждая игрушка заменяет одну цифру. ${young?'Игрушки на письме потеряли цвет, но сохранили форму.':'Снегирь запер мешок кодом из игрушек.'} Рассмотри бирки и набери код для нижнего ряда слева направо.`,answer,[answer,answer.split('').reverse().join(''),digits[3]+answer.slice(1),answer.slice(0,2)+digits[3]],'Сначала найди первую игрушку на бирках. Запиши её цифру, затем переходи к следующей.',`Нужные бирки по порядку: ${order.map(i=>`${kinds[i].label.toLowerCase()} — ${digits[i]}`).join(', ')}. Код: ${answer}.`,{type:'legend',items:legends,target:order.map(i=>({...kinds[i],silhouette:young}))},codeTask(answer));
}
function parcelOrder(r,young){
  const items=[toy('gift','Закрыть коробку',{id:'box'}),toy('ribbon','Завязать ленту',{id:'ribbon'}),toy('card','Прикрепить открытку',{id:'card'})];
  return winterTask(2,young?'snow-young-pack':'snow-middle-pack','Последняя посылка','Открытку крепят к уже завязанной ленте. Ленту завязывают только на закрытой коробке. Нажимай на действия в том порядке, в котором нужно упаковать подарок.','Коробка → лента → открытка',['Коробка → лента → открытка','Лента → коробка → открытка','Открытка → лента → коробка'],'Подумай, что должно быть готово, прежде чем можно завязать ленту.','Сначала закрываем коробку, затем завязываем ленту, а уже к ней прикрепляем открытку.',{type:'parcel'},orderTask(shuffle(items,r),['box','ribbon','card']));
}
function houseLetters(r,young){
  if(young){
    const houses=shuffle([
      {id:'a',label:'Дом А',symbols:['tree','star']},{id:'b',label:'Дом Б',symbols:['tree','bell']},
      {id:'v',label:'Дом В',symbols:['bell','tree']},{id:'g',label:'Дом Г',symbols:['star','bell']},
    ],r);
    return winterTask(0,'snow-young-house','Кому это письмо?','Вместо адреса на конверте две картинки: сначала ёлка, потом колокольчик. Выбери дом с точно такими же картинками в таком же порядке.','Дом Б',houses.map(h=>h.label),'Порядок важен: ёлка должна быть слева, а колокольчик справа.','У дома Б сначала ёлка, затем колокольчик — точно как на конверте.',{type:'envelope',symbols:['tree','bell']},null,Object.fromEntries(houses.map(h=>[h.label,{kind:'house',label:h.label,symbols:h.symbols}])));
  }
  const houses=[{kind:'house',label:'Дом 1',number:'1',roof:'star',door:'round'},{kind:'house',label:'Дом 2',number:'2',roof:'moon',door:'square'},{kind:'house',label:'Дом 3',number:'3',roof:'star',door:'square'}];
  return winterTask(0,'snow-middle-houses','Три письма без адресов','Снегирь записал приметы домов. Письмо 1: квадратная дверь, на крыше не звезда. Письмо 2: звезда на крыше, дверь не круглая. Письмо 3: круглая дверь. Введи номера домов по порядку писем.','231',['231','321','213','132'],'Сначала найди единственный дом с луной. Потом из двух домов со звездой выбери нужную дверь.','Первое письмо — дому 2 с луной. Второе — дому 3 с квадратной дверью и звездой. Третье — дому 1 с круглой дверью. Код 231.',{type:'row',items:houses},codeTask('231'));
}
function ribbonCode(r,young){
  const items=[toy('tree','Ёлка',{value:'4'}),toy('star','Звезда',{value:'7'}),toy('bell','Колокольчик',{value:'2'})];
  const target=shuffle(items,r),answer=target.map(t=>t.value).join('');
  return winterTask(0,young?'snow-young-stamps':'snow-middle-stamps','Оттиски на конверте','На письме остались три оттиска. У каждого штампа свой номер. Набери номера штампов в том порядке, в котором стоят оттиски на письме.',answer,[answer,answer.slice(1)+answer[0],answer[2]+answer.slice(0,2),answer[1]+answer[0]+answer[2]],'Сопоставь каждый оттиск со штампом такой же формы. Цвет здесь не нужен.',`Слева направо: ${target.map(t=>`${t.label.toLowerCase()} — ${t.value}`).join(', ')}. Получается ${answer}.`,{type:'legend',items,target:target.map(t=>({...t,silhouette:true}))},codeTask(answer));
}
function garland(r,young){
  const a=toy('ball','Шар в полоску',{pattern:'stripe',color:'red'}),b=toy('star','Золотая звезда',{color:'gold'}),c=toy('bell','Синий колокольчик',{color:'blue'});
  const unit=young?[a,b]:[a,b,c],row=[...unit,...unit,...unit.slice(0,-1)],answer=unit.at(-1);
  return winterTask(1,young?'snow-young-garland':'snow-middle-garland','Потерянная игрушка','Снегирь украшал ёлку одним и тем же узором. В конце гирлянды не хватает игрушки. Какую нужно повесить на свободное место?',answer.label,[a.label,b.label,c.label,'Зелёная варежка'],'Начни слева и найди короткий кусочек, который повторяется целиком.',`Узор повторяется: ${unit.map(t=>t.label.toLowerCase()).join(', ')}. На пустом месте должна быть ${answer.label.toLowerCase()}.`,{type:'garland',items:row},null,Object.fromEntries([...unit,c,toy('mitten','Зелёная варежка',{color:'green'})].map(t=>[t.label,t])));
}
function shadowTask(r,young){
  const variants=shuffle([toy('mitten','Варежка с одной звездой',{pattern:'star'}),toy('mitten','Варежка в полоску',{pattern:'stripe'}),toy('bell','Колокольчик'),toy('ball','Шар со звездой',{pattern:'star'})],r);
  if(young)return winterTask(1,'snow-young-shadow','Игрушка и её тень','На ёлке осталось пустое место. Здесь висела игрушка, чья тень нарисована на бирке. Найди такую же форму.','Колокольчик',variants.map(t=>t.label),'Смотри на внешний край: сверху маленькая петелька, снизу широкий раструб.','Тень расширяется книзу, а под краем виден язычок. Это колокольчик.',{type:'shadow',item:toy('bell','Тень колокольчика',{silhouette:true})},null,Object.fromEntries(variants.map(t=>[t.label,t])));
  const correct=toy('flake','Снежинка Б',{spokes:5}),items=[toy('flake','Снежинка А',{spokes:6}),correct,toy('flake','Снежинка В',{spokes:6}),toy('flake','Снежинка Г',{spokes:6})];
  return winterTask(1,'snow-middle-flake','Чужая снежинка','Мастерская делает снежинки с шестью лучами. Снегирь случайно принёс одну из другой коробки. Найди снежинку, у которой не шесть лучей.',correct.label,items.map(t=>t.label),'Удобно считать длинные лучи от центра по кругу. Маленькие веточки на них — не отдельные лучи.','У снежинки Б пять длинных лучей. У остальных — по шесть.',{type:'none'},null,Object.fromEntries(items.map(t=>[t.label,t])));
}
function snowmanOrder(r){
  const items=[toy('snowball','Большой ком',{id:'big',size:1}),toy('snowball','Средний ком',{id:'middle',size:.73}),toy('snowball','Маленький ком',{id:'small',size:.48})];
  return winterTask(2,'snow-young-snowman','Снеговик у мастерской','Выстрой снежные комья снизу вверх: первым выбери самый большой, а последним — самый маленький. Тогда снеговик будет устойчивым.','Большой → средний → маленький',['Большой → средний → маленький','Маленький → средний → большой','Средний → большой → маленький'],'Внизу нужна самая широкая опора. Каждый следующий ком меньше предыдущего.','Большой ком — внизу, средний — на нём, маленький — голова. Снеговик готов!',{type:'snowman'},orderTask(shuffle(items,r),['big','middle','small']));
}
function stickerOrder(r,young){
  const items=[toy('flake','Снежинка',{id:'flake'}),toy('tree','Ёлка',{id:'tree'}),toy('gift','Подарок',{id:'gift'})];
  return winterTask(2,young?'snow-young-card':'snow-middle-card','Открытка из наклеек','Снегирь хочет повторить открытку. Ёлка закрывает часть снежинки, а подарок закрывает нижние ветки ёлки. Выбери наклейки в порядке от первой до последней.','Снежинка → ёлка → подарок',['Снежинка → ёлка → подарок','Ёлка → снежинка → подарок','Подарок → ёлка → снежинка'],'Нижнюю наклейку приклеили первой. Сверху на неё уже наклеивали остальные.','Сначала приклеили снежинку. Поверх неё — ёлку. Последним приклеили подарок, поэтому он закрывает ветки.',{type:'layers'},orderTask(shuffle(items,r),['flake','tree','gift']));
}
function sleighRoad(r,young){
  if(young){
    const options=[{label:'Дорога А',symbols:['star','star','star']},{label:'Дорога Б',symbols:['star','bell','star']},{label:'Дорога В',symbols:['tree','star','tree']}];
    return winterTask(3,'snow-young-road','Звёздная дорога','Почтовые сани едут по дороге, на которой все три знака — звёзды. Выбери дорогу для Снегиря.','Дорога А',options.map(x=>x.label),'Проверь все знаки на каждой дороге. Одной звезды недостаточно.','На дороге А три звезды. На других есть колокольчик или ёлки.',{type:'sleigh'},null,Object.fromEntries(options.map(x=>[x.label,{kind:'symbols',symbols:x.symbols,label:x.label}])));
  }
  return winterTask(3,'snow-middle-route','Повороты над городом','Сани начинают в клетке «СТАРТ» и смотрят вверх. Пролети одну клетку вперёд. Поверни направо и пролети ещё одну клетку. Теперь поверни налево и пролети ещё одну клетку. Введи цифры трёх клеток, в которых остановился.','472',['472','478','875','498'],'Первый шаг — к 4. После поворота направо сани смотрят вправо. Налево от этого направления — вверх.','Из старта летим вверх к 4, вправо к 7, затем вверх к 2. Повороты считаются относительно саней. Код 472.',{type:'grid',columns:3,cells:['9','2','6','4','7','3','СТАРТ ↑','8','5']},codeTask('472'));
}
function deliveryOrder(r,young){
  const items=[toy('house','Дом А',{id:'a',number:'А'}),toy('house','Дом Б',{id:'b',number:'Б'}),toy('house','Дом В',{id:'v',number:'В'})];
  return winterTask(3,young?'snow-young-delivery':'snow-middle-delivery','Кто получит подарок первым?',young?'Подарок дому Б нужно доставить раньше, чем дому А. Дом В — последний в маршруте. Нажми на дома в порядке доставки.':'Сани должны закончить у дома В. К дому А можно попасть только после доставки в дом Б. Расставь дома по порядку.', 'Б → А → В',['Б → А → В','А → Б → В','В → Б → А'],'Сначала найди последний дом. Из двух оставшихся один должен идти раньше другого.','Дом В — последний. Дом Б должен быть раньше А. Поэтому маршрут: Б, А, В.',{type:'sleigh'},orderTask(shuffle(items,r),['b','a','v']));
}
function olderSorter(r){
  const initial=shuffle(['2','4','6','8','9'],r).slice(0,3),output=[initial[1],initial[2],initial[0]],answer=initial.join('');
  return winterTask(0,'snow-older-sorter','Сбой снежного сортировщика','Машина сначала меняет местами первую и последнюю цифры, а потом — первые две. На выходе получился номер на табло. Какой номер был на посылке до машины?',answer,[answer,output.join(''),initial[0]+initial[2]+initial[1],initial[1]+initial[0]+initial[2]],'Отмени действия в обратном порядке: сначала поменяй первые две цифры на табло, затем — крайние.',`Начальный номер ${answer}. После обмена крайних: ${[initial[2],initial[1],initial[0]].join('')}. После обмена первых двух: ${output.join('')}.`,{type:'sorter',output:output.join('')},codeTask(answer));
}
function olderStencil(){
  return winterTask(0,'snow-older-stencil','Адрес под ледяными решётками','На табличку накладывают две решётки. Обе стрелки должны смотреть вверх: вторую решётку сначала поверни на пол-оборота. Читай цифры только в тех клетках, где отверстия совпадут, сверху вниз, а в строке — слева направо.','835',['835','825','853','385'],'После поворота отверстия второй решётки окажутся в клетках 1, 3, 4, 7 и 9. Теперь сравни их с первой.','У обеих решёток открыты клетки 1, 4 и 9. На табличке там стоят 8, 3 и 5. Код 835.',{type:'stencils',cells:['8','1','6','3','7','2','9','4','5'],masks:[[0,1,3,5,8],[0,2,5,6,8]]},codeTask('835'));
}
function olderBags(){
  const items=[toy('bag','«Только шары»',{id:'balls'}),toy('bag','«Только звёзды»',{id:'stars'}),toy('bag','«Шары и звёзды»',{id:'mixed'})];
  return winterTask(0,'snow-older-bags','Все ярлыки перепутаны','В одном мешке только шары, в другом только звёзды, в третьем — и шары, и звёзды. Все три ярлыка неверны. Из какого мешка нужно достать одну игрушку, не глядя, чтобы затем определить содержимое всех мешков?','«Шары и звёзды»',items.map(t=>t.label),'Мешок с надписью «Шары и звёзды» точно не смешанный. Одна игрушка полностью раскроет его содержимое.','Если из мешка «Шары и звёзды» вынуть шар, весь мешок с шарами. Оставшиеся мешки определяются по неверным ярлыкам. Со звездой рассуждение такое же.',{type:'none'},null,Object.fromEntries(items.map(t=>[t.label,t])));
}
function olderLights(r){
  const masks=[[0,1],[1,2],[0,1,2]],answer=['a','c'];
  return winterTask(1,'snow-older-lights','Капризная гирлянда','Кнопка А переключает левую и среднюю лампы. Б — среднюю и правую. В — все три. При нажатии горящая лампа гаснет, погасшая загорается. Вначале горят две левые. Включи все три лампы и нажми «Проверить».','А и В',['А и В','А и Б','Только В','Б и В'],'Кнопка В даёт нужный свет справа, но гасит две левые лампы. Какая кнопка вернёт их обратно?','Нажимаем А: обе левые лампы гаснут. Нажимаем В: загораются все три. Порядок этих двух нажатий можно поменять.',{type:'none'},{type:'switches',items:[{id:'a',label:'А',mask:masks[0]},{id:'b',label:'Б',mask:masks[1]},{id:'c',label:'В',mask:masks[2]}],initial:[true,true,false],answer,count:3});
}
function olderFold(){
  const variants={
    'Узор А':{kind:'holes',cells:[1,2,13,14],label:'Узор А'},'Узор Б':{kind:'holes',cells:[0,3,12,15],label:'Узор Б'},
    'Узор В':{kind:'holes',cells:[5,6,9,10],label:'Узор В'},'Узор Г':{kind:'holes',cells:[4,7,8,11],label:'Узор Г'},
  };
  return winterTask(1,'snow-older-fold','Бумажная снежинка','Квадрат 4 × 4 сложили пополам слева направо, затем снизу вверх. В получившемся квадрате 2 × 2 сделали одно отверстие в центре верхней левой клетки. Каким станет лист, когда его развернут?','Узор А',Object.keys(variants),'При развороте каждый сгиб отражает отверстие как зеркало. Отверстий будет четыре.','Отверстия окажутся во 2-й и 3-й клетках верхней строки и во 2-й и 3-й клетках нижней строки.',{type:'fold'},null,variants);
}
function olderLoad(r){
  const items=[toy('gift','Посылка 2 кг',{id:'two',value:'2 кг',color:'red'}),toy('gift','Посылка 3 кг',{id:'three',value:'3 кг',color:'blue'}),toy('gift','Посылка 5 кг',{id:'five',value:'5 кг',color:'green'}),toy('gift','Посылка 8 кг',{id:'eight',value:'8 кг',color:'gold'})];
  return winterTask(2,'snow-older-load','Ровно две посылки','В маленькие сани помещаются ровно две посылки. Вместе они должны весить ровно 10 кг. Отметь две подходящие посылки и проверь загрузку.','2 кг и 8 кг',['2 кг и 8 кг','3 кг и 5 кг','2 кг и 5 кг','3 кг и 8 кг'],'Проверь пары. Нельзя взять одну посылку или набрать 10 кг тремя посылками.','Единственная подходящая пара — 2 кг и 8 кг. Вместе ровно 10 кг.',{type:'sleigh'},{type:'pick',items:shuffle(items,r),answer:['two','eight'],count:2});
}
function olderCube(){
  const sets=[{label:'Звезда, ёлка, колокольчик',symbols:['star','tree','bell']},{label:'Звезда, подарок, ёлка',symbols:['star','gift','tree']},{label:'Варежка, колокольчик, снеговик',symbols:['mitten','bell','snowman']},{label:'Ёлка, снеговик, подарок',symbols:['tree','snowman','gift']}];
  return winterTask(2,'snow-older-cube','Коробка с шестью наклейками','Из этой развёртки складывают куб. Какие три рисунка могут встретиться у одного угла коробки?',sets[0].label,sets.map(x=>x.label),'У одного угла не могут встретиться противоположные грани. Мысленно подними четыре боковые стенки.','Противоположны: варежка и колокольчик, ёлка и снеговик, звезда и подарок. Звезда, ёлка и колокольчик могут встретиться у одного угла.',{type:'cube'},null,Object.fromEntries(sets.map(x=>[x.label,{kind:'symbols',...x}])));
}
function olderCard(r){
  const items=[toy('flake','Снежинка',{id:'flake'}),toy('tree','Ёлка',{id:'tree'}),toy('gift','Подарок',{id:'gift'}),toy('ribbon','Лента',{id:'ribbon'})];
  return winterTask(2,'snow-older-card','Четыре слоя открытки','Подарок закрывает нижние ветви ёлки. Лента закрывает угол подарка. Ёлка закрывает часть снежинки. Расставь слои от самого нижнего до самого верхнего.','Снежинка → ёлка → подарок → лента',['Снежинка → ёлка → подарок → лента','Ёлка → снежинка → лента → подарок','Лента → подарок → ёлка → снежинка'],'Каждое «закрывает» означает, что эта деталь лежит выше другой. Собери все три условия в одну цепочку.','Снежинка внизу, над ней ёлка, затем подарок, а поверх подарка — лента.',{type:'layers',ribbon:true},orderTask(shuffle(items,r),['flake','tree','gift','ribbon']));
}
function olderGates(r){
  const items=['a','b','v'].map((id,i)=>toy('house',`Дом ${'АБВ'[i]}`,{id,number:'АБВ'[i]}));
  return winterTask(3,'snow-older-gates','Сани не проходят!','На санях подарки для домов А, Б и В. Дорога к А не пропускает сани с подарком Б, а дорога к В — с подарком А. К Б дорога свободна. После каждой доставки сани возвращаются на станцию. Оставлять недоставленные подарки на станции нельзя. В каком порядке ехать?', 'Б → А → В',['Б → А → В','А → Б → В','Б → В → А','В → А → Б'],'Чтобы проехать к А, сначала избавься от подарка Б. Чтобы проехать к В — от подарка А.','Сначала доставляем Б. После этого можно проехать к А. Когда А доставлен, дорога к В тоже открыта.',{type:'gates'},orderTask(shuffle(items,r),['b','a','v']));
}
function olderMidnight(r){
  const minute=integer(r,40,55),duration=integer(r,5,7)*5,end=23*60+minute+duration,answer=clock(end%1440).replace(':','');
  return winterTask(3,'snow-older-midnight','Доставка после полуночи',`Сани вылетают 31 декабря в 23:${minute}. Полёт занимает ${duration} минут без остановок. Введи время прибытия четырьмя цифрами по 24-часовым часам: например, 00:07 записывается как 0007.`,answer,[answer,clock((end+60)%1440).replace(':',''),clock((end+10)%1440).replace(':',''),clock((end-10)%1440).replace(':','')],`До полуночи остаётся ${60-minute} минут. Остаток полёта пройдёт уже 1 января.`,`23:${minute} + ${duration} минут = ${clock(end%1440)}. Четыре цифры времени: ${answer}.`,{type:'clock',start:`23:${minute}`,duration},codeTask(answer));
}
function tornAddress(r){
  const items=[{id:'start',kind:'card',label:'СНЕ'},{id:'middle',kind:'card',label:'ЖНЫЙ ПРО'},{id:'end',kind:'card',label:'ЕЗД, 7'}];
  return winterTask(2,'snow-middle-address','Разорванный адрес','Ветер разорвал адрес на учебном письме Снегиря. Собери части так, чтобы получилось название улицы и номер дома. Нажимай на обрывки по порядку.','СНЕ → ЖНЫЙ ПРО → ЕЗД, 7',['СНЕ → ЖНЫЙ ПРО → ЕЗД, 7','ЖНЫЙ ПРО → СНЕ → ЕЗД, 7','ЕЗД, 7 → СНЕ → ЖНЫЙ ПРО'],'Первый обрывок начинает слово «снежный». Название улицы заканчивается словом «проезд».','Получается адрес: СНЕЖНЫЙ ПРОЕЗД, 7. Начало — «СНЕ», затем «ЖНЫЙ ПРО», в конце «ЕЗД, 7».',{type:'torn'},orderTask(shuffle(items,r),['start','middle','end']));
}
const WINTER_BANKS={
  '5-7':[
    [(r)=>ornamentCode(r,true),(r)=>houseLetters(r,true),(r)=>ribbonCode(r,true)],
    [(r)=>garland(r,true),(r)=>shadowTask(r,true)],
    [(r)=>parcelOrder(r,true),snowmanOrder,(r)=>stickerOrder(r,true)],
    [(r)=>sleighRoad(r,true),(r)=>deliveryOrder(r,true)],
  ],
  '8-10':[
    [(r)=>ornamentCode(r,false),(r)=>houseLetters(r,false),(r)=>ribbonCode(r,false)],
    [(r)=>garland(r,false),(r)=>shadowTask(r,false)],
    [(r)=>parcelOrder(r,false),(r)=>stickerOrder(r,false),tornAddress],
    [(r)=>sleighRoad(r,false),(r)=>deliveryOrder(r,false)],
  ],
  '11-13':[
    [olderSorter,olderStencil,olderBags],
    [olderLights,olderFold],
    [olderLoad,olderCube,olderCard],
    [olderGates,olderMidnight],
  ],
};
function winterMakers(age,count,random){
  const perStation=Array(4).fill(1);
  const extras=shuffle([0,1,2,3],random);
  for(let i=0;i<count-4;i++)perStation[extras[i]]++;
  return WINTER_BANKS[age].flatMap((makers,index)=>{
    const total=perStation[index];
    return shuffle(makers,random).slice(0,total).map((make,offset)=>(...args)=>{
      const mission=make(...args);
      const {discovery,...station}=mission.station;
      const step=offset+1;
      const isLast=step===total;
      mission.station={...station,step,total,isLast,fragment:isLast?index+1:null,
        reward:isLast?`${station.reward} ${discovery}`:station.reward};
      return mission;
    });
  });
}

function stableHash(value) {
  const bytes = new TextEncoder().encode(value);
  let first = 0x811c9dc5, second = 0x9e3779b9;
  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 0x01000193) >>> 0;
    second = Math.imul(second ^ byte, 0x85ebca6b) >>> 0;
  }
  return first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
}

/** Puzzles contain no DOM, storage, network calls, or mutable shared game state. */
export function createQuest(input) {
  const config = validateConfig(input);
  const random = randomSource(config.seed);
  const holiday=config.edition===3&&config.theme==='winter';
  const makers = holiday ? winterMakers(config.age,config.route.length,random) : config.edition >= 2 ? editionTwoMakers(config.age, config.route.length, random) : shuffle(BANKS[config.age], random).slice(0, config.route.length);
  const missions = makers.map((make, index) => {
    const { answer, ...content } = make(random, config.theme);
    const choices = shuffle(content.choices, random);
    return Object.freeze({ ...content, choices: Object.freeze(choices), answerIndex: choices.indexOf(answer), locationId: config.route[index] });
  });
  const intro = holiday
    ? `${config.name}, это Снегирь, дежурный новогодней почты! Ветер сорвал адресную бирку с твоего подарка, разорвал её и разметал кусочки по новогодней почте. На каждой из четырёх станций спрятался один кусочек. Когда соберём все четыре, узнаем, куда доставили твой подарок!`
    : config.mode === 'screen'
    ? `${config.name}, ${config.theme === 'winter' ? 'новогодняя почта' : 'секретная экспедиция'} приготовила для тебя ${counted(missions.length, 'загадку', 'загадки', 'загадок')}. Решай их по очереди в браузере. После последней загадки ты узнаешь, где спрятан подарок!`
    : config.theme === 'winter'
      ? `${config.name}, новогодняя почта приготовила для тебя ${counted(missions.length, 'загадку', 'загадки', 'загадок')}. Разгадывай их по очереди: каждая откроет следующий домашний тайник. В последнем ждёт подарок!`
      : `${config.name}, секретная экспедиция начинается! Впереди ${counted(missions.length, 'загадка', 'загадки', 'загадок')} и домашние тайники. Решай задания по очереди — последнее приведёт к подарку.`;
  const ending = holiday ? `${config.name}, адрес восстановлен, сани добрались, а подарок нашёл своего хозяина! Спасибо за помощь новогодней почте. Твой друг Снегирь. С Новым годом!` : config.theme === 'winter'
    ? `${config.name}, новогоднее приключение завершено! Все загадки разгаданы, а подарок найден. С Новым годом!`
    : `${config.name}, экспедиция завершена! Все загадки разгаданы, а подарок найден.`;
  return Object.freeze({ config, id: `quest-${stableHash(JSON.stringify(config))}`, missions: Object.freeze(missions), intro, ending });
}
