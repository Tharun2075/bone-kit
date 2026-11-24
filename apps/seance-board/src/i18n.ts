import { t as baseT, type Lang, type StringKey } from '@bone-kit/skeleton';

export type { Lang };

export const en = {
  title: 'Seance Board',
  tagline: 'Pin a note. It reaches every device that meets this one, no account. Posts pass through a relay that stores nothing.',
  compose: 'Write a note',
  composeLabel: 'Your note (100 characters)',
  nickname: 'Nickname (optional)',
  post: 'Pin it',
  left: '{n} left',
  over: '{n} too many',
  empty: 'Write something first',
  cat_h: 'Help',
  cat_n: 'News',
  cat_a: 'Ask',
  cat_c: 'Chat',
  all: 'All',
  synthetic: 'synthetic',
  by: 'by {name}',
  share: 'Share',
  remove: 'Remove',
  meet: 'Meet',
  meetTitle: 'Meet another device',
  room: 'Room name',
  signalling: 'Signalling server (optional, wss://...)',
  signallingHelp: 'Empty means tabs on this device only. Add a server to meet devices on other networks.',
  save: 'Save',
  peers: '{n} nearby',
  noPeers: 'no one nearby',
  shareTitle: 'Share this note',
  code: 'Code (copy it, send it by SMS)',
  copy: 'Copy',
  copied: 'Copied',
  tooLongShare: 'Too long to share as a code: cut {n} characters.',
  scan: 'Scan a code',
  scanning: 'Point the camera at a QR code',
  noCamera: 'Camera not available. Paste the code instead.',
  stopScan: 'Stop camera',
  paste: 'Paste a code',
  pasteLabel: 'Code from a friend',
  add: 'Add',
  added: 'Note added',
  known: 'You already have that note',
  badCode: 'That is not a valid note code',
  close: 'Close',
  clearTitle: 'Privacy',
  privacy: 'Notes are kept on your devices. To reach other devices they pass through our relay, which stores nothing and forgets them at once. No accounts, no analytics.',
  helpLines: 'Help lines: 14416 (Tele-MANAS mental health), 112 (emergency)',
  language: 'Language',
  qrAlt: 'QR code of this note',
  inviteLabel: 'Invite link for this room (anyone with it joins your board)',
  inviteQrAlt: 'QR code of the invite link',
  empty_wall: 'No notes in this category yet',
  'expiry.label': 'Expires',
  'expiry.none': 'No expiry',
  'expiry.h1': 'In 1 hour',
  'expiry.h6': 'In 6 hours',
  'expiry.h24': 'In 24 hours',
  'expiry.d7': 'In 7 days',
  'expiry.pick': 'Pick a date and time',
  'expiry.pickLabel': 'Expiry date and time',
  'expiry.left_lt1m': 'expires in less than a minute',
  'expiry.left_m': 'expires in {n} min',
  'expiry.left_h': 'expires in {n} h',
  'expiry.left_d': 'expires in {n} d',
  'expiry.err_invalid': 'Choose a valid date and time',
  'expiry.err_soon': 'Expiry must be at least a minute from now. Earliest: {time}',
  'expiry.err_far': 'Expiry must be within 30 days of posting. Latest: {time}',
  'expiry.expiredCode': 'That note has already expired',
  'expiry.badCode': 'That code has an invalid expiry time',
} as const;
export type SKey = keyof typeof en;

export const te: Partial<Record<SKey, string>> = {
  title: 'సీయాన్స్ బోర్డ్',
  tagline: 'ఒక నోట్ పెట్టండి. ఇది కలిసే ప్రతి పరికరానికి చేరుతుంది, ఖాతా లేదు. నోట్లు ఏమీ నిల్వ చేయని రిలే ద్వారా వెళ్తాయి.',
  compose: 'నోట్ రాయండి',
  composeLabel: 'మీ నోట్ (100 అక్షరాలు)',
  nickname: 'మారుపేరు (ఐచ్ఛికం)',
  post: 'పెట్టండి',
  left: '{n} మిగిలాయి',
  over: '{n} ఎక్కువ',
  empty: 'ముందు ఏదైనా రాయండి',
  cat_h: 'సహాయం',
  cat_n: 'వార్తలు',
  cat_a: 'అడగండి',
  cat_c: 'చాట్',
  all: 'అన్నీ',
  synthetic: 'నమూనా (synthetic)',
  share: 'షేర్',
  remove: 'తొలగించు',
  meet: 'కలవండి',
  copy: 'కాపీ',
  scan: 'కోడ్ స్కాన్',
  paste: 'కోడ్ పేస్ట్',
  add: 'చేర్చు',
  close: 'మూసివేయి',
  privacy: 'నోట్లు మీ పరికరాల్లోనే ఉంటాయి. ఇతర పరికరాలకు చేరడానికి అవి మా రిలే గుండా వెళ్తాయి; అది ఏమీ నిల్వ చేయదు, వెంటనే మరచిపోతుంది. ఖాతాలు లేవు, అనలిటిక్స్ లేదు.',
  helpLines: 'సహాయ నంబర్లు: 14416 (టెలి-మానస్), 112 (అత్యవసరం)',
  noPeers: 'సమీపంలో ఎవరూ లేరు',
  peers: '{n} సమీపంలో',
  'expiry.label': 'గడువు', // TODO(te)
  'expiry.none': 'గడువు లేదు', // TODO(te)
  'expiry.h1': '1 గంటలో', // TODO(te)
  'expiry.h6': '6 గంటల్లో', // TODO(te)
  'expiry.h24': '24 గంటల్లో', // TODO(te)
  'expiry.d7': '7 రోజుల్లో', // TODO(te)
  'expiry.pick': 'తేదీ, సమయం ఎంచుకోండి', // TODO(te)
  'expiry.pickLabel': 'గడువు తేదీ, సమయం', // TODO(te)
  'expiry.left_lt1m': 'ఒక నిమిషం లోపు గడువు ముగుస్తుంది', // TODO(te)
  'expiry.left_m': '{n} నిమిషాల్లో గడువు ముగుస్తుంది', // TODO(te)
  'expiry.left_h': '{n} గంటల్లో గడువు ముగుస్తుంది', // TODO(te)
  'expiry.left_d': '{n} రోజుల్లో గడువు ముగుస్తుంది', // TODO(te)
  'expiry.err_invalid': 'సరైన తేదీ, సమయం ఎంచుకోండి', // TODO(te)
  'expiry.err_soon': 'గడువు ఇప్పటి నుండి కనీసం ఒక నిమిషం ఉండాలి. తొలి సమయం: {time}', // TODO(te)
  'expiry.err_far': 'గడువు పెట్టిన 30 రోజుల లోపే ఉండాలి. చివరి సమయం: {time}', // TODO(te)
  'expiry.expiredCode': 'ఆ నోట్ గడువు ఇప్పటికే ముగిసింది', // TODO(te)
  'expiry.badCode': 'ఆ కోడ్‌లో గడువు సమయం సరైనది కాదు', // TODO(te)
};

/** Seance strings first, then the skeleton's `app.*` strings (lantern, Clear all). */
export function tr(key: SKey | StringKey, lang: Lang, vars: Record<string, string | number> = {}): string {
  const own = key in en ? (lang === 'te' ? te[key as SKey] : undefined) ?? en[key as SKey] : undefined;
  let s = own ?? baseT(key as StringKey, lang);
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
