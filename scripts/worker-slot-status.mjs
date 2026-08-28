import {
  classifyAgentIssue,
  validateWorkerSlot,
} from './agent-protocol.mjs';

function roleMapFromProjection(roles) {
  if (!Array.isArray(roles)) throw new Error('worker slot status: roles must be an array');
  const map = new Map();
  for (const role of roles) {
    const issue = role?.role_issue ?? role?.issue_number;
    if (!Number.isInteger(issue) || typeof role?.repository !== 'string') {
      throw new Error('worker slot status: invalid role projection');
    }
    map.set(issue, { issue_number: issue, repository: role.repository });
  }
  return map;
}

function slotIssueCandidates(issues) {
  if (!Array.isArray(issues)) throw new Error('worker slot status: issues must be an array');
  return issues.filter((issue) => typeof issue?.body === 'string' && issue.body.includes('roadmap-worker-slot/v1'));
}

export function projectWorkerSlots({ issues, roles }) {
  const roleMap = roleMapFromProjection(roles);
  const bySlot = new Map();

  for (const issue of slotIssueCandidates(issues)) {
    const classified = classifyAgentIssue(issue);
    if (classified.kind !== 'worker-slot') continue;
    const data = validateWorkerSlot(issue, roleMap);
    if (bySlot.has(data.slot)) {
      throw new Error(`worker slot status: duplicate permanent Slot ${data.slot}`);
    }
    bySlot.set(data.slot, {
      issue_number: issue.number,
      url: issue.html_url ?? `https://github.com/netkeep80/roadmap/issues/${issue.number}`,
      slot: data.slot,
      generation: data.generation,
      state: data.state,
      assignment: data.assignment,
      current_branch: data.current_branch,
      current_pr: data.current_pr,
      progress: data.progress,
    });
  }

  if (bySlot.size !== 5 || [1, 2, 3, 4, 5].some((slot) => !bySlot.has(slot))) {
    throw new Error('worker slot status: exactly five permanent Slots 1..5 are required');
  }

  return [1, 2, 3, 4, 5].map((slot) => bySlot.get(slot));
}

function esc(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function progressText(progress) {
  if (!progress) return '—';
  const parts = [];
  if (progress.phase) parts.push(progress.phase);
  if (progress.next_action) parts.push(progress.next_action);
  return parts.length ? esc(parts.join(': ')) : '—';
}

export function renderWorkerSlots(slots) {
  if (!Array.isArray(slots) || slots.length !== 5) {
    throw new Error('worker slot status: five projected Slots are required');
  }
  const lines = [
    '## Worker Slots',
    '',
    '| Slot | Generation | State | Repository | Work item | Branch | PR | Progress |',
    '|---:|---:|---|---|---|---|---|---|',
  ];
  for (const slot of slots) {
    const repository = slot.assignment?.repository ?? null;
    const workItem = slot.assignment?.work_item ?? null;
    lines.push(`| [#${slot.slot}](${slot.url}) | ${slot.generation} | \`${esc(slot.state)}\` | ${repository ? `\`${esc(repository)}\`` : '—'} | ${workItem ? `\`${esc(workItem)}\`` : '—'} | ${slot.current_branch ? `\`${esc(slot.current_branch)}\`` : '—'} | ${slot.current_pr ? `\`${esc(slot.current_pr)}\`` : '—'} | ${progressText(slot.progress)} |`);
  }
  lines.push('', '> Slot state is bounded current operational memory. Target Issue/Git/PR/CI remain execution truth; historical Sessions below are compatibility/history only.');
  return lines.join('\n');
}

export function renderAgentStatusWithSlots({ slots, legacyMarkdown }) {
  if (typeof legacyMarkdown !== 'string' || !legacyMarkdown.trim()) {
    throw new Error('worker slot status: legacy Agent Status markdown is required');
  }
  const section = renderWorkerSlots(slots);
  const firstSection = legacyMarkdown.search(/\n## /);
  if (firstSection < 0) return `${legacyMarkdown.trimEnd()}\n\n${section}\n`;
  return `${legacyMarkdown.slice(0, firstSection)}\n\n${section}${legacyMarkdown.slice(firstSection)}\n`;
}
