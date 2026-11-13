import { t, type Lang } from '@bone-kit/skeleton';

/** Static, accessible shell. main.ts fills it; every string goes through t(). */
export function renderShell(root: HTMLElement) {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, id?: string) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (id) e.id = id;
    return e;
  };
  const h1 = el('h1');
  const lantern = el('p', 'bk-lantern', 'lantern');
  lantern.setAttribute('role', 'status');
  lantern.dataset.status = 'offline';
  const lastSeen = el('p', 'last-seen', 'last-seen');
  const banner = el('p', 'banner', 'banner');
  banner.setAttribute('role', 'note');

  const controls = el('div', 'controls');
  const field = (id: string) => {
    const wrap = el('div', 'field');
    const label = el('label');
    label.htmlFor = id;
    const select = el('select', 'bk-select', id);
    wrap.append(label, select);
    return { wrap, label, select };
  };
  const market = field('market');
  const commodity = field('commodity');
  const language = field('language');
  controls.append(market.wrap, commodity.wrap, language.wrap);

  const prices = el('section', 'card', 'prices');
  const trend = el('section', 'card', 'trend');
  const weather = el('section', 'card', 'weather');
  const notes = el('footer', 'notes');
  const disclaimer = el('p');
  const attribution = el('p');
  const dropped = el('p');
  const clear = el('button', 'bk-button', 'clear-all');
  clear.type = 'button';
  const note = el('p', 'note', 'note');
  note.setAttribute('aria-live', 'polite');
  notes.append(disclaimer, attribution, dropped, clear, note);

  root.replaceChildren(h1, lantern, lastSeen, banner, controls, prices, trend, weather, notes);
  return { h1, lantern, lastSeen, banner, market, commodity, language, prices, trend, weather, disclaimer, attribution, dropped, clear, note };
}

export type Shell = ReturnType<typeof renderShell>;

export function setLabels(sh: Shell, lang: Lang): void {
  document.documentElement.lang = lang;
  sh.h1.textContent = t('mandi.title', lang);
  sh.market.label.textContent = t('mandi.market', lang);
  sh.commodity.label.textContent = t('mandi.commodity', lang);
  sh.language.label.textContent = t('mandi.language', lang);
  sh.disclaimer.textContent = t('mandi.disclaimer', lang);
  sh.clear.textContent = t('app.clearAll', lang);
}
