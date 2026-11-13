import '@bone-kit/skeleton/styles/base.css';
import './app.css';
import { createLantern, bindConnectivity, clearAll, initialLantern, t, type Lang } from '@bone-kit/skeleton';
import { renderShell, setLabels } from './shell.js';
import { openStore, loadView, refreshSnapshot, savePick, fetchWeather, saveWeather, type View } from './data.js';
import { bannerText, lastSeenText, trendSvg } from './format.js';
import { pairKey } from './snapshot.js';

const DAY = 24 * 3_600_000;
const REFRESH_MS = 30_000; // R3.1: back online -> screen updated well inside 60 s
const SNAPSHOT_URL = './snapshot.json';

const root = document.getElementById('app')!;
const sh = renderShell(root);
let store = openStore();
const lantern = createLantern(initialLantern(DAY));
let view: View = { meta: null, trends: [], weather: {}, pick: null, lastSeen: null };
let lang: Lang = 'en';
let pick = { market: '', commodity: '' };

function fill(select: HTMLSelectElement, values: string[], current: string) {
  select.replaceChildren(...values.map((v) => Object.assign(document.createElement('option'), { value: v, textContent: v, selected: v === current })));
}

function renderStatus() {
  const s = lantern.get();
  const stale = s.lastSyncAt === null ? view.lastSeen === null || Date.now() - view.lastSeen > DAY : Date.now() - s.lastSyncAt > DAY;
  const status = s.status === 'online' && stale ? 'stale' : s.status;
  sh.lantern.dataset.status = status;
  sh.lantern.textContent = t(`app.${status}`, lang);
  const seen = lastSeenText(s.lastSyncAt ?? view.lastSeen, Date.now(), lang);
  sh.lastSeen.textContent = seen;
  sh.lastSeen.hidden = status === 'online' && !stale;
}

function render() {
  setLabels(sh, lang);
  const markets = [...new Set(view.trends.map((x) => x.market))];
  const commodities = [...new Set(view.trends.filter((x) => x.market === pick.market).map((x) => x.commodity))];
  if (!markets.includes(pick.market)) pick.market = markets[0] ?? '';
  const cs = [...new Set(view.trends.filter((x) => x.market === pick.market).map((x) => x.commodity))];
  if (!cs.includes(pick.commodity)) pick.commodity = cs[0] ?? '';
  void commodities;
  fill(sh.market.select, markets, pick.market);
  fill(sh.commodity.select, cs, pick.commodity);
  fill(sh.language.select, ['en', 'te'], lang);

  const banner = bannerText(view.meta, lang);
  sh.banner.textContent = banner;
  sh.banner.hidden = banner === '';
  const live = view.meta && !view.meta.synthetic;
  sh.attribution.textContent = `${view.meta?.attribution ?? ''} ${t('mandi.openMeteo', lang)}`.trim();
  sh.dropped.textContent = view.meta && view.meta.droppedRows > 0 ? t('mandi.dropped', lang).replace('{n}', String(view.meta.droppedRows)) : '';
  sh.dropped.hidden = !sh.dropped.textContent;
  sh.prices.dataset.source = live ? 'live' : 'synthetic';

  const tr = view.trends.find((x) => pairKey(x.market, x.commodity) === pairKey(pick.market, pick.commodity));
  const last = tr?.points[tr.points.length - 1];
  if (!tr || !last) {
    sh.prices.textContent = t('mandi.noData', lang);
    sh.trend.replaceChildren();
  } else {
    const dl = document.createElement('dl');
    const row = (k: Parameters<typeof t>[0], v: string, cls = '') => {
      const dt = Object.assign(document.createElement('dt'), { textContent: t(k, lang) });
      const dd = Object.assign(document.createElement('dd'), { textContent: v, className: cls });
      dl.append(dt, dd);
    };
    row('mandi.min', String(last.min));
    row('mandi.max', String(last.max));
    row('mandi.modal', String(last.modal), 'modal');
    row('mandi.date', last.date);
    const unit = Object.assign(document.createElement('p'), { className: 'unit', textContent: t('mandi.unit', lang) });
    sh.prices.replaceChildren(dl, unit);
    const first = tr.points[0]!;
    const desc = t('mandi.trendDesc', lang).replace('{from}', first.date).replace('{to}', last.date).replace('{last}', String(last.modal));
    const h2 = Object.assign(document.createElement('h2'), { textContent: t('mandi.trend', lang) });
    sh.trend.replaceChildren(h2, trendSvg(tr.points, t('mandi.trend', lang), desc));
  }

  const days = view.weather[pick.market] ?? [];
  const h2 = Object.assign(document.createElement('h2'), { textContent: t('mandi.weather', lang) });
  if (days.length === 0) sh.weather.replaceChildren(h2, Object.assign(document.createElement('p'), { textContent: t('mandi.weatherNone', lang) }));
  else {
    const ul = document.createElement('ul');
    days.forEach((d) => ul.append(Object.assign(document.createElement('li'), { textContent: `${d.date}: ${Math.round(d.tmin)}–${Math.round(d.tmax)} °C, ${t('mandi.rain', lang).replace('{mm}', String(d.rain))}` })));
    sh.weather.replaceChildren(h2, ul);
  }
  renderStatus();
}

async function reload() {
  view = await loadView(store);
  if (view.pick) {
    lang = view.pick.lang;
    pick = { market: view.pick.market, commodity: view.pick.commodity };
  }
  render();
}

async function liveWeather() {
  const c = view.meta?.coords?.[pick.market];
  if (!c || !navigator.onLine) return;
  const days = await fetchWeather(c.lat, c.lon);
  if (days.length) {
    await saveWeather(store, pick.market, days);
    view = await loadView(store);
    render();
  }
}

async function refresh() {
  if (!navigator.onLine) return;
  const snap = await refreshSnapshot(store, SNAPSHOT_URL);
  if (snap) {
    lantern.send({ type: 'SYNCED', at: Date.now() });
    await reload();
  }
}

function persistPick() {
  void savePick(store, { ...pick, lang });
}
sh.market.select.addEventListener('change', () => { pick.market = sh.market.select.value; pick.commodity = ''; render(); persistPick(); void liveWeather(); });
sh.commodity.select.addEventListener('change', () => { pick.commodity = sh.commodity.select.value; render(); persistPick(); });
sh.language.select.addEventListener('change', () => { lang = sh.language.select.value as Lang; render(); persistPick(); });

sh.clear.addEventListener('click', async () => {
  if (!confirm(t('app.clearAll.confirm', lang))) return;
  store.close();
  await clearAll();
  store = openStore();
  view = { meta: null, trends: [], weather: {}, pick: null, lastSeen: null };
  lantern.send({ type: 'DISCONNECTED' });
  render();
  sh.note.textContent = t('app.clearAll.done', lang);
});

lantern.subscribe(() => renderStatus());
await reload(); // R2.2: paint from IndexedDB first, no network
bindConnectivity(lantern, window);
window.addEventListener('online', () => void refresh());
setInterval(() => void refresh(), REFRESH_MS);
await refresh();
void liveWeather();
