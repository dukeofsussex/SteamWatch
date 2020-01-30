import Knex = require('knex');

const CURRENCIES = [
  {
    name: 'United Arab Emirates Dirham',
    abbreviation: 'AED',
  },
  {
    abbreviation: 'ARS',
    name: 'Argentine Peso',
  },
  {
    abbreviation: 'AUD',
    name: 'Australian Dollars',
  },
  {
    abbreviation: 'BRL',
    name: 'Brazilian Reals',
  },
  {
    abbreviation: 'CAD',
    name: 'Canadian Dollars',
  },
  {
    abbreviation: 'CHF',
    name: 'Swiss Francs',
  },
  {
    abbreviation: 'CLP',
    name: 'Chilean Peso',
  },
  {
    abbreviation: 'CNY',
    name: 'Chinese Renminbi (yuan)',
  },
  {
    abbreviation: 'COP',
    name: 'Colombian Peso',
  },
  {
    abbreviation: 'CRC',
    name: 'Costa Rican Colón',
  },
  {
    abbreviation: 'EUR',
    name: 'European Union Euro',
  },
  {
    abbreviation: 'GBP',
    name: 'United Kingdom Pound',
  },
  {
    abbreviation: 'HKD',
    name: 'Hong Kong Dollar',
  },
  {
    abbreviation: 'ILS',
    name: 'Israeli New Shekel',
  },
  {
    abbreviation: 'IDR',
    name: 'Indonesian Rupiah',
  },
  {
    abbreviation: 'INR',
    name: 'Indian Rupee',
  },
  {
    abbreviation: 'JPY',
    name: 'Japanese Yen',
  },
  {
    abbreviation: 'KRW',
    name: 'South Korean Won',
  },
  {
    abbreviation: 'KWD',
    name: 'Kuwaiti Dinar',
  },
  {
    abbreviation: 'KZT',
    name: 'Kazakhstani Tenge',
  },
  {
    abbreviation: 'MXN',
    name: 'Mexican Peso',
  },
  {
    abbreviation: 'MYR',
    name: 'Malaysian Ringgit',
  },
  {
    abbreviation: 'NOK',
    name: 'Norwegian Krone',
  },
  {
    abbreviation: 'NZD',
    name: 'New Zealand Dollar',
  },
  {
    abbreviation: 'PEN',
    name: 'Peruvian Nuevo Sol',
  },
  {
    abbreviation: 'PHP',
    name: 'Philippine Peso',
  },
  {
    abbreviation: 'PLN',
    name: 'Polish Złoty',
  },
  {
    abbreviation: 'QAR',
    name: 'Qatari Riyal',
  },
  {
    abbreviation: 'RUB',
    name: 'Russian Rouble',
  },
  {
    abbreviation: 'SAR',
    name: 'Saudi Riyal',
  },
  {
    abbreviation: 'SGD',
    name: 'Singapore Dollar',
  },
  {
    abbreviation: 'THB',
    name: 'Thai Baht',
  },
  {
    abbreviation: 'TRY',
    name: 'Turkish Lira',
  },
  {
    abbreviation: 'TWD',
    name: 'New Taiwan Dollar',
  },
  {
    abbreviation: 'UAH',
    name: 'Ukrainian Hryvnia',
  },
  {
    abbreviation: 'USD',
    name: 'United States Dollar',
  },
  {
    abbreviation: 'UYU',
    name: 'Uruguayan Peso',
  },
  {
    abbreviation: 'VND',
    name: 'Vietnamese Dong',
  },
  {
    abbreviation: 'ZAR',
    name: 'South African Rand',
  },
  {
    abbreviation: 'CIS-USD',
    name: 'CIS Dollar',
  },
  {
    abbreviation: 'SASIA-USD',
    name: 'South Asia Dollar',
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
