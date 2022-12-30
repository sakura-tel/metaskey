import { Users } from '@/models/index';
import $ from 'cafy';
import define from '../../define';
import { createDeleteAccountJob } from '@/queue';
import { ID } from '@/misc/cafy-id';
import { doPostSuspend } from '@/services/suspend-user';
import { publishUserEvent } from '@/services/stream';
import { insertModerationLog } from '@/services/insert-moderation-log';

export const meta = {
	tags: ['admin'],

  requireCredential: true,
	requireModerator: true,

  params: {
		userId: {
			validator: $.type(ID),
			desc: {
				'ja-JP': '対象のユーザーID',
				'en-US': 'The user ID which you want to delete'
			}
		},
	}
};

export default define(meta, async (ps, me) => {
	const user = await Users.findOne(ps.userId as string);

  if (user == null) {
    throw new Error('user not found');
  }

  if (user.isAdmin) {
    throw new Error('cannot delete admin');
  }

  if (user.isModerator) {
    throw new Error('cannot delete moderator');
  }

	if (user.isDeleted) {
		return;
	}

  // 物理削除する前にDelete activityを送信する
  await doPostSuspend(user).catch(e => {});

  createDeleteAccountJob(user);

  await Users.update(user.id, {
    isDeleted: true,
  });

  insertModerationLog(me, 'delete', {
		targetId: user.id,
	});

  // Terminate streaming
	publishUserEvent(user.id, 'terminate', {});
});
