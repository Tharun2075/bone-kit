import '@bone-kit/skeleton/styles/base.css';
import './app.css';
import { initTheme, clearAll, type Lantern } from '@bone-kit/skeleton';
import { CATEGORIES, MAX_TEXT, PostExpiryError, PostTextError, ShareFormatError, addPost, checkText, countChars, importCode, isExpired, isSynthetic, listPosts, openBoard, removePost, seedIfNew, shareCode, type Category, type Post } from './posts.js';
import { DEFAULT_SIGNALLING, parseSignalling, startSync, type Sync } from './sync.js';
import { tr, type Lang, type SKey } from './i18n.js';
import type { Scanner } from './qr.js';
import { remaining, resolveExpiry, type ExpiryChoice } from './expiry.js';
import { isRoomId, resolveRoom, roomLink, withRoom } from './room.js';

initTheme();
// qrcode and jsqr load only when the Share or Meet sheets need them, to keep the first load small.
const qrMod = () => import('./qr.js');

const EXPIRY_CHOICES: ExpiryChoice[] = ['none', 'h1', 'h6', 'h24', 'd7', 'pick'];

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
    <div class="sb-row">
      <label for="expiry" data-k="expiry.label"></label>
      <select id="expiry">${EXPIRY_CHOICES.map((c) => `<option value="${c}"${c === 'none' ? ' selected' : ''} data-k="expiry.${c}"></option>`).join('')}</select>
    </div>
    <div class="sb-row">
      <label for="expPick" id="l-expPick" data-k="expiry.pickLabel" hidden></label>
      <input id="expPick" type="datetime-local" hidden />
    </div>
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
const expirySel = $<HTMLSelectElement>('expiry');
const expPick = $<HTMLInputElement>('expPick');
function syncPicker() {
  const show = expirySel.value === 'pick';
  expPick.hidden = !show;
  $('l-expPick').hidden = !show;
  if (!show) expPick.value = '';
}
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
  // When offline the peer count is stale: connections haven't timed out yet but no data can flow.
  const peerText = st !== 'offline' && peers > 0 ? T('peers', { n: peers }) : T('noPeers');
  el.textContent = `${mark}${T(`app.${st}` as 'app.online')} · ${peerText}`;
}

const nowSec = () => Math.floor(Date.now() / 1000);
let shownKey = '';

function expLabel(expires: number, now: number): string {
  const r = remaining(expires, now);
  return T(`expiry.left_${r.unit}` as SKey, { n: r.n });
}

function visible(now: number): Post[] {
  return listPosts(doc, now).filter((p) => filter === 'all' || p.category === filter);
}

function paintWall(now: number = nowSec()) {
  const wall = $('wall');
  wall.replaceChildren();
  const posts = visible(now);
  shownKey = posts.map((p) => p.id).join(',');
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
  li.append(body);
  if (p.expires !== undefined) {
    const x = document.createElement('span');
    x.className = 'sb-exp';
    x.dataset.exp = String(p.expires);
    x.textContent = expLabel(p.expires, nowSec());
    li.append(x);
  }
  li.append(foot);
  return li;
}

/** Repaint when the visible set changes (a note expired, or the clock moved back); otherwise refresh labels in place. */
function tick() {
  const now = nowSec();
  const key = visible(now).map((p) => p.id).join(',');
  if (key !== shownKey) { paintWall(now); return; }
  root.querySelectorAll<HTMLElement>('.sb-exp').forEach((e) => {
    const t = expLabel(Number(e.dataset.exp), now);
    if (e.textContent !== t) e.textContent = t;
  });
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
  if (isExpired(p.expires, nowSec())) { paintWall(); return; }
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
    const res = importCode(doc, raw);
    out.textContent = res === 'expired' ? T('expiry.expiredCode') : T(res === 'added' ? 'added' : 'known');
    $<HTMLTextAreaElement>('paste').value = '';
  } catch (e) {
    if (!(e instanceof ShareFormatError)) throw e;
    out.textContent = e.reason === 'expiry' ? T('expiry.badCode') : T('badCode');
  }
}

$('compose').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = $('msg');
  try {
    const cat = (root.querySelector<HTMLInputElement>('input[name=cat]:checked')!.value as Category) ?? 'h';
    checkText(text.value);
    const now = Date.now();
    const expires = resolveExpiry(expirySel.value as ExpiryChoice, expPick.value, now);
    addPost(doc, text.value, cat, now, Math.random, nick.value, expires);
    ls.set(LS.nick, nick.value.trim());
    text.value = '';
    msg.textContent = '';
    expirySel.value = 'none';
    syncPicker();
    updateCount();
  } catch (err) {
    if (err instanceof PostExpiryError) {
      const time = err.bound === undefined ? '' : new Intl.DateTimeFormat(lang === 'te' ? 'te-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(err.bound * 1000);
      msg.textContent = err.kind === 'invalid' ? T('expiry.err_invalid') : err.kind === 'tooSoon' ? T('expiry.err_soon', { time }) : T('expiry.err_far', { time });
      return;
    }
    if (!(err instanceof PostTextError)) throw err;
    msg.textContent = err.kind === 'empty' ? T('empty') : T('over', { n: -err.remaining });
  }
});
expirySel.addEventListener('change', () => { $('msg').textContent = ''; syncPicker(); });
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

doc.on('update', () => paintWall());
setInterval(tick, 2000);
document.addEventListener('visibilitychange', tick);
window.addEventListener('pageshow', tick);
setText();
restartSync();
board.bone.ready.then(() => { seedIfNew(doc); paintWall(); });
