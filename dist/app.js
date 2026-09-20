const $ = selector => document.querySelector(selector);
const normalize = value => value.normalize('NFKC').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
const entryCode = normalize;
const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const storageKey = 'between-us-quest-v2';
const stages = ['welcome', 'intro', 'joke', 'joke-result', 'dudka', 'dudka-result', 'park', 'park-result', 'uno-find', 'uno', 'number', 'uno-result', 'champion-intro', 'clues', 'champion', 'champion-result', 'wait'];
let content, decryptionKey, audioUrl, player, sceneController, revealTimer, active = false;
let audioLoad, savedAvailable = true;
let progress = { stage: 'welcome', heard: false, shield: false, firstGuess: false, office: false, jokeDone: false, dudkaDone: false, parkDone: false, unoDone: false, leonaDone: false };
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && stages.includes(saved.stage)) {
    progress.stage = saved.stage;
    if (stages.includes(saved.returnAfterUno)) progress.returnAfterUno = saved.returnAfterUno;
    for (const key of ['heard', 'shield', 'firstGuess', 'office', 'jokeDone', 'dudkaDone', 'parkDone', 'unoDone', 'leonaDone']) progress[key] = saved[key] === true;
  }
} catch { savedAvailable = false; }
if (!progress.unoDone && stages.indexOf(progress.stage) >= stages.indexOf('champion-intro')) {
  progress.returnAfterUno = progress.stage;
  progress.stage = 'uno-find';
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(progress)); }
  catch { savedAvailable = false; }
  $('#save-note').textContent = savedAvailable ? 'Твоё место в истории сохранится в этом браузере.' : 'Браузер не разрешил сохранить прогресс. Пока не закрывай эту вкладку.';
}
function go(stage) { progress.stage = stage; save(); render(); }
function listen(selector, event, handler) {
  const element = $(selector);
  if (element) element.addEventListener(event, handler, { signal: sceneController.signal });
}
function stars() {
  const names = ['Твой смех', 'Одна мысль', 'Та самая пауза', 'Твой ход', 'Эмоджинариум', 'Вместе'];
  const states = [progress.jokeDone, progress.dudkaDone, progress.parkDone, progress.unoDone, progress.leonaDone, false];
  $('.star-track').innerHTML = names.map((name, i) => `<li class="${states[i] ? 'lit' : ''}"><span aria-hidden="true">✦</span><span>${name}</span><span class="sr-only">${states[i] ? ' — зажжена' : ' — ещё впереди'}</span></li>`).join('');
}
function frame(eyebrow, title, body) {
  $('#chapter-label').textContent = eyebrow;
  $('#scene').innerHTML = `<p class="eyebrow scene-eyebrow">${eyebrow}</p><h2 id="scene-title">${title}</h2>${body}`;
  $('#scene').classList.remove('scene-enter');
  void $('#scene').offsetWidth;
  $('#scene').classList.add('scene-enter');
  $('#scene').focus({ preventScroll: true });
}
const button = (id, text, secondary = false) => `<button id="${id}" type="button" class="${secondary ? 'secondary' : 'primary'}">${text}</button>`;
function answerForm(label, placeholder, submitText = 'Продолжить') {
  return `<form id="answer-form" class="answer-form"><label for="answer">${label}</label><input id="answer" class="answer-input" placeholder="${placeholder}" autocomplete="off" spellcheck="false" maxlength="100" required aria-describedby="answer-feedback"><button class="primary" type="submit">${submitText}<span aria-hidden="true">↗</span></button><p id="answer-feedback" class="feedback" role="status"></p></form>`;
}
function checkAnswer(type, success) {
  listen('#answer-form', 'submit', event => {
    event.preventDefault();
    if (content.answers[type].includes(normalize($('#answer').value))) success();
    else { $('#answer-feedback').textContent = 'Пока не то. Не торопись — ты знаешь ответ.'; $('#answer').setAttribute('aria-invalid', 'true'); }
  });
}
function finishJoke(heard) {
  if (player) { player.pause(); player.removeAttribute('src'); player.load(); player = null; }
  progress.heard = heard; progress.jokeDone = true; go('joke-result');
}
async function loadAudio() {
  if (audioUrl) return audioUrl;
  if (audioLoad) return audioLoad;
  const key = decryptionKey;
  audioLoad = (async () => {
    const response = await fetch('./voice.bin');
    if (!response.ok) throw new Error('audio load failed');
    const buffer = new Uint8Array(await response.arrayBuffer());
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buffer.slice(0, 12) }, key, buffer.slice(12));
    const url = URL.createObjectURL(new Blob([data], { type: 'audio/mpeg' }));
    if (!active) { URL.revokeObjectURL(url); throw new Error('closed'); }
    audioUrl = url; return url;
  })();
  try { return await audioLoad; } finally { audioLoad = null; }
}
function render() {
  clearTimeout(revealTimer);
  sceneController?.abort(); sceneController = new AbortController();
  if (player) { player.pause(); player = null; }
  stars();
  const stage = progress.stage;
  if (stage === 'welcome') {
    frame('ТЫ НАШЛА КЛЮЧ', 'Угуууу', `<p class="scene-copy">Я ждал именно тебя.</p>${button('next', 'Я здесь')}`);
    listen('#next', 'click', () => go('intro'));
  } else if (stage === 'intro') {
    frame('МАЛЕНЬКАЯ ИСТОРИЯ', 'Между нами.', '<p class="scene-copy" id="invitation"></p><div class="magic-buttons">'+button('show', 'Ну показывай')+'<div id="magic-slot" hidden>'+button('real-show', 'Ну хочешь, я покажу')+'</div></div>');
    $('#invitation').textContent = content.invitation;
    listen('#show', 'click', () => {
      $('#show').disabled = true;
      revealTimer = setTimeout(() => { $('#magic-slot').hidden = false; $('#magic-slot').classList.add('magic-reveal'); $('#real-show').focus({ preventScroll: true }); }, 1000);
    });
    listen('#real-show', 'click', () => go('joke'));
  } else if (stage === 'joke') {
    frame('НО СНАЧАЛА…', 'Можно я расскажу<br>один анекдот?', `<p class="scene-copy">Устраивайся поудобнее. Это мой голос.</p><div id="joke-choices" class="choices">${button('yes-joke', 'Давай')}${button('suspect-joke', 'Я уже чувствую, к чему всё идёт', true)}</div><p id="audio-note" class="feedback" role="status"></p><div id="audio-area" hidden><div class="voice-card"><div class="voice-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><audio id="voice" controls preload="metadata"></audio></div>${button('stop-joke', 'Завали пиздак ❤️', true)}</div>`);
    const start = async suspect => {
      $('#yes-joke').disabled = true; $('#suspect-joke').disabled = true;
      $('#audio-note').textContent = 'Секунду, достаю анекдот…';
      try {
        const url = await loadAudio();
        if (!active || progress.stage !== 'joke') return;
        $('#joke-choices').hidden = true; $('#audio-area').hidden = false;
        $('#audio-note').textContent = suspect ? 'И всё равно останешься слушать.' : 'Ну всё, сама разрешила.';
        player = $('#voice'); player.src = url;
        listen('#voice', 'ended', () => finishJoke(true));
        listen('#voice', 'error', () => { $('#audio-note').textContent = 'Запись не загрузилась. Можно обновить страницу и попробовать ещё раз.'; });
        listen('#voice', 'play', () => $('.voice-bars')?.classList.add('playing'));
        listen('#voice', 'pause', () => $('.voice-bars')?.classList.remove('playing'));
        try { await player.play(); } catch { $('#audio-note').textContent = 'Нажми ▶ на записи, чтобы послушать.'; }
      } catch {
        if (active && progress.stage === 'joke') { $('#audio-note').textContent = 'Не получилось загрузить запись. Нажми ещё раз — попробуем снова.'; $('#yes-joke').disabled = false; $('#suspect-joke').disabled = false; }
      }
    };
    listen('#yes-joke', 'click', () => start(false));
    listen('#suspect-joke', 'click', () => start(true));
    listen('#stop-joke', 'click', () => finishJoke(false));
  } else if (stage === 'joke-result') {
    frame('ПЕРВАЯ ЗВЕЗДА', 'Можно начинать.', `<div class="earned-star" aria-hidden="true">✦</div>${progress.heard ? '<p class="scene-copy">Дослушала целиком? Это подозрительно мило 🐄</p>' : ''}${button('next', 'Дальше')}`);
    listen('#next', 'click', () => go('dudka'));
  } else if (stage === 'dudka') {
    frame('ОДНА МЫСЛЬ НА ДВОИХ', 'Дудка?', '<p class="scene-copy">Иногда мне кажется, что у нас одна мысль на двоих.<br>И далеко не всегда умная.</p><form id="answer-form" class="answer-form inline-answer"><label for="answer">И мы с тобой как Дудка, блять, и…</label><input id="answer" class="answer-input" placeholder="…" autocomplete="off" spellcheck="false" maxlength="100" required aria-describedby="answer-feedback"><button class="primary" type="submit">Продолжить <span aria-hidden="true">↗</span></button><p id="answer-feedback" class="feedback" role="status"></p></form>');
    checkAnswer('dudka', () => { progress.dudkaDone = true; go('dudka-result'); });
  } else if (stage === 'dudka-result') {
    frame('ВТОРАЯ ЗВЕЗДА', 'Дудка и трубник.', '<p class="scene-copy">Иногда мы думаем об одном и том же.<br>А иногда очень часто, мне приятно от этого, словно мы как две половинки одной жопы))</p><div class="earned-star" aria-hidden="true">✦</div>'+button('next', 'Дальше'));
    listen('#next', 'click', () => go('park'));
  } else if (stage === 'park') {
    frame('ТА САМАЯ ПАУЗА', 'А ты знаешь…', '<p class="scene-copy">А ты знаешь, что Линкин Парк…<br><br>раньше хотели назвать…</p>'+answerForm('Ты знаешь продолжение', 'Закончишь за меня?'));
    checkAnswer('park', () => { progress.parkDone = true; go('park-result'); });
  } else if (stage === 'park-result') {
    frame('ЕЩЁ ОДНА ЗВЕЗДА', 'Можно и не договаривать.', '<p class="scene-copy">Всё равно нам обоим смешно.</p><div class="earned-star" aria-hidden="true">✦</div>'+button('next', 'Дальше'));
    listen('#next', 'click', () => go('uno-find'));
  } else if (stage === 'uno-find') {
    frame('ПРОДОЛЖЕНИЕ МЕЖДУ СТРАНИЦ', 'Твой ход.', '<p class="scene-copy">В одной подаренной мной истории есть вещи,<br>которые совсем не похожи на закладки.<br><br>Найди их. Сегодня твой ход.</p><p class="office-note">Понадобятся книга и карточки, которые я тебе подарил. Если их сейчас нет рядом, можно вернуться позже.</p>'+button('found', 'Нашла'));
    listen('#found', 'click', () => go('uno'));
  } else if (stage === 'uno') {
    frame('СЕГОДНЯ ПРАВИЛА НЕМНОГО НАШИ', 'Разложи перед собой.', '<p class="scene-copy">Солнце → огонь → все цвета → смена направления.</p><p class="scene-copy small-copy">Первые две карты — начало твоего кода.<br>Третья говорит, сколько к нему прибавить.<br>Последняя — с какой стороны прочитать результат.</p>'+answerForm('Твой ход', 'Какое число получилось?')+'<details><summary>Первая подсказка</summary><p>Первые две карты образуют одно двузначное число.</p><details><summary>Ещё подсказка</summary><p>Карта +4 здесь работает буквально: прибавь четыре.</p><details><summary>А что делает последняя?</summary><p>Карта возврата меняет порядок цифр в результате.</p></details></details></details>');
    checkAnswer('uno', () => go('number'));
  } else if (stage === 'number') {
    frame('МЫ УЖЕ ИГРАЛИ В ЧИСЛА', 'Чего-то не хватает.', '<p class="scene-copy">Всё правильно. Но кое-чего не хватает.<br><br>Мы уже играли с тобой в числа.<br>От одного до двух тысяч — помнишь, как долго ты искала то самое?</p><form id="answer-form" class="answer-form"><label for="answer">Вспомни последнюю цифру</label><div class="number-code"><span aria-hidden="true">64</span><input id="answer" aria-label="Последняя цифра числа 64_" aria-describedby="answer-feedback" type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" placeholder="_" autocomplete="off" required></div><button class="primary" type="submit">Это оно</button><p id="answer-feedback" class="feedback" role="status"></p></form>');
    checkAnswer('number', () => { progress.unoDone = true; go('uno-result'); });
  } else if (stage === 'uno-result') {
    frame('ТО САМОЕ ЧИСЛО', '640.', '<p class="scene-copy">В этот раз я хотя бы оставил подсказки.</p><div class="earned-star" aria-hidden="true">✦</div>'+button('next', 'Дальше'));
    listen('#next', 'click', () => { const next = progress.returnAfterUno || 'champion-intro'; delete progress.returnAfterUno; go(next); });
  } else if (stage === 'champion-intro') {
    frame('НАШЕ ОБЫЧНОЕ ДЕЛО', 'Кто же это?', '<p class="scene-copy">Ну что, ещё одну?<br>В этот раз действительно одну.</p>'+button('next', 'Угуууу'));
    listen('#next', 'click', () => go('clues'));
  } else if (stage === 'clues') {
    frame('ТРИ ЗНАКА · ОДИН ЧЕМПИОН', 'Кто же это?', `<p class="scene-copy small-copy">Один знак — у меня.<br>Второй ждёт тебя среди рабочего дня.<br>Третий появится, когда найдёшь остальные.</p><div class="clue-grid"><div><span aria-hidden="true">${progress.shield ? '👩' : '01'}</span><p>${progress.shield ? 'Первый знак' : 'От меня'}</p></div><div><span aria-hidden="true">${progress.office ? '⚔️' : '02'}</span><p>${progress.firstGuess || progress.office ? 'На твоём столе' : 'Второй знак'}</p></div><div><span aria-hidden="true">${progress.office && progress.shield ? '☀️' : '03'}</span><p>На сайте</p></div></div><div id="clue-task"></div>`);
    if (!progress.shield) {
      $('#clue-task').innerHTML = button('ask', 'Ну дай подсказку')+'<div id="message-task" hidden><p class="scene-copy">Напиши мне: «Ну хочешь, я покажу».<br>Посмотрим, что я тебе отвечу.</p>'+button('received', 'Эмоджи у меня', true)+'</div>';
      listen('#ask', 'click', () => { $('#ask').hidden = true; $('#message-task').hidden = false; });
      listen('#received', 'click', () => { progress.shield = true; save(); render(); });
    } else if (!progress.firstGuess && !progress.office) {
      $('#clue-task').innerHTML = '<p class="scene-copy">Пока только один знак. Есть первая версия?</p><p class="office-note">Это пока догадка. Проверим её, когда соберёшь все три знака.</p>'+answerForm('Твоя первая версия', 'Кто это может быть?', 'Предположить');
      listen('#answer-form', 'submit', event => {
        event.preventDefault();
        if (!normalize($('#answer').value)) { $('#answer-feedback').textContent = 'Напиши свою версию.'; return; }
        progress.firstGuess = true;
        save(); render();
      });
    } else if (!progress.office) {
      $('#clue-task').innerHTML = '<p class="scene-copy small-copy">Одного знака маловато. Прежде чем пробовать ещё, найди второй.</p><p class="scene-copy small-copy" id="office-copy"></p><p class="office-note">Если ты сейчас не в офисе, возвращайся сюда в понедельник. Я сохраню твоё место.</p>'+answerForm('Слово с найденного листка', 'Твой ответ', 'Открыть третий знак');
      $('#office-copy').textContent = content.office;
      checkAnswer('office', () => { progress.office = true; go('champion'); });
    } else go('champion');
  } else if (stage === 'champion') {
    frame('ВСЕ ЗНАКИ У ТЕБЯ', 'Кто же это?', '<div class="clue-grid complete-clues"><div><span>👩</span><p>От меня</p></div><div><span>⚔️</span><p>Со стола</p></div><div><span>☀️</span><p>С неба</p></div></div><p class="scene-copy">Теперь у тебя есть всё.<br>Кого мы загадали?</p>'+answerForm('Имя чемпиона', 'На русском или английском', 'Это точно…')+'<details><summary>Ещё маленькая подсказка</summary><p>Воительница. Клинок. Солнце. Рассвет на твоей стороне.</p></details>');
    checkAnswer('champion', () => { progress.leonaDone = true; go('champion-result'); });
  } else if (stage === 'champion-result') {
    frame('ЭМОДЖИНАРИУМ', 'Угуууу.', '<p class="scene-copy">Солнце нашли.<br>Зажигаем ещё одну звезду.</p><div class="earned-star sun-star" aria-hidden="true">☀</div>'+button('next', 'А дальше?'));
    listen('#next', 'click', () => go('wait'));
  } else {
    frame('ПРОДОЛЖЕНИЕ — ВО ВТОРНИК', 'Одну оставим<br>для нас.', '<div class="final-orbit" aria-hidden="true">✧</div><p id="ending" class="scene-copy"></p><p class="quiet-note">Остальные подробности я расскажу тебе сам.</p>');
    $('#ending').textContent = content.ending;
  }
}
$('#unlock-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!entryCode($('#code').value)) return;
  $('#submit').disabled = true; $('#feedback').textContent = 'Проверяю ключ…';
  let payload;
  try { const response = await fetch('./sealed.json', { cache: 'no-store' }); if (!response.ok || !crypto.subtle) throw new Error(); payload = await response.json(); }
  catch { $('#feedback').textContent = 'Не получилось загрузить историю. Проверь соединение и попробуй ещё раз.'; $('#submit').disabled = false; return; }
  try {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(entryCode($('#code').value)), 'PBKDF2', false, ['deriveKey']);
    decryptionKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(payload.salt), iterations: payload.iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(payload.iv) }, decryptionKey, bytes(payload.data));
    content = JSON.parse(new TextDecoder().decode(plain));
    active = true; $('#landing').hidden = true; $('#journey').hidden = false; $('#code').value = ''; $('#feedback').textContent = '';
    save(); render(); window.scrollTo({ top: 0, behavior: 'instant' });
  } catch { $('#feedback').textContent = 'Пока не тот ключ. Попробуй вспомнить ещё немного.'; }
  finally { $('#submit').disabled = false; }
});
$('#leave').addEventListener('click', () => {
  active = false; clearTimeout(revealTimer); sceneController?.abort();
  if (player) { player.pause(); player.removeAttribute('src'); player.load(); player = null; }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  content = null; decryptionKey = null; $('#scene').replaceChildren(); $('#journey').hidden = true; $('#landing').hidden = false; $('#code').focus();
});
