// Constants shared by make-synthetic.mjs and fetch-snapshot.mjs.
export const SOURCES = ['data.gov.in / Agmarknet (Ministry of Agriculture and Farmers Welfare)', 'Open-Meteo.com'];
export const LICENCES = ['Open Government Data Licence - India (data.gov.in)', 'Open-Meteo weather data: CC BY 4.0'];
export const ATTRIBUTION = 'Prices: data.gov.in / Agmarknet, Open Government Data Licence - India. Weather data by Open-Meteo.com (CC BY 4.0).';
export const MARKETS = {
  Kurnool: { state: 'Andhra Pradesh', district: 'Kurnool', lat: 15.83, lon: 78.04 },
  Warangal: { state: 'Telangana', district: 'Warangal', lat: 17.97, lon: 79.6 },
  Nizamabad: { state: 'Telangana', district: 'Nizamabad', lat: 18.67, lon: 78.09 },
  Guntur: { state: 'Andhra Pradesh', district: 'Guntur', lat: 16.31, lon: 80.44 },
};
// Base modal price, Rs per quintal (rough orders of magnitude, used only for the synthetic sample).
export const COMMODITIES = { Tomato: 2200, Onion: 1800, Maize: 2100, Paddy: 2300, Cotton: 6800 };
