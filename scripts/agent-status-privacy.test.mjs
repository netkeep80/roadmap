import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAgentSnapshot } from './agent-status.mjs';

test('generated status does not duplicate free-form checkpoint handoff text', () => {
  const snapshot = buildAgentSnapshot({
    checkedAt: '2026-08-24T10:00:00Z',
    roles: [
      { issue_number: 45, repository: 'netkeep80/mts_visual', portfolio_authority: 'propose' },
    ],
    sessions: [
      {
        number: 101,
        html_url: 'https://github.com/netkeep80/roadmap/issues/101',
        created_at: '2026-08-24T09:00:00Z',
        updated_at: '2026-08-24T09:10:00Z',
        data: {
          role_issue: 45,
          repository: 'netkeep80/mts_visual',
          state: 'handoff',
          claims: [],
          current_pr: null,
          blocked_by: [],
        },
      },
    ],
    messages: [],
    checkpointsBySession: {
      101: [
        {
          created_at: '2026-08-24T09:15:00Z',
          data: {
            state: 'handoff',
            completed: ['free form should remain only in live comment'],
            refs: ['netkeep80/mts_visual#9'],
            blockers: [],
            next: ['another free-form handoff instruction'],
            messages: [],
          },
        },
      ],
    },
  });

  const checkpoint = snapshot.active_sessions[0].latest_checkpoint;
  assert.deepEqual(checkpoint, {
    created_at: '2026-08-24T09:15:00Z',
    state: 'handoff',
    refs: ['netkeep80/mts_visual#9'],
    blockers: [],
    messages: [],
  });
  assert.equal(JSON.stringify(snapshot).includes('free form should remain only in live comment'), false);
  assert.equal(JSON.stringify(snapshot).includes('another free-form handoff instruction'), false);
});
