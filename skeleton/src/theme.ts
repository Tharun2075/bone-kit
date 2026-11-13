/** Dark is the default look; light only when the device asks for it (prefers-color-scheme: light). */
export function initTheme(doc: Document = document, win: Window = window): void {
  const mq = win.matchMedia('(prefers-color-scheme: light)');
  const apply = () => doc.documentElement.setAttribute('data-theme', mq.matches ? 'light' : 'dark');
  apply();
  mq.addEventListener('change', apply);
}
