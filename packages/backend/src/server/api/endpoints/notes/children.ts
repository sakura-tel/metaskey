import $ from 'cafy';
import { ID } from '@/misc/cafy-id';
import define from '../../define';
import { makePaginationQuery } from '../../common/make-pagination-query';
import { generateVisibilityQuery } from '../../common/generate-visibility-query';
import { generateMutedUserQuery } from '../../common/generate-muted-user-query';
import { Brackets } from 'typeorm';
import { Notes } from '@/models/index';
import { generateBlockedUserQuery } from '../../common/generate-block-query';
import { generateMutedInstanceQuery } from '../../common/generate-muted-instance-query';

export const meta = {
	tags: ['notes'],

	requireCredential: false,

	params: {
		noteId: {
			validator: $.type(ID),
		},

		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10,
		},

		sinceId: {
			validator: $.optional.type(ID),
		},

		untilId: {
			validator: $.optional.type(ID),
		},
	},

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'Note',
		},
	},
} as const;

// eslint-disable-next-line import/no-default-export
export default define(meta, async (ps, user) => {
	const query = makePaginationQuery(Notes.createQueryBuilder('note'), ps.sinceId, ps.untilId)
		.andWhere(new Brackets(qb => { qb
			.where(`note.replyId = :noteId`, { noteId: ps.noteId })
			.orWhere(new Brackets(qb => { qb
				.where(`note.renoteId = :noteId`, { noteId: ps.noteId })
				.andWhere(new Brackets(qb => { qb
					.where(`note.text IS NOT NULL`)
					.orWhere(`note.fileIds != '{}'`)
					.orWhere(`note.hasPoll = TRUE`);
				}));
			}));
		}))
		.innerJoinAndSelect('note.user', 'user')
		.leftJoinAndSelect('note.reply', 'reply')
		.leftJoinAndSelect('note.renote', 'renote')
		.leftJoinAndSelect('reply.user', 'replyUser')
		.leftJoinAndSelect('renote.user', 'renoteUser');

	generateVisibilityQuery(query, user);
	if (user) generateMutedUserQuery(query, user);
	if (user && !user.isAdmin && !user.isModerator) {
		generateBlockedUserQuery(query, user);
	}
	if (user) generateMutedInstanceQuery(query, user);

	const notes = await query.take(ps.limit!).getMany();

	return await Notes.packMany(notes, user);
});
