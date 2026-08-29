# Portfolio decisions

Compact journal of accepted portfolio-level decisions. Detailed historical discussion remains in Git history and linked issues/PRs.

## D-001 — One canonical owner per layer

**Status:** accepted  
**Date:** 2026-08-09

A semantic/storage/runtime/presentation responsibility has one canonical forward owner. Compatibility implementations require a named removal gate; Git is the archive.

## D-002 — Portfolio is gate-driven, not calendar-driven

**Status:** accepted  
**Date:** 2026-08-09

Transitions happen after explicit evidence such as an accepted upstream contract, conformance, consumer migration, independent validation, safety evidence, or explicit research decision.

## D-003 — Persistent associative runtime before custom hardware

**Status:** accepted as research direction  
**Date:** 2026-08-09

Preferred sequence:

```text
software semantics
-> persistent runtime
-> realistic workload
-> associative scheduler / self-hosting
-> profiling
-> accelerator
-> only then possible custom hardware
```

Hardware specialization must preserve the same observable semantic contract.

## D-004 — `roadmap` is the portfolio control plane

**Status:** accepted  
**Date:** 2026-08-09

`data/portfolio.json` owns explicit portfolio intent. GitHub-derived `STATUS.md` / `data/status.json` own generated observed facts. Local repositories own implementation. Automation may update facts but not silently rewrite portfolio decisions.

## D-005 — MTS foundation reset v2 ordering

**Status:** superseded by later accepted MTS baselines; historical  
**Date:** 2026-08-09

The then-current MTS migration was reordered around the foundation reset before downstream production migration. This entry remains only to explain historical issue ordering.

## D-006 — Child backlinks are a live governance invariant

**Status:** accepted  
**Date:** 2026-08-09

Registered child repositories maintain the required discoverable root portfolio backlink. Coverage is validated dynamically; no fixed repository count is governance authority.

## D-007 — Accepted MTS baseline governs downstream consumers

**Status:** accepted principle; exact current MTS version is read from `anum_docs`/portfolio state  
**Date:** 2026-08-12

Downstream consumers exact-pin accepted upstream semantic/proof authority. Research candidates do not mutate an accepted release retroactively, and consumers do not create local alternative MTS semantics.

## D-008 — Public Agent Control Plane uses one permanent repository Role

**Status:** accepted  
**Date:** 2026-08-24

Each registered public repository has one permanent `[Agent Role] <repository> developer` issue. A Role URL is stable bootstrap identity for reasoning-capable interactive/manual agents. Optional Session/Checkpoint/Claim/Message state stores durable public coordination facts, never private chain-of-thought.

Public-only invariant:

```text
live public owner scope
== public portfolio registry
== repositories represented by active Agent Roles
```

## D-009 — Autonomous scheduled developer pool

**Status:** superseded by D-010  
**Date:** 2026-08-26

Historical decision: scheduled agents were allowed to discover/claim/continue implementation work through Session/Claim and later fixed Worker Slot coordination.

Production use showed that shallow scheduled reasoning was not reliable enough for architecture-sensitive or implementation-sensitive engineering work. The coordination machinery also grew disproportionately around collision, lease, handoff, branch and status management.

The historical model remains in Git history and retired issues but is no longer a forward execution architecture.

## D-010 — Scheduled automation is fixed-role observation, not development

**Status:** accepted  
**Date:** 2026-08-29  
**Related:** roadmap #415, #416-#421

Scheduled models are restricted to five non-overlapping service roles:

```text
Roadmap Reconciler
CI Sentinel
PR Watchdog
Dependency Watchdog
Portfolio Auditor / Reasoning Queue
```

Decision:

- scheduled agents never modify target repositories;
- scheduled agents never select engineering work, implement fixes, migrate consumers, merge/rebase PRs, change architecture, or invent successor work;
- the actual factual roadmap update is deterministic `portfolio-sync`, running hourly and writing only `STATUS.md` / `data/status.json`;
- CI Sentinel writes only issue #416;
- PR Watchdog writes only issue #417;
- Dependency Watchdog writes only issue #418;
- Portfolio Auditor writes only issue #419 and escalates ambiguity with `needs_reasoning`;
- Roadmap Reconciler role #421 verifies the deterministic sync path and never hand-authors generated portfolio state;
- `roadmap-observer/v1` is the bounded diagnostic snapshot contract;
- Worker Slots #385-#389, `WORKER_SLOT`, self-dispatch, scheduled developer Sessions/Claims, generated worker status, and the autonomous worker runtime are retired;
- historical Agent Role / Session / Checkpoint / Claim / Message evidence remains readable for interactive/manual use and audit.

Core invariant:

```text
scheduled observer
-> observe fact
-> classify evidence
-> publish only its fixed roadmap surface
-> stop
```

Engineering decisions and implementation belong to reasoning-capable interactive agents or humans.

## Adding the next decision

A new entry should state:

- identifier `D-NNN`;
- status (`proposed`, `accepted`, `superseded`, `rejected`);
- date;
- related issue/PR when useful;
- concise decision;
- consequences;
- superseding decision when applicable.
