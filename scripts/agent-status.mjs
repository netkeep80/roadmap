import { compareClaimPriority } from './agent-protocol.mjs';

const LEASED_SESSION_STATES = new Set(['starting', 'working', 'waiting', 'blocked']);
const BLOCKING_MESSAGE_KINDS = new Set(['blocker', 'dependency-broken']);

function issueUrl(number) {
  return `https://github.com/netkeep80/roadmap/issues/${number}`;
}

function maxTimestamp(...values) {
  const valid = values.filter(Boolean).map((value) => ({ value, time: Date.parse(value) })).filter(({ time }) => Number.isFinite(time));
  if (!valid.length) return null;
  valid.sort((a, b) => a.time - b.time);
  return valid.at(-1).value;
}

function latestCheckpoint(entries = []) {
  const valid = [...entries].filter((entry) => entry && Number.isFinite(Date.parse(entry.created_at ?? '')));
  valid.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return valid.at(-1) ?? null;
}

function safeCheckpointProjection(checkpoint) {
  if (!checkpoint) return null;
  return {
    created_at: checkpoint.created_at,
    state: checkpoint.data.state,
    refs: [...checkpoint.data.refs],
    blockers: [...checkpoint.data.blockers],
    messages: [...checkpoint.data.messages],
  };
}

function roleLookup(roles) {
  return new Map(roles.map((role) => [role.issue_number, role]));
}

function projectSession(session, checkpointsBySession) {
  const checkpoint = latestCheckpoint(checkpointsBySession[session.number] ?? []);
  return {
    issue_number: session.number,
    url: session.html_url ?? issueUrl(session.number),
    role_issue: session.data.role_issue,
    worker_slot: session.data.worker_slot ?? null,
    repository: session.data.repository,
    state: session.data.state,
    claims: [...session.data.claims],
    current_pr: session.data.current_pr,
    blocked_by: [...session.data.blocked_by],
    created_at: session.created_at ?? null,
    updated_at: session.updated_at ?? null,
    last_activity_at: maxTimestamp(session.updated_at, checkpoint?.created_at),
    latest_checkpoint: safeCheckpointProjection(checkpoint),
  };
}

export function buildAgentSnapshot({ checkedAt, roles, sessions, messages, checkpointsBySession = {} }) {
  if (!Array.isArray(roles) || !Array.isArray(sessions) || !Array.isArray(messages)) {
    throw new Error('agent status projection requires role/session/message arrays');
  }

  const sortedRoles = [...roles]
    .map((role) => ({
      repository: role.repository,
      role_issue: role.issue_number,
      url: issueUrl(role.issue_number),
      portfolio_authority: role.portfolio_authority,
    }))
    .sort((a, b) => a.repository.localeCompare(b.repository));

  const roleByIssue = roleLookup(roles);
  const activeSessions = sessions
    .filter((session) => LEASED_SESSION_STATES.has(session?.data?.state))
    .map((session) => projectSession(session, checkpointsBySession))
    .sort((a, b) => a.issue_number - b.issue_number);
  const resumableHandoffs = sessions
    .filter((session) => session?.data?.state === 'handoff')
    .map((session) => projectSession(session, checkpointsBySession))
    .sort((a, b) => a.issue_number - b.issue_number);

  const claimsByRef = new Map();
  for (const session of activeSessions) {
    for (const ref of session.claims) {
      const contenders = claimsByRef.get(ref) ?? [];
      contenders.push(session);
      claimsByRef.set(ref, contenders);
    }
  }
  const claims = [...claimsByRef.entries()]
    .map(([ref, contenders]) => {
      const ordered = [...contenders].sort((left, right) => compareClaimPriority(
        { created_at: left.created_at, number: left.issue_number },
        { created_at: right.created_at, number: right.issue_number },
      ));
      return {
        ref,
        winner_session_issue: ordered[0].issue_number,
        contenders: ordered.map((session) => session.issue_number),
        conflict: ordered.length > 1,
      };
    })
    .sort((a, b) => a.ref.localeCompare(b.ref));

  const unresolvedMessages = messages
    .filter((message) => message?.data?.state !== 'resolved')
    .map((message) => ({
      issue_number: message.number,
      url: message.html_url ?? issueUrl(message.number),
      from_role_issue: message.data.from_role_issue,
      from_repository: roleByIssue.get(message.data.from_role_issue)?.repository ?? null,
      to_role_issues: [...message.data.to_role_issues],
      to_repositories: message.data.to_role_issues.map((roleIssue) => roleByIssue.get(roleIssue)?.repository ?? null),
      kind: message.data.kind,
      requires_ack: message.data.requires_ack,
      state: message.data.state,
      refs: [...message.data.refs],
      created_at: message.created_at ?? null,
      updated_at: message.updated_at ?? null,
    }))
    .sort((a, b) => a.issue_number - b.issue_number);

  const blockers = [];
  for (const session of activeSessions) {
    for (const ref of session.blocked_by) {
      blockers.push({ source: 'session', session_issue: session.issue_number, repository: session.repository, ref });
    }
  }
  for (const message of unresolvedMessages) {
    if (!BLOCKING_MESSAGE_KINDS.has(message.kind)) continue;
    blockers.push({
      source: 'message',
      message_issue: message.issue_number,
      kind: message.kind,
      refs: [...message.refs],
      from_role_issue: message.from_role_issue,
      to_role_issues: [...message.to_role_issues],
    });
  }

  return {
    schema_version: 1,
    checked_at: checkedAt,
    repository_count: sortedRoles.length,
    role_count: sortedRoles.length,
    active_session_count: activeSessions.length,
    resumable_handoff_count: resumableHandoffs.length,
    unresolved_message_count: unresolvedMessages.length,
    claim_count: claims.length,
    claim_collision_count: claims.filter((claim) => claim.conflict).length,
    roles: sortedRoles,
    active_sessions: activeSessions,
    resumable_handoffs: resumableHandoffs,
    claims,
    unresolved_messages: unresolvedMessages,
    blockers,
  };
}

function esc(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function roadmapIssueRef(issue) {
  return `[#${issue}](${issueUrl(issue)})`;
}

function renderSessionTable(lines, sessions, emptyText) {
  if (!sessions.length) {
    lines.push(emptyText);
    return;
  }
  lines.push('| Session | Worker slot | Repository | State | Claims | Current PR | Last activity |', '|---|---|---|---|---|---|---|');
  for (const session of sessions) {
    const slot = session.worker_slot === null ? '—' : `\`${session.worker_slot}\``;
    lines.push(`| [#${session.issue_number}](${session.url}) | ${slot} | \`${esc(session.repository)}\` | \`${session.state}\` | ${session.claims.map((claim) => `\`${esc(claim)}\``).join(', ') || '—'} | ${session.current_pr ? `\`${esc(session.current_pr)}\`` : '—'} | ${session.last_activity_at ?? '—'} |`);
  }
}

export function renderAgentStatus(snapshot) {
  const lines = [
    '# Agent Control Plane status',
    '',
    '> **GENERATED FILE — DO NOT EDIT.** This is a read-only projection of validated public Agent Role / Session / Message / Checkpoint state in GitHub.',
    '',
    `- Last successful agent-state check: **${snapshot.checked_at}**`,
    `- Permanent public roles: **${snapshot.role_count}/${snapshot.repository_count}**`,
    `- Active sessions: **${snapshot.active_session_count}**`,
    `- Resumable handoffs: **${snapshot.resumable_handoff_count ?? 0}**`,
    `- Active claims: **${snapshot.claim_count}**`,
    `- Claim collisions: **${snapshot.claim_collision_count}**`,
    `- Unresolved messages: **${snapshot.unresolved_message_count}**`,
    `- Blockers: **${snapshot.blockers.length}**`,
    '',
    '## Role directory',
    '',
    '| Repository | Permanent role | Authority |',
    '|---|---|---|',
  ];

  for (const role of snapshot.roles) {
    lines.push(`| \`${esc(role.repository)}\` | [#${role.role_issue}](${role.url}) | \`${role.portfolio_authority}\` |`);
  }

  lines.push('', '## Active sessions', '');
  renderSessionTable(lines, snapshot.active_sessions, '_No active protocol sessions._');

  lines.push('', '## Resumable handoffs', '');
  renderSessionTable(lines, snapshot.resumable_handoffs ?? [], '_No resumable handoffs._');

  lines.push('', '## Claims', '');
  if (!snapshot.claims.length) {
    lines.push('_No active claims._');
  } else {
    lines.push('| Claim | Winner | Contenders | State |', '|---|---|---|---|');
    for (const claim of snapshot.claims) {
      const state = claim.conflict ? '⚠️ claim collision' : 'active';
      lines.push(`| \`${esc(claim.ref)}\` | ${roadmapIssueRef(claim.winner_session_issue)} | ${claim.contenders.map((issue) => roadmapIssueRef(issue)).join(', ')} | ${state} |`);
    }
  }

  lines.push('', '## Unresolved messages', '');
  if (!snapshot.unresolved_messages.length) {
    lines.push('_No unresolved protocol messages._');
  } else {
    lines.push('| Message | Kind | From | To | State | ACK |', '|---|---|---|---|---|---|');
    for (const message of snapshot.unresolved_messages) {
      lines.push(`| [#${message.issue_number}](${message.url}) | \`${message.kind}\` | ${roadmapIssueRef(message.from_role_issue)} | ${message.to_role_issues.map((issue) => roadmapIssueRef(issue)).join(', ')} | \`${message.state}\` | ${message.requires_ack ? 'required' : 'no'} |`);
    }
  }

  lines.push('', '## Blockers', '');
  if (!snapshot.blockers.length) {
    lines.push('_No active protocol blockers._');
  } else {
    for (const blocker of snapshot.blockers) {
      if (blocker.source === 'session') {
        lines.push(`- Session ${roadmapIssueRef(blocker.session_issue)} blocked by \`${esc(blocker.ref)}\`.`);
      } else {
        lines.push(`- Message ${roadmapIssueRef(blocker.message_issue)} is unresolved \`${blocker.kind}\`${blocker.refs.length ? `: ${blocker.refs.map((ref) => `\`${esc(ref)}\``).join(', ')}` : '.'}`);
      }
    }
  }

  lines.push('', '## Reading rule', '', '- This snapshot is factual and disposable. It never replaces role/session/message Issues, local repository state, portfolio intent, CI, or repo-guard.', '- `worker_slot` identifies the Scheduled Task slot for observability only; it grants no Role, claim, lease or authority.', '- A `handoff` is resumable context, not a live executor and not a claim holder.', '- Checkpoint free text remains only in the original Session comment and is not duplicated here.', '- Agents must re-read GitHub before every write or lifecycle transition.', '');
  return lines.join('\n');
}
