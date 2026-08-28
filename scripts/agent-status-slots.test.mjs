import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  projectWorkerSlots,
  renderAgentStatusWithSlots,
} from './worker-slot-status.mjs';

const marker = (data) => `<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->`;

const roles = [
  { role_issue: 32, repository: 'netkeep80/anum_docs', portfolio_authority: 'propose' },
];

const slotIssue = (slot, overrides = {}) => ({
  number: 384 + slot,
  state: 'open',
  html_url: `https://github.com/netkeep80/roadmap/issues/${384 + slot}`,
  body: marker({
    protocol: 'roadmap-worker-slot/v1',
    slot,
    generation: 0,
    state: 'idle',
    assignment: null,
    current_branch: null,
    current_pr: null,
    progress: null,
    ...overrides,
  }),
});

const proseMention = {
  number: 378,
  state: 'open',
  html_url: 'https://github.com/netkeep80/roadmap/issues/378',
  body: 'Design note: forward workers use roadmap-worker-slot/v1. This is prose, not a protocol object.',
};

test('projects exactly five permanent Worker Slots as bounded current state', () => {
  const issues = [
    proseMention,
    slotIssue(1),
    slotIssue(2),
    slotIssue(3, {
      generation: 7,
      state: 'working',
      assignment: {
        repository: 'netkeep80/anum_docs',
        role_issue: 32,
        work_item: 'netkeep80/anum_docs#959',
      },
      current_branch: 'observatory/959-evidence-traceability',
      current_pr: 'netkeep80/anum_docs#966',
      progress: {
        phase: 'ci',
        next_action: 'Inspect current CI',
      },
    }),
    slotIssue(4),
    slotIssue(5),
  ];

  const slots = projectWorkerSlots({ issues, roles });
  assert.deepEqual(slots.map((entry) => entry.slot), [1, 2, 3, 4, 5]);
  assert.equal(slots[2].issue_number, 387);
  assert.equal(slots[2].assignment.work_item, 'netkeep80/anum_docs#959');
  assert.equal(slots[2].progress.next_action, 'Inspect current CI');
});

test('Slot status fails closed on missing or duplicate permanent slot identity', () => {
  assert.throws(() => projectWorkerSlots({
    issues: [slotIssue(1), slotIssue(2), slotIssue(3), slotIssue(4)],
    roles,
  }), /exactly five|missing/i);

  assert.throws(() => projectWorkerSlots({
    issues: [slotIssue(1), slotIssue(1), slotIssue(2), slotIssue(3), slotIssue(4), slotIssue(5)],
    roles,
  }), /duplicate|slot 1/i);
});

test('renders Worker Slots before historical Agent Status sections', () => {
  const slots = projectWorkerSlots({
    issues: [slotIssue(1), slotIssue(2), slotIssue(3), slotIssue(4), slotIssue(5)],
    roles,
  });
  const legacy = '# Agent Control Plane status\n\n## Active sessions\n\n_No active protocol sessions._\n';
  const markdown = renderAgentStatusWithSlots({ slots, legacyMarkdown: legacy });

  assert.match(markdown, /## Worker Slots/i);
  assert.match(markdown, /\| Slot \| Generation \| State \| Repository \| Work item \| Branch \| PR \| Progress \|/);
  assert.match(markdown, /#385/);
  assert.ok(markdown.indexOf('## Worker Slots') < markdown.indexOf('## Active sessions'));
});

test('Agent Status workflow fetches the Slot status module used by sync runtime', async () => {
  const workflow = await readFile(new URL('../.github/workflows/agent-status.yml', import.meta.url), 'utf8');
  const matches = workflow.match(/scripts\/worker-slot-status\.mjs/g) ?? [];
  assert.ok(matches.length >= 2, 'worker-slot-status.mjs must be both a push trigger input and a fetched runtime file');
});
