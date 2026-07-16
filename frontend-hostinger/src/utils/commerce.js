// Currencies an export sale can realistically be priced in. Ordered so the ones
// Nimbasia actually trades in sit at the top of the picker, with the rest of the
// world's currencies after them.
const CURRENCY_NAMES = {
  INR: "Indian Rupee",
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
  QAR: "Qatari Riyal",
  KWD: "Kuwaiti Dinar",
  BHD: "Bahraini Dinar",
  OMR: "Omani Rial",
  JOD: "Jordanian Dinar",
  ILS: "Israeli Shekel",
  TRY: "Turkish Lira",
  EGP: "Egyptian Pound",
  ZAR: "South African Rand",
  KES: "Kenyan Shilling",
  NGN: "Nigerian Naira",
  MAD: "Moroccan Dirham",
  CNY: "Chinese Yuan",
  JPY: "Japanese Yen",
  KRW: "South Korean Won",
  TWD: "Taiwan Dollar",
  HKD: "Hong Kong Dollar",
  SGD: "Singapore Dollar",
  MYR: "Malaysian Ringgit",
  THB: "Thai Baht",
  IDR: "Indonesian Rupiah",
  PHP: "Philippine Peso",
  VND: "Vietnamese Dong",
  BDT: "Bangladeshi Taka",
  PKR: "Pakistani Rupee",
  LKR: "Sri Lankan Rupee",
  NPR: "Nepalese Rupee",
  AUD: "Australian Dollar",
  NZD: "New Zealand Dollar",
  CAD: "Canadian Dollar",
  CHF: "Swiss Franc",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  PLN: "Polish Zloty",
  CZK: "Czech Koruna",
  HUF: "Hungarian Forint",
  RON: "Romanian Leu",
  RUB: "Russian Ruble",
  UAH: "Ukrainian Hryvnia",
  KZT: "Kazakhstani Tenge",
  BRL: "Brazilian Real",
  MXN: "Mexican Peso",
  ARS: "Argentine Peso",
  CLP: "Chilean Peso",
  COP: "Colombian Peso",
  PEN: "Peruvian Sol"
};

export const CURRENCY_OPTIONS = Object.entries(CURRENCY_NAMES).map(([code, name]) => ({
  value: code,
  label: `${code} - ${name}`
}));

const EUROZONE = [
  "Andorra", "Austria", "Belgium", "Croatia", "Cyprus", "Estonia", "Finland", "France", "Germany", "Greece",
  "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Monaco", "Montenegro", "Netherlands",
  "Portugal", "San Marino", "Slovakia", "Slovenia", "Spain", "Vatican City"
];

// Countries whose own currency is one we can actually invoice in. A country that
// is absent here — because its currency is not convertible, or simply not one we
// hold — falls back to USD, which is how such an export is priced in practice.
// So the suggestion is always a currency on the picker, never an unusable one.
const GULF_AND_MIDDLE_EAST = {
  "United Arab Emirates": "AED",
  "Saudi Arabia": "SAR",
  Qatar: "QAR",
  Kuwait: "KWD",
  Bahrain: "BHD",
  Oman: "OMR",
  Jordan: "JOD",
  Israel: "ILS",
  Turkey: "TRY"
};

const AFRICA = {
  Egypt: "EGP",
  "South Africa": "ZAR",
  Namibia: "ZAR",
  Lesotho: "ZAR",
  Eswatini: "ZAR",
  Kenya: "KES",
  Nigeria: "NGN",
  Morocco: "MAD"
};

const ASIA_PACIFIC = {
  India: "INR",
  China: "CNY",
  Japan: "JPY",
  "Korea South": "KRW",
  Taiwan: "TWD",
  "Hong Kong": "HKD",
  Macao: "HKD",
  Singapore: "SGD",
  Brunei: "SGD",
  Malaysia: "MYR",
  Thailand: "THB",
  Indonesia: "IDR",
  Philippines: "PHP",
  Vietnam: "VND",
  Bangladesh: "BDT",
  Pakistan: "PKR",
  "Sri Lanka": "LKR",
  Nepal: "NPR",
  Bhutan: "INR",
  Australia: "AUD",
  Kiribati: "AUD",
  Nauru: "AUD",
  Tuvalu: "AUD",
  "New Zealand": "NZD"
};

const EUROPE_AND_AMERICAS = {
  "United Kingdom": "GBP",
  "United States": "USD",
  Canada: "CAD",
  Switzerland: "CHF",
  Liechtenstein: "CHF",
  Sweden: "SEK",
  Norway: "NOK",
  Denmark: "DKK",
  Poland: "PLN",
  "Czech Republic": "CZK",
  Czechia: "CZK",
  Hungary: "HUF",
  Romania: "RON",
  Russia: "RUB",
  Ukraine: "UAH",
  Kazakhstan: "KZT",
  Brazil: "BRL",
  Mexico: "MXN",
  Argentina: "ARS",
  Chile: "CLP",
  Colombia: "COP",
  Peru: "PEN"
};

const COUNTRY_CURRENCY = {
  ...Object.fromEntries(EUROZONE.map((country) => [country, "EUR"])),
  ...GULF_AND_MIDDLE_EAST,
  ...AFRICA,
  ...ASIA_PACIFIC,
  ...EUROPE_AND_AMERICAS
};

// The currency an enquiry from this country is most likely to be priced in.
// A suggestion, not a rule: the form still lets sales pick any currency.
export function currencyForCountry(country) {
  const normalized = String(country || "").trim();
  if (!normalized) return "";
  return COUNTRY_CURRENCY[normalized] || "USD";
}

export function formatPriceValue(value) {
  if (value === undefined || value === null || value === "") return "-";

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";

  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
