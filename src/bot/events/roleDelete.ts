import { Role } from 'discord.js';
import db from '../../db';

export default async function roleDelete(role: Role) {
  await db.delete()
    .from('app_watcher_mention')
    .where({
      entityId: role.id,
      type: 'role',
    });
}
