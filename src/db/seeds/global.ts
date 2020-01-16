// eslint-disable-next-line no-unused-vars
import Knex = require('knex');

// eslint-disable-next-line import/prefer-default-export
export async function seed(knex: Knex): Promise<any> {
  return knex.select(knex.raw('1 AS `exists`'))
    .from('guild')
    .where('id', 0)
    .first()
    .then((result: any) => {
      if (result.exists) {
        return null;
      }

      return knex.insert({ id: 0, currency: '', commandoSettings: '{}' })
        .into('guild');
    });
}
