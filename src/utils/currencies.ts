import { Collection } from 'discord.js';

interface Currency {
  id: string;
  flag: string;
  name: string;
}

const CURRENCIES: Collection<string, Currency> = new Collection([
  ['AED', {
    id: 'ae',
    flag: '🇦🇪',
    name: 'United Arab Emirates Dirham',
  }],
  ['ARS', {
    id: 'ar',
    flag: '🇦🇷',
    name: 'Argentine Peso',
  }],
  ['AUD', {
    id: 'au',
    flag: '🇦🇺',
    name: 'Australian Dollars',
  }],
  ['BRL', {
    id: 'br',
    flag: '🇧🇷',
    name: 'Brazilian Reals',
  }],
  ['CAD', {
    id: 'ca',
    flag: '🇨🇦',
    name: 'Canadian Dollars',
  }],
  ['CHF', {
    id: 'ch',
    flag: '🇨🇭',
    name: 'Swiss Francs',
  }],
  ['CLP', {
    id: 'cl',
    flag: '🇨🇱',
    name: 'Chilean Peso',
  }],
  ['CNY', {
    id: 'cn',
    flag: '🇨🇳',
    name: 'Chinese Renminbi (yuan)',
  }],
  ['COP', {
    id: 'co',
    flag: '🇨🇴',
    name: 'Colombian Peso',
  }],
  ['CRC', {
    id: 'cr',
    flag: '🇨🇷',
    name: 'Costa Rican Colón',
  }],
  ['EUR', {
    id: 'eu',
    flag: '🇪🇺',
    name: 'European Union Euro',
  }],
  ['GBP', {
    id: 'gb',
    flag: '🇬🇧',
    name: 'United Kingdom Pound',
  }],
  ['HKD', {
    id: 'hk',
    flag: '🇭🇰',
    name: 'Hong Kong Dollar',
  }],
  ['ILS', {
    id: 'il',
    flag: '🇮🇱',
    name: 'Israeli New Shekel',
  }],
  ['IDR', {
    id: 'id',
    flag: '🇮🇩',
    name: 'Indonesian Rupiah',
  }],
  ['INR', {
    id: 'in',
    flag: '🇮🇳',
    name: 'Indian Rupee',
  }],
  ['JPY', {
    id: 'jp',
    flag: '🇯🇵',
    name: 'Japanese Yen',
  }],
  ['KRW', {
    id: 'kr',
    flag: '🇰🇷',
    name: 'South Korean Won',
  }],
  ['KWD', {
    id: 'kw',
    flag: '🇰🇼',
    name: 'Kuwaiti Dinar',
  }],
  ['KZT', {
    id: 'kz',
    flag: '🇰🇿',
    name: 'Kazakhstani Tenge',
  }],
  ['MXN', {
    id: 'mx',
    flag: '🇲🇽',
    name: 'Mexican Peso',
  }],
  ['MYR', {
    id: 'my',
    flag: '🇲🇾',
    name: 'Malaysian Ringgit',
  }],
  ['NOK', {
    id: 'no',
    flag: '🇳🇴',
    name: 'Norwegian Krone',
  }],
  ['NZD', {
    id: 'nz',
    flag: '🇳🇿',
    name: 'New Zealand Dollar',
  }],
  ['PEN', {
    id: 'pe',
    flag: '🇵🇪',
    name: 'Peruvian Nuevo Sol',
  }],
  ['PHP', {
    id: 'ph',
    flag: '🇵🇭',
    name: 'Philippine Peso',
  }],
  ['PLN', {
    id: 'pl',
    flag: '🇵🇱',
    name: 'Polish Złoty',
  }],
  ['QAR', {
    id: 'qa',
    flag: '🇶🇦',
    name: 'Qatari Riyal',
  }],
  ['RUB', {
    id: 'ru',
    flag: '🇷🇺',
    name: 'Russian Rouble',
  }],
  ['SAR', {
    id: 'sa',
    flag: '🇸🇦',
    name: 'Saudi Riyal',
  }],
  ['SGD', {
    id: 'sg',
    flag: '🇸🇬',
    name: 'Singapore Dollar',
  }],
  ['THB', {
    id: 'th',
    flag: '🇹🇭',
    name: 'Thai Baht',
  }],
  ['TRY', {
    id: 'tr',
    flag: '🇹🇷',
    name: 'Turkish Lira',
  }],
  ['TWD', {
    id: 'tw',
    flag: '🇹🇼',
    name: 'New Taiwan Dollar',
  }],
  ['UAH', {
    id: 'ua',
    flag: '🇺🇦',
    name: 'Ukrainian Hryvnia',
  }],
  ['USD', {
    id: 'us',
    flag: '🇺🇸',
    name: 'United States Dollar',
  }],
  ['UYU', {
    id: 'uy',
    flag: '🇺🇾',
    name: 'Uruguayan Peso',
  }],
  ['VND', {
    id: 'vn',
    flag: '🇻🇳',
    name: 'Vietnamese Dong',
  }],
  ['ZAR', {
    id: 'za',
    flag: '🇿🇦',
    name: 'South African Rand',
  }],
  ['CIS-USD', {
    id: 'am',
    flag: '🇦🇲',
    name: 'CIS Dollar',
  }],
  ['SASIA-USD', {
    id: 'bd',
    flag: '🇧🇩',
    name: 'South Asia Dollar',
  }],
]);

export default CURRENCIES;
