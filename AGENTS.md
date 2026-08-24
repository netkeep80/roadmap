# Agent bootstrap — one URL protocol

`netkeep80/roadmap` is the public Agent Control Plane for the public repositories owned by `netkeep80`.

## Bootstrap contract

A compatible AI agent may be given only one URL:

```text
https://github.com/netkeep80/roadmap/issues/<role-issue>
```

That permanent issue identifies exactly one public repository-developer role. No pasted chat checkpoint, separate role name, or hidden repository list is required.

After receiving the role issue URL, the agent MUST execute this sequence before repository mutation:

1. Read the complete role issue and parse its `roadmap-agent-role/v1` JSON block.
2. Confirm `scope == "public-only"`, `role_kind == "repository-developer"`, and the repository identity is a public `netkeep80` repository.
3. Read current `main` of this repository, `OPERATING_MODEL.md`, `data/portfolio.json`, generated `data/status.json` / `STATUS.md`, and `EXECUTION.md`.
4. Confirm the role repository is still present in both the live public-owner scope and the central public portfolio registry.
5. Inspect active Agent Sessions for this role, unresolved Agent Messages addressed to this role, and active claims for the target repository.
6. Read the target repository's `PORTFOLIO.md`, README, open issues, open PRs, exact current default-branch SHA, exact workflows, repository policy/repo-guard configuration, and actual blocking checks.
7. Resume a valid handoff if one exists; otherwise select the next executable unclaimed local issue consistent with portfolio lifecycle/priority and local backlog.
8. Create or continue one Agent Session and record durable checkpoints after meaningful gate transitions.
9. Before every repository write or lifecycle/integration transition, refresh the relevant GitHub source-of-truth state. A checkpoint never overrides fresher GitHub facts.
10. Send a durable Agent Message when a change materially crosses repository boundaries, changes dependency readiness, creates a blocker, or requires another role to act.
11. Finish with a checkpoint and mark the Session `handoff` or `completed` as appropriate.

The structured protocols for Role, Session, Checkpoint, Claim, and Message are defined in [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md).

## Public-only privacy firewall

This public control plane is intentionally blind to non-public repositories.

Do not write into roadmap role/session/message/generated state any non-public repository:

- name or URL;
- issue/PR identifier;
- commit SHA;
- lifecycle or status;
- role;
- dependency/blocker;
- indirect placeholder whose only purpose is to describe that repository.

Every repository reference in an agent protocol object must resolve to the current public `data/portfolio.json` registry. Unknown or non-public references fail closed.

If a repository leaves public scope, stop public coordination for that role. Do not add new details from the non-public source. Historical information that was already public cannot be made secret by editing Git history, but it must disappear from current generated/active projections after the explicit portfolio visibility transition.

## Authority boundaries

```text
roadmap
  owns portfolio direction, ownership map, priorities, cross-repo gates,
  agent role identity and cross-repo coordination

local repository
  owns implementation backlog, code-level design, tests and releases

repo-guard / local CI
  owns change and integration correctness where configured

GitHub live state
  owns observed facts
```

An agent may propose a portfolio transition, but must not infer a new priority, canonical owner, lifecycle, or dependency direction merely because an issue closed or a PR merged.

`roadmap` is not a second implementation tracker and is not a second merge queue.

## Work selection and claims

A claim prevents duplicate effort on one local issue/PR; it never locks an entire repository and never grants merge authority.

Before claiming work, read active Sessions for this role. If two active Sessions claim the same local work item, the deterministic winner is:

1. earlier Session issue `created_at`;
2. if timestamps are equal, lower Session issue number.

The losing Session releases the claim and selects another executable item.

## Context discipline

Durable context stores facts and decisions needed for resumption, not hidden reasoning.

Checkpoint content should include only what a fresh agent needs to continue safely:

- completed gates;
- accepted decisions;
- public issue/PR/commit references;
- exact CI/repo-guard evidence when relevant;
- blockers;
- next executable action;
- incoming/outgoing coordination messages.

Never store private chain-of-thought.

## Integration discipline

Agent Control Plane coordination does not weaken repository gates.

If a target repository has repo-guard, follow its machine-readable lifecycle / `next_action` rather than inventing another merge/rebase path. If it does not, follow the actual repository workflows and merge rules that exist; never claim a check or protection surface that is absent.
