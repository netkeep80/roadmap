import { compareClaimPriority } from './agent-protocol.mjs';
import { classifySessionLease, validateWorkerPolicy } from './worker-runtime.mjs';

const LEASED_SESSION_STATES = new Set(['starting', 'working', 'waiting', 'blocked']);
const TERMINAL_SESSION_STATES = new Set(['completed', 'abandoned']);
const BLOCKING_MESSAGE_KINDS = new Set(['blocker', 'dependency-broken']);

function issueUrl(number) {
  return `https://github.com/netkeep80/roadmap/issues/${number}`;
}

function pullUrl(repository, number) {
  return `https://github.com/${repository}/pull/${number}`;
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
  const projected = {
    created_at: checkpoint.created_at,
    state: checkpoint.data.state,
    refs: [...checkpoint.data.refs],
    blockers: [...checkpoint.data.blockers],
    messages: [...checkpoint.data.messages],
  };
  if (Object.hasOwn(checkpoint.data, 'current_branch')) {
    projected.current_branch = checkpoint.data.current_branch;
  }
  return projected;
}

function roleLookup(roles) {
  return new Map(roles.map((role) => [role.issue_number, role]));
}

function projectSession(session, checkpointsBySession, lease = null) {
  const checkpoint = latestCheckpoint(checkpointsBySession[session.number] ?? []);
  return {
    issue_number: session.number,
    url: session.html_url ?? issueUrl(session.number),
    role_issue: session.data.role_issue,
    repository: session.data.repository,
    state: session.data.state,
    claims: [...session.data.claims],
    current_branch: session.data.current_branch ?? null,
    current_pr: session.data.current_pr,
    blocked_by: [...session.data.blocked_by],
    created_at: session.created_at ?? null,
    updated_at: session.updated_at ?? null,
    last_activity_at: maxTimestamp(session.updated_at, checkpoint?.created_at),
    latest_checkpoint: safeCheckpointProjection(checkpoint),
    lease_status: lease?.status ?? null,
    heartbeat_at: lease?.heartbeat_at ?? null,
    lease_age_seconds: lease?.age_seconds ?? null,
  };
}

function normalizePrDiagnostics(prDiagnostics = {}) {
  const duplicateWorkItems = Array.isArray(prDiagnostics.duplicate_work_items)
    ? prDiagnostics.duplicate_work_items.map((entry) => ({
      repository: entry.repository,
      work_item: entry.work_item,
      pr_numbers: [...entry.pr_numbers],
    }))
    : [];
  const unreconciledSupersessions = Array.isArray(prDiagnostics.unreconciled_supersessions)
    ? prDiagnostics.unreconciled_supersessions.map((entry) => ({
      repository: entry.repository,
      replacement_pr: entry.replacement_pr,
      superseded_pr: entry.superseded_pr,
    }))
    : [];
  return {
    duplicate_work_items: duplicateWorkItems,
    unreconciled_supersessions: unreconciledSupersessions,
  };
}

function branchKey(branch) {
  if (!branch || typeof branch.repository !== 'string' || typeof branch.name !== 'string') return null;
  return `${branch.repository}\u0000${branch.name}`;
}

function normalizeBranchFacts(branchFactsByRepository = {}) {
  const normalized = new Map();
  for (const [repository, facts] of Object.entries(branchFactsByRepository ?? {})) {
    if (!Array.isArray(facts)) continue;
    const byName = new Map();
    for (const fact of facts) {
      if (!fact || typeof fact.name !== 'string' || !fact.name) continue;
      byName.set(fact.name, {
        name: fact.name,
        sha: typeof fact.sha === 'string' ? fact.sha : null,
      });
    }
    normalized.set(repository, byName);
  }
  return normalized;
}

function computeBranchDrift({ sessions, historicalSessions, checkpointsBySession, branchFactsByRepository }) {
  const liveOwnership = new Set();
  for (const session of sessions) {
    if (TERMINAL_SESSION_STATES.has(session?.data?.state)) continue;
    const key = branchKey(session?.data?.current_branch);
    if (key) liveOwnership.add(key);
  }

  const facts = normalizeBranchFacts(branchFactsByRepository);
  const driftByKey = new Map();
  for (const session of historicalSessions) {
    if (!TERMINAL_SESSION_STATES.has(session?.data?.state)) continue;
    const candidates = new Map();
    for (const checkpoint of checkpointsBySession[session.number] ?? []) {
      const branch = checkpoint?.data?.current_branch;
      const key = branchKey(branch);
      if (key) candidates.set(key, branch);
    }

    for (const [key, branch] of candidates) {
      if (liveOwnership.has(key)) continue;
      const fact = facts.get(branch.repository)?.get(branch.name);
      if (!fact) continue;
      const existing = driftByKey.get(key);
      if (existing && existing.terminal_session_issue > session.number) continue;
      driftByKey.set(key, {
        repository: branch.repository,
        branch: branch.name,
        sha: fact.sha,
        terminal_session_issue: session.number,
        state: 'terminal-branch-residue',
      });
    }
  }

  return [...driftByKey.values()].sort((left, right) => (
    left.repository.localeCompare(right.repository)
    || left.branch.localeCompare(right.branch)
    || left.terminal_session_issue - right.terminal_session_issue
  ));
}

export function buildAgentSnapshot({
  checkedAt,
  roles,
  sessions,
  historicalSessions = sessions,
  messages,
  checkpointsBySession = {},
  workerPolicy,
  prDiagnostics = {},
  branchFactsByRepository = {},
}) {
  if (!Array.isArray(roles) || !Array.isArray(sessions) || !Array.isArray(historicalSessions) || !Array.isArray(messages)) {
    throw new Error('agent status projection requires role/session/historicalSession/message arrays');
  }
  const checkedPolicy = validateWorkerPolicy(workerPolicy);
  const checkedPrDiagnostics = normalizePrDiagnostics(prDiagnostics);

  const sortedRoles = [...roles]
    .map((role) => ({
      repository: role.repository,
      role_issue: role.issue_number,
      url: issueUrl(role.issue_number),
      portfolio_authority: role.portfolio_authority,
    }))
    .sort((a, b) => a.repository.localeCompare(b.repository));

  const roleByIssue = roleLookup(roles);
  const activeSessions = [];
  const staleCandidateSessions = [];
  for (const session of sessions) {
    if (!LEASED_SESSION_STATES.has(session?.data?.state)) continue;
    const checkpoints = checkpointsBySession[session.number] ?? [];
    const lease = classifySessionLease({ session, checkpoints, now: checkedAt, policy: checkedPolicy });
    const projected = projectSession(session, checkpointsBySession, lease);
    if (lease.status === 'live') activeSessions.push(projected);
    else if (lease.status === 'stale_candidate') staleCandidateSessions.push(projected);
  }
  activeSessions.sort((a, b) => a.issue_number - b.issue_number);
  staleCandidateSessions.sort((a, b) => a.issue_number - b.issue_number);

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

  const staleClaims = staleCandidateSessions
    .flatMap((session) => session.claims.map((ref) => ({
      ref,
      session_issue: session.issue_number,
      state: 'recovery-required',
    })))
    .sort((left, right) => left.ref.localeCompare(right.ref) || left.session_issue - right.session_issue);

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

  const branchDrift = computeBranchDrift({
    sessions,
    historicalSessions,
    checkpointsBySession,
    branchFactsByRepository,
  });

  return {
    schema_version: 1,
    checked_at: checkedAt,
    repository_count: sortedRoles.length,
    role_count: sortedRoles.length,
    active_session_count: activeSessions.length,
    stale_candidate_session_count: staleCandidateSessions.length,
    resumable_handoff_count: resumableHandoffs.length,
    unresolved_message_count: unresolvedMessages.length,
    claim_count: claims.length,
    stale_claim_count: staleClaims.length,
    claim_collision_count: claims.filter((claim) => claim.conflict).length,
    duplicate_work_item_pr_count: checkedPrDiagnostics.duplicate_work_items.length,
    unreconciled_supersession_count: checkedPrDiagnostics.unreconciled_supersessions.length,
    branch_drift_count: branchDrift.length,
    roles: sortedRoles,
    active_sessions: activeSessions,
    stale_candidate_sessions: staleCandidateSessions,
    resumable_handoffs: resumableHandoffs,
    claims,
    stale_claims: staleClaims,
    unresolved_messages: unresolvedMessages,
    blockers,
    pr_diagnostics: checkedPrDiagnostics,
    branch_drift: branchDrift,
  };
}

function esc(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function roadmapIssueRef(issue) {
  return `[#${issue}](${issueUrl(issue)})`;
}

function prRef(repository, number) {
  return `[#${number}](${pullUrl(repository, number)})`;
}

function renderSessionTable(lines, sessions, emptyText) {
  if (!sessions.length) {
    lines.push(emptyText);
    return;
  }
  lines.push('| Session | Repository | State | Claims | Current branch | Current PR | Last activity |', '|---|---|---|---|---|---|---|');
  for (const session of sessions) {
    lines.push(`| [#${session.issue_number}](${session.url}) | \`${esc(session.repository)}\` | \`${session.state}\` | ${session.claims.map((claim) => `\`${esc(claim)}\``).join(', ') || '—'} | ${session.current_branch ? `\`${esc(session.current_branch.name)}\`` : '—'} | ${session.current_pr ? `\`${esc(session.current_pr)}\`` : '—'} | ${session.last_activity_at ?? '—'} |`);
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
    `- Stale candidates: **${snapshot.stale_candidate_session_count ?? 0}**`,
    `- Resumable handoffs: **${snapshot.resumable_handoff_count ?? 0}**`,
    `- Active claims: **${snapshot.claim_count}**`,
    `- Stale claims pending recovery: **${snapshot.stale_claim_count ?? 0}**`,
    `- Claim collisions: **${snapshot.claim_collision_count}**`,
    `- Duplicate work-item PRs: **${snapshot.duplicate_work_item_pr_count ?? 0}**`,
    `- Unreconciled supersessions: **${snapshot.unreconciled_supersession_count ?? 0}**`,
    `- Branch drift: **${snapshot.branch_drift_count ?? 0}**`,
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

  lines.push('', '## STALE_CANDIDATE sessions', '');
  renderSessionTable(lines, snapshot.stale_candidate_sessions ?? [], '_No stale candidate sessions._');

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

  lines.push('', '## Stale claims pending recovery', '');
  if (!(snapshot.stale_claims ?? []).length) {
    lines.push('_No stale claims pending recovery._');
  } else {
    lines.push('| Claim | Session | State |', '|---|---|---|');
    for (const claim of snapshot.stale_claims) {
      lines.push(`| \`${esc(claim.ref)}\` | ${roadmapIssueRef(claim.session_issue)} | \`${claim.state}\` |`);
    }
  }

  lines.push('', '## Duplicate work-item PRs', '');
  if (!(snapshot.pr_diagnostics?.duplicate_work_items ?? []).length) {
    lines.push('_No explicit work item has multiple open PRs._');
  } else {
    lines.push('| Repository | Work item | Open PRs |', '|---|---|---|');
    for (const duplicate of snapshot.pr_diagnostics.duplicate_work_items) {
      lines.push(`| \`${esc(duplicate.repository)}\` | \`${esc(duplicate.work_item)}\` | ${duplicate.pr_numbers.map((number) => prRef(duplicate.repository, number)).join(', ')} |`);
    }
  }

  lines.push('', '## Unreconciled supersessions', '');
  if (!(snapshot.pr_diagnostics?.unreconciled_supersessions ?? []).length) {
    lines.push('_No open replacement PR explicitly supersedes another still-open PR._');
  } else {
    lines.push('| Repository | Replacement | Superseded but still open |', '|---|---|---|');
    for (const entry of snapshot.pr_diagnostics.unreconciled_supersessions) {
      lines.push(`| \`${esc(entry.repository)}\` | ${prRef(entry.repository, entry.replacement_pr)} | ${prRef(entry.repository, entry.superseded_pr)} |`);
    }
  }

  lines.push('', '## Branch drift', '');
  if (!(snapshot.branch_drift ?? []).length) {
    lines.push('_No terminal branch ownership residue detected._');
  } else {
    lines.push('| Repository | Branch | SHA | Terminal Session | State |', '|---|---|---|---|---|');
    for (const entry of snapshot.branch_drift) {
      lines.push(`| \`${esc(entry.repository)}\` | \`${esc(entry.branch)}\` | \`${esc(entry.sha ?? 'unknown')}\` | ${roadmapIssueRef(entry.terminal_session_issue)} | \`${entry.state}\` |`);
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

  lines.push('', '## Reading rule', '', '- This snapshot is factual and disposable. It never replaces role/session/message Issues, local repository state, portfolio intent, CI, or repo-guard.', '- A `STALE_CANDIDATE` is not LIVE and its retained claims require complete GitHub revalidation before recovery; they are not automatically free.', '- A `handoff` is resumable context, not a live executor and not a claim holder.', '- `current_branch` is recovery/ownership metadata only; Role + winning Claim remain authority.', '- Branch drift is a reconciliation diagnostic, never deletion authority by itself.', '- Duplicate work-item PR diagnostics use explicit PR work-item declarations; shared changed files alone are not treated as a collision.', '- An unreconciled supersession means a replacement PR explicitly names another PR as superseded while both remain open.', '- Checkpoint free text remains only in the original Session comment and is not duplicated here.', '- Agents must re-read GitHub before every write or lifecycle transition.', '');
  return lines.join('\n');
}
