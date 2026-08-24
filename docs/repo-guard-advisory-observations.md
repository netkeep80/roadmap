# roadmap repo-guard advisory observations

This log records evidence for roadmap#65 G1. It is observational only: it does not change merge authority, branch protection, portfolio semantics, Agent Control Plane routing, or scheduled-worker selection.

## Promotion rule

Advisory may be considered for blocking only after real roadmap pull requests show useful diagnostics with no material worker-pool serialization or false-positive burden. `Portfolio validate` remains the roadmap-specific semantic gate.

## Observations

### Bootstrap — PR #67

- the trusted base branch had no `repo-policy.json` yet;
- the bootstrap advisory workflow explicitly deferred actual repo-guard execution;
- `Portfolio validate` run #80 succeeded on the exact bootstrap head;
- branch protection and required-check settings were not changed.

### First positive fixture

This document-only change is the first pull request expected to execute the pinned repo-guard action against a trusted base policy. Exact workflow evidence is recorded in roadmap#65 after the run completes.

## Metrics for real pull requests

For each representative roadmap pull request record:

- PR and exact head SHA;
- change class / affected surface;
- repo-guard workflow conclusion;
- policy diagnostics, if any;
- observable job duration when available;
- whether `Portfolio validate` also ran;
- false-positive / false-negative notes;
- any worker wait caused specifically by repo-guard.

No observation by itself promotes advisory policy to blocking. Promotion is a separate explicit governance transition under roadmap#65.
