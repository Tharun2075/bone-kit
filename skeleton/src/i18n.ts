/** String table. English is the source; Telugu strings are TODO for native review and fall back to English. */

export const LANGS = ['en', 'te'] as const;
export type Lang = (typeof LANGS)[number];

const en = {
  'app.offline': 'Offline: showing saved data',
  'app.stale': 'Online: data may be out of date',
  'app.online': 'Online: up to date',
  'app.lastSeen': 'Last seen',
  'app.never': 'never',
  'app.clearAll': 'Clear all',
  'app.clearAll.confirm': 'Delete everything stored on this device?',
  'app.clearAll.done': 'All local data deleted',
  'payload.tooLarge': 'Too long for one SMS',
} as const;

export type StringKey = keyof typeof en;
type Table = Record<StringKey, string>;

// TODO(te): native-speaker review. Missing keys fall back to English.
const te: Partial<Table> = {
  'app.offline': 'ఆఫ్‌లైన్: సేవ్ చేసిన డేటా', // TODO: native review
  'app.online': 'ఆన్‌లైన్', // TODO: native review
  'app.clearAll': 'అన్నీ తొలగించు', // TODO: native review
};

export const STRINGS: { en: Table; te: Partial<Table> } = { en, te };

export function t(key: StringKey, lang: Lang = 'en'): string {
  return STRINGS[lang][key] ?? STRINGS.en[key];
}

/** Keys that still need a translation for `lang`. */
export function missingKeys(lang: Lang): StringKey[] {
  return (Object.keys(en) as StringKey[]).filter((k) => STRINGS[lang][k] === undefined);
}
