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

**Files:** `data/portfolio.json` and child `PORTFOLIO.md` coverage.

- [x] Confirm live public inventory differs from registry only by `mts_visual`.
- [x] Add `mts_visual` as standalone visual-library owner without making it normative MTS owner.
- [x] Update machine workstream ownership direction for `anum_docs`, `mts_visual`, `anum_parser`, and `aprover`.
- [x] Add stable `PORTFOLIO.md` backlink to `mts_visual`.
- [x] Prove updated live portfolio/backlink coverage through CI.

### Task 2: Bootstrap contract documentation

**Files:** `AGENTS.md`, `README.md`, `OPERATING_MODEL.md`, `AGENT_PROTOCOL.md`.

- [x] Add one-URL bootstrap algorithm.
- [x] Define public-only firewall and fail-closed behavior.
- [x] Define Role / Session / Checkpoint / Claim / Message responsibilities.
- [x] Define refresh points before writes/lifecycle transitions.
- [x] Define handoff sufficient for a fresh agent that knows only role URL.

### Task 3: Pure agent protocol (TDD)

**Files:** `scripts/agent-protocol.mjs`, `scripts/agent-protocol.test.mjs`.

- [x] RED first on missing production module.
- [x] Strict JSON block parser.
- [x] Finite role/session/message validation.
- [x] Exact public registry/role coverage validation with advisory/enforced modes.
- [x] Deterministic claim collision ordering and public-reference rejection.

### Task 4: Advisory live validation

**Files:** `scripts/validate-agents.mjs`, tests, `portfolio-validate.yml`.

- [x] Filter authenticated inventory to public repositories before projection.
- [x] Collect open protocol Roles/Sessions/Messages read-only.
- [x] Validate structural/public invariants while missing roles remain advisory during bootstrap.
- [x] Run Agent Control Plane tests in portfolio PR CI.

### Task 5: Permanent role rollout

**Files/state:** role template, reconciler, `agent-roles.yml`, GitHub Issues.

- [x] Add tested stable role-issue template.
- [x] Add idempotent reconciler that refuses public/registry drift and duplicates.
- [x] Serialize reconciler workflow; permissions `contents: read`, `issues: write`.
- [ ] Merge bootstrap implementation to `main`; workflow creates missing permanent roles automatically.
- [ ] Verify exact 1:1 role coverage and publish repository → role URL directory.

### Task 6: Hard role coverage

- [x] Unit contract already rejects missing/duplicate/out-of-scope roles in enforcement mode.
- [ ] After Task 5 creates roles, switch live validation invocation from advisory to `--enforce`.
- [ ] Prove complete live 1:1 coverage in CI.

### Task 7: Sessions / checkpoints / messages / claims

- [x] Protocol and finite states documented.
- [x] Claim collision ordering documented/tested.
- [x] Message ACK/resolution semantics documented/tested.
- [x] Role template links central protocol rather than duplicating dynamic state.

### Task 8: Generated agent status

- [ ] Add factual `data/agents.json` / `AGENTS_STATUS.md` after hard role coverage is established.
- [ ] Include role/session/claim/unresolved-message/blocker facts only.
- [ ] Never make generated state a write path.

### Task 9: Real multi-agent acceptance

- [ ] Start three agents from role URL only: upstream, dependent, independent.
- [ ] Prove durable dependency-ready message + ACK.
- [ ] Prove independent work without global lock.
- [ ] Prove deterministic competing claim resolution.
- [ ] Prove handoff/resume with fresh GitHub revalidation.
- [ ] Prove local CI/repo-guard remains integration correctness authority.
- [ ] Prove zero non-public references.

### Task 10: Verification / handoff

- [ ] Full Agent Control Plane CI green.
- [ ] Registry/live validation green.
- [ ] PR exact head stable, behind_by=0, mergeable=true, draft=false.
- [ ] Merge with expected head SHA.
- [ ] Confirm exact new `main` SHA and real post-merge workflows only.
- [ ] Verify role reconciliation and publish role URLs.

## Self-review

- Migration ordering is safe: advisory before initial role creation; hard 1:1 enforcement only after roles exist.
- Strict JSON + Node built-ins avoids new parser dependencies.
- No second manually maintained repository/role registry exists.
- Role rollout is idempotent and serialized instead of requiring 26 manual issue mutations.
- Private/non-public inventory is filtered before Agent Control Plane projection.
