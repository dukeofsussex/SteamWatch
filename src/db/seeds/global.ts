import Knex = require('knex');

// eslint-disable-next-line import/prefer-default-export
export function seed(knex: Knex) {
  return knex.select('id')
    .from('guild')
    .where('id', 0)
    .first()
    .then(async (result: any) => {
      if (result) {
        return null;
      }

      const usdCurrencyId = await knex.select('id')
        .from('currency')
        .where('abbreviation', 'USD')
        .first()
        .then((currency) => currency.id);

      return knex.insert({
        id: 0,
        name: 'Global',
        currency_id: usdCurrencyId,
        commando_prefix: null,
      }).into('guild');
    });
}
