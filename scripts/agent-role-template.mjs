import { parseProtocolBlock } from './agent-protocol.mjs';

export function roleIssueTitle(repositoryName) {
  if (typeof repositoryName !== 'string' || !repositoryName.length || repositoryName.includes('/')) {
    throw new Error('repositoryName must be a non-empty unqualified repository name');
  }
  return `[Agent Role] ${repositoryName} developer`;
}

export function roleIssueBody(owner, controlRepository, repositoryName) {
  if (owner !== 'netkeep80') throw new Error('Agent Control Plane v1 is scoped to owner netkeep80');
  if (typeof controlRepository !== 'string' || !controlRepository.length) throw new Error('controlRepository is required');
  if (typeof repositoryName !== 'string' || !repositoryName.length || repositoryName.includes('/')) {
    throw new Error('repositoryName must be a non-empty unqualified repository name');
  }

  const repository = `${owner}/${repositoryName}`;
  const authority = repositoryName === controlRepository ? 'coordinate' : 'propose';
  const machine = {
    protocol: 'roadmap-agent-role/v1',
    repository,
    scope: 'public-only',
    state: 'active',
    role_kind: 'repository-developer',
    portfolio_authority: authority,
  };

  return `# Repository developer role: ${repositoryName}\n\nThis permanent issue is the complete bootstrap entrypoint for the **public** repository [\`${repository}\`](https://github.com/${repository}).\n\n<!-- roadmap-agent:start -->\n\`\`\`json\n${JSON.stringify(machine, null, 2)}\n\`\`\`\n<!-- roadmap-agent:end -->\n\n## Start here\n\nIf you are an AI agent and were given only this issue URL, do not ask the human for a pasted checkpoint or separate role name. Enter the role by following, in order:\n\n1. [AGENTS.md](https://github.com/${owner}/${controlRepository}/blob/main/AGENTS.md) — mandatory one-URL bootstrap and safety rules.\n2. [AGENT_PROTOCOL.md](https://github.com/${owner}/${controlRepository}/blob/main/AGENT_PROTOCOL.md) — Role / Session / Checkpoint / Claim / Message protocol.\n3. [Portfolio intent](https://github.com/${owner}/${controlRepository}/blob/main/data/portfolio.json) — current priority, lifecycle, ownership, objective, dependencies and next gate.\n4. [Current observed status](https://github.com/${owner}/${controlRepository}/blob/main/STATUS.md) — fresh GitHub facts.\n5. [Execution order](https://github.com/${owner}/${controlRepository}/blob/main/EXECUTION.md) — cross-repository gates.\n6. [Target repository](https://github.com/${repository}) — local implementation source of truth.\n\nThen inspect active Sessions/Messages for **this role issue number**, re-read the target repository's exact current state, and resume a valid handoff or select the next unclaimed executable local work.\n\n## Stable authority\n\nThis issue identifies the role; it intentionally does **not** copy current SHA, PR status, priority, lifecycle or next gate. Those facts/decisions must always be re-read from GitHub and the central portfolio sources above.\n\nThe role may propose portfolio changes. ${repositoryName === controlRepository ? 'Because this is the control repository role, it also coordinates explicit portfolio transitions, but automation still must not invent priorities or canonical ownership.' : 'It must not silently change portfolio priority, lifecycle, canonical ownership or dependency direction.'}\n\n## Privacy boundary\n\nThis role belongs to the public-only control plane. Do not add non-public repository names, URLs, issues, PRs, SHAs, statuses, dependencies or indirect identifiers to this issue, its Sessions, Messages or generated roadmap state.\n`;
}

export function assertRoleTemplate(repositoryName, body) {
  const parsed = parseProtocolBlock(body);
  if (parsed.repository !== `netkeep80/${repositoryName}`) {
    throw new Error(`role template repository mismatch for ${repositoryName}`);
  }
  return parsed;
}
