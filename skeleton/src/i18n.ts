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
  'app.lastSeenAgo': 'last seen {h}h ago',
  'app.lastSeenNow': 'last seen just now',
  'mandi.title': 'Mandi Ghost',
  'mandi.market': 'Market',
  'mandi.commodity': 'Commodity',
  'mandi.language': 'Language',
  'mandi.min': 'Min',
  'mandi.max': 'Max',
  'mandi.modal': 'Modal',
  'mandi.unit': 'Rs per quintal',
  'mandi.date': 'Price date',
  'mandi.trend': '7-day trend (modal price)',
  'mandi.trendDesc': 'Modal price from {from} to {to}, now {last} Rs per quintal',
  'mandi.noData': 'No price saved for this pair yet',
  'mandi.weather': 'Weather forecast',
  'mandi.weatherNone': 'No weather saved yet',
  'mandi.rain': 'rain {mm} mm',
  'mandi.disclaimer': 'As published by the source, may be stale; not financial advice.',
  'mandi.dropped': '{n} malformed rows were dropped',
  'banner.synthetic': 'Sample data: synthetic, not real prices',
  'banner.live': 'Live data from the source',
  'mandi.openMeteo': 'Weather data by Open-Meteo.com (CC BY 4.0)',
} as const;

export type StringKey = keyof typeof en;
type Table = Record<StringKey, string>;

// TODO(te): native-speaker review. Missing keys fall back to English.
const te: Partial<Table> = {
  'app.offline': 'ఆఫ్‌లైన్: సేవ్ చేసిన డేటా', // TODO: native review
  'app.online': 'ఆన్‌లైన్', // TODO: native review
  'app.clearAll': 'అన్నీ తొలగించు', // TODO: native review
  'app.lastSeenAgo': '{h} గంటల క్రితం చూశారు', // TODO: native review
  'mandi.market': 'మార్కెట్', // TODO: native review
  'mandi.commodity': 'పంట', // TODO: native review
  'mandi.language': 'భాష', // TODO: native review
  'mandi.min': 'కనిష్ఠ', // TODO: native review
  'mandi.max': 'గరిష్ఠ', // TODO: native review
  'mandi.modal': 'సాధారణ', // TODO: native review
  'mandi.trend': '7 రోజుల ధోరణి', // TODO: native review
  'banner.synthetic': 'నమూనా డేటా: నిజమైన ధరలు కావు', // TODO: native review
};

export const STRINGS: { en: Table; te: Partial<Table> } = { en, te };

export function t(key: StringKey, lang: Lang = 'en'): string {
  return STRINGS[lang][key] ?? STRINGS.en[key];
}

/** Keys that still need a translation for `lang`. */
export function missingKeys(lang: Lang): StringKey[] {
  return (Object.keys(en) as StringKey[]).filter((k) => STRINGS[lang][k] === undefined);
}
