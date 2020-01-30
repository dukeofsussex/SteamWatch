import Knex = require('knex');

// eslint-disable-next-line import/prefer-default-export
export async function seed(knex: Knex): Promise<any> {
  return knex.select(knex.raw('1 AS `exists`'))
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
