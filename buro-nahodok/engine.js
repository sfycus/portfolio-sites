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
  { id: '5-7', title: '5–7 лет', description: 'Простой счёт, цвета и внимательность. Взрослый может читать задания вслух.' },
  { id: '8-10', title: '8–10 лет', description: 'Счёт, короткие шифры и логические цепочки.' },
  { id: '11-13', title: '11–13 лет', description: 'Доли, закономерности и задачи в несколько действий.' },
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
  if (edition !== undefined && edition !== 2) throw new Error('Этот набор загадок не поддерживается. Создайте новый квест.');
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
  return Object.freeze({ v: 1, name, age, theme, route: Object.freeze(route), seed, giftNote, ...(mode === 'screen' ? { mode } : {}), ...(edition === 2 ? { edition } : {}) });
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
  const makers = config.edition === 2 ? editionTwoMakers(config.age, config.route.length, random) : shuffle(BANKS[config.age], random).slice(0, config.route.length);
  const missions = makers.map((make, index) => {
    const { answer, ...content } = make(random, config.theme);
    const choices = shuffle(content.choices, random);
    return Object.freeze({ ...content, choices: Object.freeze(choices), answerIndex: choices.indexOf(answer), locationId: config.route[index] });
  });
  const intro = config.mode === 'screen'
    ? `${config.name}, ${config.theme === 'winter' ? 'новогодняя почта' : 'секретная экспедиция'} приготовила для тебя ${counted(missions.length, 'загадку', 'загадки', 'загадок')}. Решай их по очереди в браузере. После последней загадки ты узнаешь, где спрятан подарок!`
    : config.theme === 'winter'
      ? `${config.name}, новогодняя почта приготовила для тебя ${counted(missions.length, 'загадку', 'загадки', 'загадок')}. Разгадывай их по очереди: каждая откроет следующий домашний тайник. В последнем ждёт подарок!`
      : `${config.name}, секретная экспедиция начинается! Впереди ${counted(missions.length, 'загадка', 'загадки', 'загадок')} и домашние тайники. Решай задания по очереди — последнее приведёт к подарку.`;
  const ending = config.theme === 'winter'
    ? `${config.name}, новогоднее приключение завершено! Все загадки разгаданы, а подарок найден. С Новым годом!`
    : `${config.name}, экспедиция завершена! Все загадки разгаданы, а подарок найден.`;
  return Object.freeze({ config, id: `quest-${stableHash(JSON.stringify(config))}`, missions: Object.freeze(missions), intro, ending });
}
