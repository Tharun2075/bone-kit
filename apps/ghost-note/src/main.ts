/**
 * Ghost Note — local-only personal log.
 *
 * Data flow: local-only. No network calls, no Yjs, no sync.
 * Storage:   createStore('ghost-note') — Dexie over IndexedDB.
 * Codec:     createCodec (in notes.ts) for QR/SMS export of individual notes.
 * Lantern:   reflects the age of the most recent write, not network state.
 */

import '@bone-kit/skeleton/styles/base.css';
import {
  initTheme,
  createStore,
  createLantern,
  bindConnectivity,
  clearAll,
  initialLantern,
  t,
  type Lang,
} from '@bone-kit/skeleton';
import {
  MOODS,
  MAX_TEXT,
  codec,
  newNoteId,
  saveNote,
  deleteNote,
  listNotes,
  latestWrite,
  seedIfNew,
  isSynthetic,
  type Note,
  type Mood,
} from './notes.js';

initTheme();

// ── i18n additions ────────────────────────────────────────────────────────────
// Local string table until these keys are upstreamed to skeleton/src/i18n.ts.

const LOCAL_EN: Record<string, string> = {
  'gn.title':          'Ghost Note',
  'gn.tagline':        'Your notes stay on this device only.',
  'gn.addNote':        'Add note',
  'gn.save':           'Save',
  'gn.cancel':         'Cancel',
  'gn.delete':         'Delete',
  'gn.share':          'Share',
  'gn.mood':           'Mood',
  'gn.mood.ok':        'Ok',
  'gn.mood.low':       'Low',
  'gn.mood.high':      'High',
  'gn.empty':          'No notes yet. Add your first note below.',
  'gn.left':           '{n} characters left',
  'gn.over':           '{n} characters over',
  'gn.writtenAgo':     'Last written {h}h ago',
  'gn.writtenNow':     'Last written just now',
  'gn.neverWritten':   'Nothing written yet',
  'gn.shareTitle':     'Share note',
  'gn.code':           'SMS / QR code',
  'gn.copy':           'Copy',
  'gn.close':          'Close',
  'gn.copied':         'Copied',
  'gn.tooLong':        'Note too long to share by SMS ({n} chars over)',
  'gn.settings':       'Settings',
  'gn.language':       'Language',
  'gn.synthetic':      '(sample)',
  'gn.disclaimer':     'Notes are stored only on this device.',
};

function gt(key: string, lang: Lang, vars: Record<string, string | number> = {}): string {
  let s: string;
  if (key.startsWith('app.')) {
    s = t(key as Parameters<typeof t>[0], lang);
  } else {
    s = LOCAL_EN[key] ?? key;
  }
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

// ── State ─────────────────────────────────────────────────────────────────────

const store = createStore('ghost-note');
const lantern = createLantern(initialLantern());
let lang: Lang = 'en';
let lastWriteMs: number | null = null;

// ── Lantern label (write age, not network age) ────────────────────────────────

function writeAgeLabel(ms: number | null, now: number, l: Lang): string {
  if (ms === null) return gt('gn.neverWritten', l);
  const h = Math.floor((now - ms) / 3_600_000);
  if (h < 1) return gt('gn.writtenNow', l);
  return gt('gn.writtenAgo', l, { h });
}

// ── DOM ───────────────────────────────────────────────────────────────────────

const root = document.getElementById('app')!;
root.innerHTML = `
<header class="gn-head">
  <h1 id="gn-title"></h1>
  <p class="bk-lantern" id="lantern" role="status" data-status="offline"></p>
  <p id="gn-tagline" class="gn-tagline"></p>
</header>
<main>
  <form id="compose" class="gn-compose" autocomplete="off" hidden>
    <label for="text" id="gn-textLabel"></label>
    <textarea id="text" rows="3" aria-describedby="count compmsg" maxlength="200"></textarea>
    <div class="gn-row"><span id="count" class="gn-count" aria-live="polite"></span></div>
    <fieldset class="gn-moods"><legend id="gn-moodLegend"></legend>
      ${MOODS.map((m, i) => `<label class="gn-chip"><input type="radio" name="mood" value="${m}"${i === 0 ? ' checked' : ''} /><span id="gn-mood-${m}"></span></label>`).join('')}
    </fieldset>
    <div class="gn-row">
      <button type="submit" class="bk-button" id="b-save"></button>
      <button type="button" class="bk-button" id="b-cancel"></button>
    </div>
    <p id="compmsg" class="gn-msg" role="alert"></p>
  </form>
  <button type="button" class="bk-button gn-add" id="b-add"></button>
  <ul id="log" class="gn-log"></ul>
  <p id="empty" class="gn-muted" hidden></p>
</main>
<footer class="gn-foot">
  <details>
    <summary id="gn-settings"></summary>
    <div class="gn-settings-body">
      <label class="gn-row"><span id="gn-langLabel"></span>
        <select id="lang"><option value="en">English</option><option value="te">తెలుగు</option></select>
      </label>
      <button type="button" class="bk-button" id="b-clear"></button>
    </div>
  </details>
  <p id="gn-disclaimer" class="gn-muted"></p>
  <p id="note" aria-live="polite"></p>
</footer>
<dialog id="share"><form method="dialog">
  <h2 id="gn-shareTitle"></h2>
  <p id="sharetext" class="gn-sharetext"></p>
  <div id="shareqr" class="gn-qr"></div>
  <p id="sharemsg" class="gn-msg" role="status"></p>
  <label for="codebox" id="gn-codeLabel"></label>
  <textarea id="codebox" rows="3" readonly spellcheck="false"></textarea>
  <div class="gn-row">
    <button type="button" class="bk-button" id="b-copy"></button>
    <button value="close" class="bk-button" id="b-shareclose"></button>
  </div>
</form></dialog>`;

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const compose   = $<HTMLFormElement>('compose');
const textarea  = $<HTMLTextAreaElement>('text');

// ── Render ────────────────────────────────────────────────────────────────────

function paintLantern() {
  const el = $('lantern');
  // Status attribute drives the base.css colour; label describes write recency, not network.
  const st = !navigator.onLine ? 'offline' : lantern.get().status;
  el.dataset.status = st;
  const mark = st === 'online' ? '● ' : st === 'stale' ? '◐ ' : '○ ';
  el.textContent = mark + writeAgeLabel(lastWriteMs, Date.now(), lang);
}

function paintCount() {
  const left = MAX_TEXT - [...textarea.value].length;
  const c = $('count');
  c.textContent = left >= 0 ? gt('gn.left', lang, { n: left }) : gt('gn.over', lang, { n: -left });
  c.classList.toggle('gn-bad', left < 0);
}

function setText() {
  document.documentElement.lang = lang;
  document.title = gt('gn.title', lang);
  $('gn-title').textContent        = gt('gn.title', lang);
  $('gn-tagline').textContent      = gt('gn.tagline', lang);
  $('gn-textLabel').textContent    = gt('gn.addNote', lang);
  $('b-save').textContent          = gt('gn.save', lang);
  $('b-cancel').textContent        = gt('gn.cancel', lang);
  $('b-add').textContent           = gt('gn.addNote', lang);
  $('empty').textContent           = gt('gn.empty', lang);
  $('gn-moodLegend').textContent   = gt('gn.mood', lang);
  $('gn-settings').textContent     = gt('gn.settings', lang);
  $('gn-langLabel').textContent    = gt('gn.language', lang);
  $('b-clear').textContent         = t('app.clearAll', lang);
  $('gn-disclaimer').textContent   = gt('gn.disclaimer', lang);
  $('gn-shareTitle').textContent   = gt('gn.shareTitle', lang);
  $('gn-codeLabel').textContent    = gt('gn.code', lang);
  $('b-copy').textContent          = gt('gn.copy', lang);
  $('b-shareclose').textContent    = gt('gn.close', lang);
  for (const m of MOODS) $(`gn-mood-${m}`).textContent = gt(`gn.mood.${m}`, lang);
  paintCount();
  paintLantern();
}

function noteCard(n: Note): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'gn-card';
  li.dataset.id = n.id;
  li.dataset.mood = n.mood;

  const when = document.createElement('time');
  when.className = 'gn-when';
  const d = new Date(n.created * 1000);
  when.dateTime = d.toISOString();
  when.textContent = d.toLocaleString(lang === 'te' ? 'te-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  const moodEl = document.createElement('span');
  moodEl.className = 'gn-mood-tag';
  moodEl.textContent = gt(`gn.mood.${n.mood}`, lang);

  const body = document.createElement('p');
  body.className = 'gn-body';
  body.textContent = n.text;

  const foot = document.createElement('div');
  foot.className = 'gn-cardfoot';

  if (isSynthetic(n.id)) {
    const s = document.createElement('span');
    s.className = 'gn-synth';
    s.textContent = gt('gn.synthetic', lang);
    foot.append(s);
  }

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'bk-button gn-small';
  shareBtn.textContent = gt('gn.share', lang);
  shareBtn.addEventListener('click', () => void openShare(n));

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'bk-button gn-small';
  delBtn.textContent = gt('gn.delete', lang);
  delBtn.addEventListener('click', () => void (async () => {
    await deleteNote(store, n.id);
    await paintLog();
  })());

  foot.append(shareBtn, delBtn);
  li.append(when, moodEl, body, foot);
  return li;
}

async function openShare(n: Note) {
  $('sharetext').textContent = n.text;
  const qr     = $('shareqr');
  const box    = $<HTMLTextAreaElement>('codebox');
  const msg    = $('sharemsg');
  try {
    const code = codec.encode({ id: n.id, text: n.text, mood: n.mood, created: n.created });
    box.value = code;
    msg.textContent = `${code.length}/160`;
    // Lazy-load qrcode only when the share sheet opens (keeps first-load small).
    const { default: QRCode } = await import('qrcode');
    const svg = await (QRCode as unknown as { toString(s: string, o: object): Promise<string> })
      .toString(code, { type: 'svg', width: 200 });
    qr.innerHTML = svg;
  } catch {
    const over = [...n.text].length - MAX_TEXT;
    box.value = '';
    qr.innerHTML = '';
    msg.textContent = gt('gn.tooLong', lang, { n: over > 0 ? over : 1 });
  }
  ($('share') as HTMLDialogElement).showModal();
}

async function paintLog() {
  const notes = await listNotes(store);
  lastWriteMs = await latestWrite(store);
  const ul = $('log');
  ul.replaceChildren(...notes.map(noteCard));
  $('empty').hidden = notes.length > 0;
  paintLantern();
}

// ── Events ────────────────────────────────────────────────────────────────────

compose.addEventListener('submit', (e) => {
  e.preventDefault();
  void (async () => {
    const raw = textarea.value.trim();
    const chars = [...raw].length;
    if (!raw || chars > MAX_TEXT) {
      $('compmsg').textContent = !raw ? gt('gn.empty', lang) : gt('gn.over', lang, { n: chars - MAX_TEXT });
      return;
    }
    const mood = (root.querySelector<HTMLInputElement>('input[name=mood]:checked')?.value as Mood) ?? 'ok';
    const note: Note = { id: newNoteId(), text: raw, mood, created: Math.floor(Date.now() / 1000) };
    await saveNote(store, note);
    textarea.value = '';
    $('compmsg').textContent = '';
    compose.hidden = true;
    $('b-add').hidden = false;
    await paintLog();
  })();
});

textarea.addEventListener('input', () => { $('compmsg').textContent = ''; paintCount(); });

$('b-add').addEventListener('click', () => {
  compose.hidden = false;
  $('b-add').hidden = true;
  textarea.focus();
});

$('b-cancel').addEventListener('click', () => {
  compose.hidden = true;
  $('b-add').hidden = false;
  textarea.value = '';
  $('compmsg').textContent = '';
  paintCount();
});

$('lang').addEventListener('change', (e) => {
  lang = (e.target as HTMLSelectElement).value === 'te' ? 'te' : 'en';
  setText();
  void paintLog();
});

$('b-clear').addEventListener('click', () => void (async () => {
  if (!confirm(t('app.clearAll.confirm', lang))) return;
  store.close();
  await clearAll();
  $('note').textContent = t('app.clearAll.done', lang);
  setTimeout(() => location.reload(), 400);
})());

$('b-copy').addEventListener('click', () => void (async () => {
  const v = $<HTMLTextAreaElement>('codebox').value;
  try {
    await navigator.clipboard.writeText(v);
    $('sharemsg').textContent = gt('gn.copied', lang);
  } catch {
    $<HTMLTextAreaElement>('codebox').select();
  }
})());

window.addEventListener('online',  () => paintLantern());
window.addEventListener('offline', () => paintLantern());

// ── Boot ──────────────────────────────────────────────────────────────────────

bindConnectivity(lantern, window);
lantern.subscribe(paintLantern);
setText();
await seedIfNew(store);
await paintLog();
