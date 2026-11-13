import '@bone-kit/skeleton/styles/base.css';
import { createLantern, bindConnectivity, clearAll, t, initialLantern } from '@bone-kit/skeleton';
import { renderShell } from './shell.js';

const root = document.getElementById('app')!;
const lantern = createLantern(initialLantern());
const { status, clear, note } = renderShell(root);

lantern.subscribe((s) => {
  status.dataset.status = s.status;
  status.textContent = t(`app.${s.status}`);
});
bindConnectivity(lantern, window);

clear.addEventListener('click', async () => {
  if (!confirm(t('app.clearAll.confirm'))) return;
  await clearAll();
  note.textContent = t('app.clearAll.done');
});
