# Agent Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `netkeep80/roadmap` a public-only coordination center where every public repository has exactly one permanent repository-developer role that an AI agent can enter from one role-issue URL, preserve context, exchange durable messages, and coordinate parallel work.

**Architecture:** Keep `data/portfolio.json` as portfolio intent, local repository issues/PRs as implementation truth, and GitHub Issues in `roadmap` as durable role/session/message state. Add a small parser/validator around finite protocol blocks; do not add a second portfolio registry or merge coordinator. `repo-guard` remains the integration correctness authority.

**Tech Stack:** GitHub Issues/Comments, GitHub Actions, Node.js 24-compatible ESM scripts, built-in `node:test` only. Canonical machine blocks are strict JSON embedded in Markdown, so no YAML parser/runtime dependency is introduced.

**Spec:** `docs/superpowers/specs/2026-08-24-agent-control-plane-design.md`

## Global Constraints

- Scope is public repositories owned by `netkeep80` only.
- Exactly one permanent `repository-developer` role per live public repository.
- One URL bootstrap: the role issue URL is sufficient to start/resume an agent.
- No private repository name, URL, SHA, issue, PR, status, role, or dependency may be serialized into the public control plane.
- `data/portfolio.json` remains the only human-maintained portfolio repository registry.
- Role/session/message identity lives in GitHub Issues; generated mappings are disposable observations.
- Local issues/PRs remain implementation source of truth.
- No second merge queue or validator engine; `repo-guard` remains integration authority where present.
- Existing `portfolio-validate` and `portfolio-sync` behavior must remain backward compatible.
- Hard role-coverage enforcement may be enabled only after complete permanent-role rollout, so migration cannot make every PR red in the middle of bootstrap.

---

### Task 1: Reconcile public portfolio prerequisite

**Files:**
- Modify: `data/portfolio.json`
- Modify as needed: `REPOSITORIES.md`, `ARCHITECTURE.md`, `EXECUTION.md`
- Create in `netkeep80/mts_visual`: `PORTFOLIO.md`

**Interfaces:**
- Consumes: live public-owner inventory and existing portfolio schema v1.
- Produces: registry/backlink coverage where `mts_visual` is a normal public portfolio repository.

- [ ] Confirm live public inventory differs from registry only by `mts_visual`.
- [ ] Add `mts_visual` with its standalone visual-library ownership, dependencies, objective and current gate without making it normative MTS owner.
- [ ] Add/update cross-repository workstream metadata so `anum_docs`, `mts_visual`, `anum_parser`, and `aprover` have explicit ownership direction.
- [ ] Add stable `PORTFOLIO.md` backlink to `mts_visual` through its own PR and pass that repository's real CI/repo-guard gates.
- [ ] Run `node scripts/sync-roadmap.mjs --validate` and `--validate-live` against the reconciled state.

### Task 2: Bootstrap contract documentation

**Files:**
- Create: `AGENTS.md`
- Modify: `README.md`
- Modify: `OPERATING_MODEL.md`

**Interfaces:**
- Consumes: accepted Agent Control Plane spec.
- Produces: stable human/machine bootstrap instructions referenced by every permanent role issue.

- [ ] Add the one-URL bootstrap algorithm.
- [ ] Define the mandatory public-only firewall and fail-closed behavior.
- [ ] Define Role / Session / Checkpoint / Claim / Message responsibilities without dynamic SHA/status duplication.
- [ ] Define when agents must refresh inbox, claims, current main, local issues/PRs, CI and repo-guard state.
- [ ] Define handoff rules sufficient for a fresh agent that only knows the role URL.

### Task 3: Pure agent-protocol parser and validator (TDD)

**Files:**
- Create: `scripts/agent-protocol.mjs`
- Create: `scripts/agent-protocol.test.mjs`

**Interfaces:**
- Produces: `parseProtocolBlock(body)`, `classifyAgentIssue(issue)`, `validateRoleCoverage(registry, publicRepos, issues)`, `validateSession(issue, roleMap)`, `validateMessage(issue, roleMap)`.

- [ ] Write failing tests for a valid strict-JSON role block, malformed block, duplicate role, missing role, repository outside registry, non-public repository, role/repository mismatch, invalid session claim and invalid message target.
- [ ] Run `node --test scripts/agent-protocol.test.mjs` and confirm RED failures are for missing implementation.
- [ ] Implement the minimal parser/validator to pass those tests.
- [ ] Run the targeted tests GREEN.
- [ ] Add tests for deterministic claim collision ordering and public-reference rejection; run GREEN.

### Task 4: Read-only agent state collection and advisory validation (TDD)

**Files:**
- Modify: `scripts/sync-roadmap.mjs`
- Modify: `.github/workflows/portfolio-validate.yml`
- Test: `scripts/agent-protocol.test.mjs`

**Interfaces:**
- Consumes: existing GitHub API helper, public inventory, portfolio registry and open roadmap issues.
- Produces: read-only role/session/message observations and advisory coverage diagnostics before rollout is complete.

- [ ] Write a failing integration-level fixture test for role coverage projection.
- [ ] Add read-only collection of open `roadmap-agent-role/v1`, session and message issues.
- [ ] Compute exact 1:1 coverage diagnostics, public-only refs, same-repository session claims and valid message role endpoints without yet failing solely because rollout has missing roles.
- [ ] Add the new script/test paths to `portfolio-validate` triggers and execute `node --test` before live validation.
- [ ] Preserve existing `--validate`, `--validate-live`, and `--sync` behavior for existing portfolio checks.

### Task 5: Permanent role issue rollout

**Files / GitHub state:**
- Create exactly one open `[Agent Role] <repository> developer` issue per registered public repository in `netkeep80/roadmap`.

**Interfaces:**
- Consumes: `AGENTS.md`, current registry, repository metadata.
- Produces: stable role issue URL for every public repository.

- [ ] Create an Agent Control Plane umbrella issue documenting rollout state and acceptance gates.
- [ ] For each public repository create one role issue with a strict JSON `roadmap-agent-role/v1` block, exact repository identity, role kind, scope, authority, stable links and bootstrap instructions.
- [ ] Do not put current PR/SHA snapshots in role bodies.
- [ ] Verify there are no duplicate roles and no role outside public registry.
- [ ] Record a generated or documented directory of repository → role issue URLs.

### Task 6: Enable hard role coverage gate

**Files:**
- Modify: `scripts/sync-roadmap.mjs`
- Test: `scripts/agent-protocol.test.mjs`

**Interfaces:**
- Consumes: complete Task 5 role rollout.
- Produces: hard invariant `live public repositories == registered public repositories == repositories represented by exactly one active Agent Role issue`.

- [ ] Write a failing test proving missing/duplicate/out-of-scope role coverage is rejected in enforcement mode.
- [ ] Enable hard role-coverage failure only after current live portfolio has complete coverage.
- [ ] Run local parser/validator tests GREEN.
- [ ] Run live validation and prove current coverage is complete.

### Task 7: Sessions, checkpoints, messages and claims become operational

**Files:**
- Create: `AGENT_PROTOCOL.md`
- Extend tests: `scripts/agent-protocol.test.mjs`

**Interfaces:**
- Produces stable strict-JSON copyable protocol blocks for `roadmap-agent-session/v1`, `roadmap-agent-checkpoint/v1`, and `roadmap-agent-message/v1`.

- [ ] Specify finite session and message states exactly as in the design.
- [ ] Specify deterministic claim collision ordering: earlier active session creation wins, then lower issue number.
- [ ] Specify message ACK/resolution rules and when a cross-repo event deserves a roadmap message.
- [ ] Add validation examples/negative vectors to tests.
- [ ] Make every role issue link to this protocol instead of duplicating it.

### Task 8: Generated agent status

**Files:**
- Modify: `scripts/sync-roadmap.mjs`
- Create generated: `data/agents.json`
- Create generated: `AGENTS_STATUS.md`

**Interfaces:**
- Consumes: validated role/session/message observations.
- Produces: factual disposable operational snapshot; never a write path.

- [ ] Write failing renderer/projection tests first.
- [ ] Generate repository → role, active sessions, claims, unresolved messages, blockers and checkpoint timestamps.
- [ ] Ensure generated state serializes only public registered repository references.
- [ ] Extend `portfolio-sync` to update the two generated files atomically with portfolio status.

### Task 9: Real multi-agent acceptance

**GitHub state:**
- Use three public repository roles: one upstream, one dependent, one independent.

- [ ] Start each test agent from role URL only.
- [ ] Prove durable dependency-ready message + ACK.
- [ ] Prove independent role continues without global lock.
- [ ] Prove deterministic competing claim resolution.
- [ ] Prove fresh agent resumes from handoff while re-reading GitHub source of truth.
- [ ] Prove `repo-guard`/local CI remains the only integration correctness path.
- [ ] Prove entire public portfolio has 1:1 role coverage and zero non-public refs.

### Task 10: Final verification and rollout handoff

- [ ] Run `node --test scripts/*.test.mjs`.
- [ ] Run `node scripts/sync-roadmap.mjs --validate`.
- [ ] Run live validation with GitHub token in CI.
- [ ] Confirm implementation PR head SHA, behind_by=0, mergeable=true, draft=false and all real blocking checks green.
- [ ] Merge only with expected head SHA.
- [ ] Confirm exact new `main` SHA and only claim post-merge CI that actually exists for that SHA.
- [ ] Publish the final repository → role issue URL directory so existing agents can immediately enter their roles.

## Self-review

- Spec coverage: one-URL bootstrap, one-public-repo/one-role, public-only firewall, role/session/message separation, claims, generated state, repo-guard boundary, visibility transition and multi-agent acceptance all have explicit tasks.
- Migration ordering: role collection is advisory until Task 5 completes; hard 1:1 enforcement is enabled only in Task 6.
- Dependency discipline: machine blocks use strict JSON and Node built-ins only; no undeclared YAML dependency.
- Registry discipline: no second manually-maintained repository or role registry is introduced.
- No placeholders: every implementation task has an explicit output and verification boundary.
