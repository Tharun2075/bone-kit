import '@bone-kit/skeleton/styles/base.css';
import './app.css';
import { initTheme, clearAll, type Lantern } from '@bone-kit/skeleton';
import { CATEGORIES, MAX_TEXT, PostTextError, ShareFormatError, addPost, checkText, countChars, importCode, isSynthetic, listPosts, openBoard, removePost, seedIfNew, shareCode, type Category, type Post } from './posts.js';
import { DEFAULT_SIGNALLING, parseSignalling, startSync, type Sync } from './sync.js';
import { tr, type Lang, type SKey } from './i18n.js';
import type { Scanner } from './qr.js';
import { isRoomId, resolveRoom, roomLink, withRoom } from './room.js';

initTheme();
// qrcode and jsqr load only when the Share or Meet sheets need them, to keep the first load small.
const qrMod = () => import('./qr.js');

const LS = { lang: 'seance.lang', nick: 'seance.nick', sig: 'seance.sig' } as const;
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

let lang: Lang = ls.get(LS.lang) === 'te' ? 'te' : 'en';
let filter: Category | 'all' = 'all';
let peers = 0;
const T = (k: SKey | Parameters<typeof tr>[0], v?: Record<string, string | number>) => tr(k, lang, v);

// The room comes from the URL hash; a visitor with none gets a fresh private one. Each room has its own local database.
const room = resolveRoom(location, (h) => history.replaceState(null, '', location.pathname + location.search + h));
const board = openBoard(`seance-${room}`);
const { doc } = board;
let sync: Sync | null = null;
let scanner: Scanner | null = null;

const root = document.getElementById('app')!;
root.innerHTML = `
<header class="sb-head">
  <h1 id="t-title"></h1>
  <div class="sb-bar">
    <p class="bk-lantern" id="lantern" role="status" data-status="offline"></p>
    <button type="button" class="bk-button" id="b-meet"></button>
    <label class="sb-lang"><span id="t-lang"></span> <select id="lang"><option value="en">English</option><option value="te">తెలుగు</option></select></label>
  </div>
  <p id="t-tag" class="sb-tag"></p>
</header>
<main>
  <form id="compose" class="sb-compose" autocomplete="off">
    <label for="text" id="t-composeLabel"></label>
    <textarea id="text" rows="3" aria-describedby="count msg"></textarea>
    <div class="sb-row">
      <label for="nick" id="t-nick"></label>
      <input id="nick" type="text" maxlength="20" />
    </div>
    <fieldset class="sb-chips"><legend id="t-compose"></legend>
      ${CATEGORIES.map((c, i) => `<label class="sb-chip"><input type="radio" name="cat" value="${c}"${i === 0 ? ' checked' : ''} /><span data-k="cat_${c}"></span></label>`).join('')}
    </fieldset>
    <div class="sb-row"><button type="submit" class="bk-button" id="b-post"></button><span id="count" class="sb-count" aria-live="polite"></span></div>
    <p id="msg" class="sb-msg" role="alert"></p>
  </form>
  <nav class="sb-filter" aria-label="filter">
    <button type="button" class="sb-pill" data-f="all"></button>
    ${CATEGORIES.map((c) => `<button type="button" class="sb-pill" data-f="${c}" data-k="cat_${c}"></button>`).join('')}
  </nav>
  <ul id="wall" class="sb-wall"></ul>
  <p id="emptywall" class="sb-muted" hidden></p>
</main>
<footer class="sb-foot">
  <p id="t-privacy"></p>
  <p id="t-help" class="sb-help"></p>
  <button type="button" class="bk-button sb-clear" id="b-clear"></button>
  <p id="note" aria-live="polite"></p>
</footer>
<dialog id="meet"><form method="dialog"><h2 id="t-meetTitle"></h2>
  <label for="room" id="t-room"></label><input id="room" type="text" maxlength="40" />
  <label for="sig" id="t-sig"></label><input id="sig" type="text" inputmode="url" />
  <p id="t-sigHelp" class="sb-muted"></p>
  <label for="invite" id="t-invite"></label><input id="invite" type="text" readonly />
  <div class="sb-row"><button type="button" class="bk-button" id="b-invcopy"></button></div>
  <div id="inviteqr" class="sb-qr"></div>
  <div class="sb-row"><button type="button" class="bk-button" id="b-save"></button>
  <button type="button" class="bk-button" id="b-scan"></button>
  <button value="close" class="bk-button" id="b-meetclose"></button></div>
  <video id="video" class="sb-video" playsinline muted hidden></video>
  <p id="scanmsg" class="sb-muted" role="status"></p>
  <label for="paste" id="t-pasteLabel"></label><textarea id="paste" rows="2" spellcheck="false"></textarea>
  <button type="button" class="bk-button" id="b-add"></button>
  <p id="pastemsg" class="sb-msg" role="status"></p>
</form></dialog>
<dialog id="share"><form method="dialog"><h2 id="t-shareTitle"></h2>
  <p id="sharepost" class="sb-sharepost"></p>
  <div id="qr" class="sb-qr"></div>
  <p id="sharemsg" class="sb-msg" role="status"></p>
  <label for="codebox" id="t-code"></label><textarea id="codebox" rows="3" readonly spellcheck="false"></textarea>
  <div class="sb-row"><button type="button" class="bk-button" id="b-copy"></button><button value="close" class="bk-button" id="b-shareclose"></button></div>
</form></dialog>`;

const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
const text = $<HTMLTextAreaElement>('text');
const nick = $<HTMLInputElement>('nick');
nick.value = ls.get(LS.nick);
$<HTMLInputElement>('room').value = room;
$<HTMLInputElement>('sig').value = ls.get(LS.sig);

function setText() {
  document.documentElement.lang = lang;
  document.title = T('title');
  const map: Record<string, SKey> = { 't-title': 'title', 't-tag': 'tagline', 't-composeLabel': 'composeLabel', 't-nick': 'nickname', 't-compose': 'compose', 'b-post': 'post', 'b-meet': 'meet', 't-lang': 'language', 't-privacy': 'privacy', 't-help': 'helpLines', 't-meetTitle': 'meetTitle', 't-room': 'room', 't-sig': 'signalling', 't-sigHelp': 'signallingHelp', 'b-save': 'save', 'b-scan': 'scan', 'b-meetclose': 'close', 't-pasteLabel': 'pasteLabel', 'b-add': 'add', 't-shareTitle': 'shareTitle', 't-code': 'code', 'b-copy': 'copy', 't-invite': 'inviteLabel', 'b-invcopy': 'copy', 'b-shareclose': 'close', emptywall: 'empty_wall' };
  for (const [id, k] of Object.entries(map)) $(id).textContent = T(k);
  $('b-clear').textContent = T('app.clearAll');
  root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => (e.textContent = T(e.dataset.k as SKey)));
  root.querySelector<HTMLElement>('[data-f="all"]')!.textContent = T('all');
  updateCount();
  paintLantern();
  paintWall();
}

function updateCount() {
  const left = MAX_TEXT - countChars(text.value.trim());
  const c = $('count');
  c.textContent = left >= 0 ? T('left', { n: left }) : T('over', { n: -left });
  c.classList.toggle('sb-bad', left < 0);
}

function paintLantern() {
  const el = $('lantern');
  const st = !navigator.onLine ? 'offline' : (sync?.lantern.get().status ?? 'offline');
  el.dataset.status = st;
  // Text and a symbol, never colour alone.
  const mark = st === 'online' ? '● ' : st === 'stale' ? '◐ ' : '○ ';
  el.textContent = `${mark}${T(`app.${st}` as 'app.online')} · ${peers > 0 ? T('peers', { n: peers }) : T('noPeers')}`;
}

function paintWall() {
  const wall = $('wall');
  wall.replaceChildren();
  const posts = listPosts(doc).filter((p) => filter === 'all' || p.category === filter);
  $('emptywall').hidden = posts.length > 0;
  for (const p of posts) wall.append(card(p));
  root.querySelectorAll<HTMLElement>('.sb-pill').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === filter)));
}

function card(p: Post): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'sb-card';
  li.dataset.cat = p.category;
  li.dataset.id = p.id;
  const tag = document.createElement('span');
  tag.className = 'sb-tagline';
  tag.textContent = T(`cat_${p.category}` as SKey);
  const body = document.createElement('p');
  body.className = 'sb-body';
  body.textContent = p.text;
  const foot = document.createElement('div');
  foot.className = 'sb-cardfoot';
  const who = document.createElement('span');
  who.className = 'sb-who';
  who.textContent = p.nick ? T('by', { name: p.nick }) : '';
  const share = btn(T('share'), () => openShare(p));
  const rm = btn(T('remove'), () => { removePost(doc, p.id); });
  foot.append(who, share, rm);
  li.append(tag);
  if (isSynthetic(p.id)) {
    const s = document.createElement('span');
    s.className = 'sb-synth';
    s.textContent = T('synthetic');
    li.append(s);
  }
  li.append(body, foot);
  return li;
}

function btn(label: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sb-small';
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

async function openShare(p: Post) {
  const r = shareCode(p);
  $('sharepost').textContent = p.text;
  const qr = $('qr');
  const box = $<HTMLTextAreaElement>('codebox');
  if (r.ok) {
    $('sharemsg').textContent = `${r.code.length}/160`;
    box.value = r.code;
    qr.innerHTML = (await qrMod()).qrSvg(r.code, T('qrAlt'));
  } else {
    $('sharemsg').textContent = T('tooLongShare', { n: r.cut });
    box.value = '';
    qr.replaceChildren();
  }
  $<HTMLButtonElement>('b-copy').disabled = !r.ok;
  ($('share') as HTMLDialogElement).showModal();
}

window.addEventListener('online', () => paintLantern());
window.addEventListener('offline', () => paintLantern());

function restartSync() {
  sync?.destroy();
  const sig = ls.get(LS.sig) ? parseSignalling(ls.get(LS.sig)) : DEFAULT_SIGNALLING;
  sync = startSync(doc, { room, signalling: sig }, (n) => {
    peers = n;
    paintLantern();
  });
  (sync.lantern as Lantern).subscribe(paintLantern);
  paintLantern();
}

function stopScan() {
  scanner?.stop();
  scanner = null;
  $<HTMLVideoElement>('video').hidden = true;
}

function paste(raw: string) {
  const out = $('pastemsg');
  try {
    out.textContent = T(importCode(doc, raw) === 'added' ? 'added' : 'known');
    $<HTMLTextAreaElement>('paste').value = '';
  } catch (e) {
    if (!(e instanceof ShareFormatError)) throw e;
    out.textContent = T('badCode');
  }
}

$('compose').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = $('msg');
  try {
    const cat = (root.querySelector<HTMLInputElement>('input[name=cat]:checked')!.value as Category) ?? 'h';
    checkText(text.value);
    addPost(doc, text.value, cat, Date.now(), Math.random, nick.value);
    ls.set(LS.nick, nick.value.trim());
    text.value = '';
    msg.textContent = '';
    updateCount();
  } catch (err) {
    if (!(err instanceof PostTextError)) throw err;
    msg.textContent = err.kind === 'empty' ? T('empty') : T('over', { n: -err.remaining });
  }
});
text.addEventListener('input', () => { $('msg').textContent = ''; updateCount(); });
root.querySelectorAll<HTMLElement>('.sb-pill').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f as Category | 'all'; paintWall(); }));
$('lang').addEventListener('change', (e) => { lang = (e.target as HTMLSelectElement).value === 'te' ? 'te' : 'en'; ls.set(LS.lang, lang); setText(); });
$<HTMLSelectElement>('lang').value = lang;
$('b-meet').addEventListener('click', async () => {
  const link = roomLink(location.href, room);
  $<HTMLInputElement>('invite').value = link;
  ($('meet') as HTMLDialogElement).showModal();
  $('inviteqr').innerHTML = (await qrMod()).qrSvg(link, T('inviteQrAlt'));
});
$('b-invcopy').addEventListener('click', async () => {
  const el = $<HTMLInputElement>('invite');
  try { await navigator.clipboard.writeText(el.value); $('scanmsg').textContent = T('copied'); } catch { el.select(); }
});
window.addEventListener('hashchange', () => location.reload()); // a pasted link with another room is another board
$('meet').addEventListener('close', stopScan);
$('b-save').addEventListener('click', () => {
  const wanted = $<HTMLInputElement>('room').value.trim();
  ls.set(LS.sig, parseSignalling($<HTMLInputElement>('sig').value).join(' '));
  if (wanted !== room && isRoomId(wanted)) {
    history.replaceState(null, '', location.pathname + location.search + withRoom(location.hash, wanted));
    location.reload(); // a new room is a new local board
    return;
  }
  restartSync();
});
$('b-add').addEventListener('click', () => paste($<HTMLTextAreaElement>('paste').value));
$('b-scan').addEventListener('click', async () => {
  stopScan();
  const video = $<HTMLVideoElement>('video');
  try {
    video.hidden = false;
    $('scanmsg').textContent = T('scanning');
    scanner = await (await qrMod()).startScanner(video, (code) => { stopScan(); $('scanmsg').textContent = ''; paste(code); });
  } catch {
    stopScan();
    $('scanmsg').textContent = T('noCamera');
    $<HTMLTextAreaElement>('paste').focus();
  }
});
$('b-copy').addEventListener('click', async () => {
  const v = $<HTMLTextAreaElement>('codebox').value;
  try { await navigator.clipboard.writeText(v); $('sharemsg').textContent = T('copied'); } catch { $<HTMLTextAreaElement>('codebox').select(); }
});
$('b-clear').addEventListener('click', async () => {
  if (!confirm(T('app.clearAll.confirm'))) return;
  sync?.destroy(); // close connections first, or they block the delete and push posts back
  await board.bone.destroy();
  await clearAll();
  Object.values(LS).forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  $('note').textContent = T('app.clearAll.done');
  setTimeout(() => location.reload(), 400);
});

doc.on('update', paintWall);
setText();
restartSync();
board.bone.ready.then(() => { seedIfNew(doc); paintWall(); });
