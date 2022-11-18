import type { Knex } from 'knex';

const CURRENCIES = [
  {
    name: 'United Arab Emirates Dirham',
    code: 'AED',
    country_code: 'ae',
  },
  {
    code: 'ARS',
    name: 'Argentine Peso',
    country_code: 'ar',
  },
  {
    code: 'AUD',
    name: 'Australian Dollars',
    country_code: 'au',
  },
  {
    code: 'BRL',
    name: 'Brazilian Reals',
    country_code: 'br',
  },
  {
    code: 'CAD',
    name: 'Canadian Dollars',
    country_code: 'ca',
  },
  {
    code: 'CHF',
    name: 'Swiss Francs',
    country_code: 'ch',
  },
  {
    code: 'CLP',
    name: 'Chilean Peso',
    country_code: 'cl',
  },
  {
    code: 'CNY',
    name: 'Chinese Renminbi (yuan)',
    country_code: 'cn',
  },
  {
    code: 'COP',
    name: 'Colombian Peso',
    country_code: 'co',
  },
  {
    code: 'CRC',
    name: 'Costa Rican Colón',
    country_code: 'cr',
  },
  {
    code: 'EUR',
    name: 'European Union Euro',
    country_code: 'at',
  },
  {
    code: 'GBP',
    name: 'United Kingdom Pound',
    country_code: 'gb',
  },
  {
    code: 'HKD',
    name: 'Hong Kong Dollar',
    country_code: 'hk',
  },
  {
    code: 'ILS',
    name: 'Israeli New Shekel',
    country_code: 'il',
  },
  {
    code: 'IDR',
    name: 'Indonesian Rupiah',
    country_code: 'id',
  },
  {
    code: 'INR',
    name: 'Indian Rupee',
    country_code: 'in',
  },
  {
    code: 'JPY',
    name: 'Japanese Yen',
    country_code: 'jp',
  },
  {
    code: 'KRW',
    name: 'South Korean Won',
    country_code: 'kr',
  },
  {
    code: 'KWD',
    name: 'Kuwaiti Dinar',
    country_code: 'kw',
  },
  {
    code: 'KZT',
    name: 'Kazakhstani Tenge',
    country_code: 'kz',
  },
  {
    code: 'MXN',
    name: 'Mexican Peso',
    country_code: 'mx',
  },
  {
    code: 'MYR',
    name: 'Malaysian Ringgit',
    country_code: 'my',
  },
  {
    code: 'NOK',
    name: 'Norwegian Krone',
    country_code: 'no',
  },
  {
    code: 'NZD',
    name: 'New Zealand Dollar',
    country_code: 'nz',
  },
  {
    code: 'PEN',
    name: 'Peruvian Nuevo Sol',
    country_code: 'pe',
  },
  {
    code: 'PHP',
    name: 'Philippine Peso',
    country_code: 'ph',
  },
  {
    code: 'PLN',
    name: 'Polish Złoty',
    country_code: 'pl',
  },
  {
    code: 'QAR',
    name: 'Qatari Riyal',
    country_code: 'qa',
  },
  {
    code: 'RUB',
    name: 'Russian Rouble',
    country_code: 'ru',
  },
  {
    code: 'SAR',
    name: 'Saudi Riyal',
    country_code: 'sa',
  },
  {
    code: 'SGD',
    name: 'Singapore Dollar',
    country_code: 'sg',
  },
  {
    code: 'THB',
    name: 'Thai Baht',
    country_code: 'th',
  },
  {
    code: 'TRY',
    name: 'Turkish Lira',
    country_code: 'tr',
  },
  {
    code: 'TWD',
    name: 'New Taiwan Dollar',
    country_code: 'tw',
  },
  {
    code: 'UAH',
    name: 'Ukrainian Hryvnia',
    country_code: 'ua',
  },
  {
    code: 'USD',
    name: 'United States Dollar',
    country_code: 'us',
  },
  {
    code: 'UYU',
    name: 'Uruguayan Peso',
    country_code: 'uy',
  },
  {
    code: 'VND',
    name: 'Vietnamese Dong',
    country_code: 'vn',
  },
  {
    code: 'ZAR',
    name: 'South African Rand',
    country_code: 'za',
  },
  {
    code: 'CIS-USD',
    name: 'CIS - U.S. Dollar',
    country_code: 'am',
  },
  {
    code: 'SASIA-USD',
    name: 'South Asia U.S. Dollar',
    country_code: 'bd',
  },
];

// eslint-disable-next-line import/prefer-default-export
export function seed(knex: Knex) {
  return knex.count('* AS count')
    .from('currency')
    .first()
    .then((res: any) => {
      if (parseInt(res.count, 10) > 0) {
        return null;
      }

      return knex.insert(CURRENCIES)
        .into('currency');
    });
}
