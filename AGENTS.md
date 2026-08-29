# Agent bootstrap

`netkeep80/roadmap` is the public portfolio control plane for public repositories owned by `netkeep80`.

There are now two deliberately separate automation modes:

1. **interactive/reasoning-capable repository agents** — may perform engineering work under an explicit repository Role and local repository rules;
2. **scheduled observers** — narrow factual observers defined in [`SCHEDULED_OBSERVERS.md`](SCHEDULED_OBSERVERS.md); they never perform target-repository engineering work.

Do not mix these modes.

## Interactive repository-agent entrypoint

A reasoning-capable agent may be given one permanent Role URL:

```text
https://github.com/netkeep80/roadmap/issues/<role-issue>
```

The Role identifies exactly one registered public repository.

Before any target-repository mutation:

1. read the complete Role issue and validate its `roadmap-agent-role/v1` block;
2. read current `data/portfolio.json`, `data/status.json`, `EXECUTION.md`, and relevant roadmap decisions through the GitHub API;
3. read the target repository's current default branch, relevant issues/PRs, actual CI, branch protection, and repo policy;
4. select only an **explicit** executable local work item or a genuine resumable handoff;
5. if concurrent durable coordination is useful, create/continue a Session and Claim under [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md);
6. after creating a claiming Session, refresh competing current Claims before the first target write;
7. before every material repository write or lifecycle transition, re-read the relevant live GitHub state;
8. obey the target repository's actual CI/repo-guard/integration rules;
9. store only resumable public facts and decisions in durable coordination state, never private reasoning.

No explicit executable work means no work. Do not invent housekeeping, speculative backlog, architecture changes, dependency upgrades, or successor tasks merely to remain active.

## Scheduled observers

Scheduled automation starts from [`SCHEDULED_OBSERVERS.md`](SCHEDULED_OBSERVERS.md), **not** from repository-developer Roles and not from the historical Session/Claim scheduler machinery.

Scheduled observers:

- never select engineering work;
- never create a developer Session or Claim;
- never modify target repositories;
- never merge/rebase/fix/migrate anything;
- write only the fixed roadmap surface assigned to their role;
- escalate ambiguity with `needs_reasoning` and stop.

The former `WORKER_SLOT` / fixed Worker Slot / self-dispatch model is retired. Historical Worker Slot issues #385-#389 remain audit evidence only.

## API-only control-plane access

Roadmap coordination/orientation is read through GitHub APIs. Do not clone `netkeep80/roadmap` merely to discover portfolio state or read coordination metadata.

Checkout `roadmap` only when an interactive reasoning-capable agent is actually implementing explicit work in `netkeep80/roadmap` itself.

## Public-only privacy boundary

The public control plane must not contain non-public repository names, URLs, issues, PRs, SHAs, dependencies, blockers, or indirect identifiers.

Every structured repository reference must resolve to the current public registry. Unknown or out-of-scope references fail closed.

## Authority boundaries

```text
data/portfolio.json
  explicit portfolio intent and decisions

GitHub live public state
  observed facts

STATUS.md + data/status.json
  deterministic generated factual projection

local repository issues/code/tests
  implementation authority

local CI / repo-guard / branch protection
  integration authority

Role / Session / Checkpoint / Message issues
  optional durable coordination for interactive reasoning agents

scheduled observer issues
  bounded diagnostics only
```

Observed facts do not automatically change portfolio priority, lifecycle, ownership, dependency direction, or architecture.

## Roadmap Role #49

`netkeep80/roadmap` is itself a normal managed repository. Interactive roadmap implementation is performed through permanent roadmap developer Role #49 for explicit roadmap work.

`portfolio_authority=coordinate` does not authorize speculative strategy invention.

Scheduled observers are not Role #49 developers and cannot use #49 as a path to escape their narrow write boundary.

## Durable coordination lifecycle

Interactive/manual coordination may use the protocol in [`AGENT_PROTOCOL.md`](AGENT_PROTOCOL.md):

```text
Role      = stable repository identity
Session   = one durable execution context
Claim     = duplicate-work coordination for one explicit item
Checkpoint= resumable public evidence/context
Message   = real cross-repository coordination
```

Closed historical protocol issues remain audit evidence. They are not scheduled-observer runtime state.
