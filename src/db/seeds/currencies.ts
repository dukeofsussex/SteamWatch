import Knex = require('knex');

const CURRENCIES = [
  {
    name: 'United Arab Emirates Dirham',
    abbreviation: 'AED',
    country_code: 'ae',
    flag: '\ud83c\udde6\ud83c\uddea',
  },
  {
    abbreviation: 'ARS',
    name: 'Argentine Peso',
    country_code: 'ae',
    flag: '\ud83c\udde6\ud83c\uddf7',
  },
  {
    abbreviation: 'AUD',
    name: 'Australian Dollars',
    country_code: 'au',
    flag: '\ud83c\udde6\ud83c\uddfa',
  },
  {
    abbreviation: 'BRL',
    name: 'Brazilian Reals',
    country_code: 'br',
    flag: '\ud83c\udde7\ud83c\uddf7',
  },
  {
    abbreviation: 'CAD',
    name: 'Canadian Dollars',
    country_code: 'ca',
    flag: '\ud83c\udde8\ud83c\udde6',
  },
  {
    abbreviation: 'CHF',
    name: 'Swiss Francs',
    country_code: 'ch',
    flag: '\ud83c\udde8\ud83c\udded',
  },
  {
    abbreviation: 'CLP',
    name: 'Chilean Peso',
    country_code: 'cl',
    flag: '\ud83c\udde8\ud83c\uddf1',
  },
  {
    abbreviation: 'CNY',
    name: 'Chinese Renminbi (yuan)',
    country_code: 'cn',
    flag: '\ud83c\udde8\ud83c\uddf3',
  },
  {
    abbreviation: 'COP',
    name: 'Colombian Peso',
    country_code: 'co',
    flag: '\ud83c\udde8\ud83c\uddf4',
  },
  {
    abbreviation: 'CRC',
    name: 'Costa Rican Colón',
    country_code: 'cr',
    flag: '\ud83c\udde8\ud83c\uddf7',
  },
  {
    abbreviation: 'EUR',
    name: 'European Union Euro',
    country_code: 'at',
    flag: '\ud83c\uddea\ud83c\uddfa',
  },
  {
    abbreviation: 'GBP',
    name: 'United Kingdom Pound',
    country_code: 'gb',
    flag: '\ud83c\uddec\ud83c\udde7',
  },
  {
    abbreviation: 'HKD',
    name: 'Hong Kong Dollar',
    country_code: 'hk',
    flag: '\ud83c\udded\ud83c\uddf0',
  },
  {
    abbreviation: 'ILS',
    name: 'Israeli New Shekel',
    country_code: 'il',
    flag: '\ud83c\uddee\ud83c\uddf1',
  },
  {
    abbreviation: 'IDR',
    name: 'Indonesian Rupiah',
    country_code: 'id',
    flag: '\ud83c\uddee\ud83c\udde9',
  },
  {
    abbreviation: 'INR',
    name: 'Indian Rupee',
    country_code: 'in',
    flag: '\ud83c\uddee\ud83c\uddf3',
  },
  {
    abbreviation: 'JPY',
    name: 'Japanese Yen',
    country_code: 'jp',
    flag: '\ud83c\uddef\ud83c\uddf5',
  },
  {
    abbreviation: 'KRW',
    name: 'South Korean Won',
    country_code: 'kr',
    flag: '\ud83c\uddf0\ud83c\uddf7',
  },
  {
    abbreviation: 'KWD',
    name: 'Kuwaiti Dinar',
    country_code: 'kw',
    flag: '\ud83c\uddf0\ud83c\uddfc',
  },
  {
    abbreviation: 'KZT',
    name: 'Kazakhstani Tenge',
    country_code: 'kz',
    flag: '\ud83c\uddf0\ud83c\uddff',
  },
  {
    abbreviation: 'MXN',
    name: 'Mexican Peso',
    country_code: 'mx',
    flag: '\ud83c\uddf2\ud83c\uddfd',
  },
  {
    abbreviation: 'MYR',
    name: 'Malaysian Ringgit',
    country_code: 'my',
    flag: '\ud83c\uddf2\ud83c\uddfe',
  },
  {
    abbreviation: 'NOK',
    name: 'Norwegian Krone',
    country_code: 'no',
    flag: '\ud83c\uddf3\ud83c\uddf4',
  },
  {
    abbreviation: 'NZD',
    name: 'New Zealand Dollar',
    country_code: 'nz',
    flag: '\ud83c\uddf3\ud83c\uddff',
  },
  {
    abbreviation: 'PEN',
    name: 'Peruvian Nuevo Sol',
    country_code: 'pe',
    flag: '\ud83c\uddf5\ud83c\uddea',
  },
  {
    abbreviation: 'PHP',
    name: 'Philippine Peso',
    country_code: 'ph',
    flag: '\ud83c\uddf5\ud83c\udded',
  },
  {
    abbreviation: 'PLN',
    name: 'Polish Złoty',
    country_code: 'pl',
    flag: '\ud83c\uddf5\ud83c\uddf1',
  },
  {
    abbreviation: 'QAR',
    name: 'Qatari Riyal',
    country_code: 'qa',
    flag: '\ud83c\uddf6\ud83c\udde6',
  },
  {
    abbreviation: 'RUB',
    name: 'Russian Rouble',
    country_code: 'ru',
    flag: '\ud83c\uddf7\ud83c\uddfa',
  },
  {
    abbreviation: 'SAR',
    name: 'Saudi Riyal',
    country_code: 'sa',
    flag: '\ud83c\uddf8\ud83c\udde6',
  },
  {
    abbreviation: 'SGD',
    name: 'Singapore Dollar',
    country_code: 'sg',
    flag: '\ud83c\uddf8\ud83c\uddec',
  },
  {
    abbreviation: 'THB',
    name: 'Thai Baht',
    country_code: 'th',
    flag: '\ud83c\uddf9\ud83c\udded',
  },
  {
    abbreviation: 'TRY',
    name: 'Turkish Lira',
    country_code: 'tr',
    flag: '\ud83c\uddf9\ud83c\uddf7',
  },
  {
    abbreviation: 'TWD',
    name: 'New Taiwan Dollar',
    country_code: 'tw',
    flag: '\ud83c\uddf9\ud83c\uddfc',
  },
  {
    abbreviation: 'UAH',
    name: 'Ukrainian Hryvnia',
    country_code: 'ua',
    flag: '\ud83c\uddfa\ud83c\udde6',
  },
  {
    abbreviation: 'USD',
    name: 'United States Dollar',
    country_code: 'us',
    flag: '\ud83c\uddfa\ud83c\uddf8',
  },
  {
    abbreviation: 'UYU',
    name: 'Uruguayan Peso',
    country_code: 'uy',
    flag: '\ud83c\uddfa\ud83c\uddfe',
  },
  {
    abbreviation: 'VND',
    name: 'Vietnamese Dong',
    country_code: 'vn',
    flag: '\ud83c\uddfb\ud83c\uddf3',
  },
  {
    abbreviation: 'ZAR',
    name: 'South African Rand',
    country_code: 'za',
    flag: '\ud83c\uddff\ud83c\udde6',
  },
  {
    abbreviation: 'CIS-USD',
    name: 'CIS Dollar',
    country_code: 'am',
    flag: '\ud83c\udde6\ud83c\uddf2',
  },
  {
    abbreviation: 'SASIA-USD',
    name: 'South Asia Dollar',
    country_code: 'bd',
    flag: '\ud83c\udde7\ud83c\udde9',
  },
];

// eslint-disable-next-line import/prefer-default-export
export async function seed(knex: Knex): Promise<any> {
  return knex.count('* AS count')
    .from('currency')
    .first()
    .then((result: any) => {
      if (result.count > 0) {
        return null;
      }

      return knex.insert(CURRENCIES)
        .into('currency');
    });
}
