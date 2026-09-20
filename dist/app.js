const form = document.querySelector('#unlock-form');
const input = document.querySelector('#code');
const feedback = document.querySelector('#feedback');
const submit = document.querySelector('#submit');
const normalize = value => value.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
document.querySelector('#toggle').addEventListener('click', event => {
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? 'Скрыть' : 'Показать';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
  event.currentTarget.setAttribute('aria-label', visible ? 'Скрыть слово' : 'Показать слово');
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!normalize(input.value)) { feedback.textContent = 'Сначала введи слово.'; return; }
  submit.disabled = true;
  feedback.textContent = 'Проверяю ключ…';
  let payload;
  try {
    if (!globalThis.crypto?.subtle) throw new Error('secure context required');
    const response = await fetch('./sealed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('load failed');
    payload = await response.json();
  } catch {
    feedback.textContent = 'Не получилось открыть историю. Обнови страницу и попробуй ещё раз.';
    submit.disabled = false;
    return;
  }
  try {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalize(input.value)), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(payload.salt), iterations: payload.iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(payload.iv) }, key, bytes(payload.data));
    const content = JSON.parse(new TextDecoder().decode(plaintext));
    document.querySelector('#secret-title').textContent = content.title;
    document.querySelector('#secret-body').textContent = content.body;
    document.querySelector('#locked').hidden = true;
    document.querySelector('#unlocked').hidden = false;
    document.querySelector('#unlocked').focus();
    input.value = '';
    feedback.textContent = '';
  } catch { feedback.textContent = 'Пока не тот ключ. Попробуй вспомнить ещё немного.'; }
  finally { submit.disabled = false; }
});
document.querySelector('#lock').addEventListener('click', () => {
  document.querySelector('#unlocked').hidden = true;
  document.querySelector('#secret-title').textContent = '';
  document.querySelector('#secret-body').textContent = '';
  document.querySelector('#locked').hidden = false;
  input.focus();
});
