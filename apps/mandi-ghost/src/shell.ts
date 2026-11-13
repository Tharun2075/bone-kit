import { t } from '@bone-kit/skeleton';

/** Static, accessible shell: a live status lantern, a Clear all button and a polite notice area. */
export function renderShell(root: HTMLElement) {
  const status = document.createElement('p');
  status.className = 'bk-lantern';
  status.setAttribute('role', 'status');
  status.dataset.status = 'offline';
  status.textContent = t('app.offline');

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'bk-button';
  clear.textContent = t('app.clearAll');

  const note = document.createElement('p');
  note.setAttribute('aria-live', 'polite');

  root.append(status, clear, note);
  return { status, clear, note };
}
