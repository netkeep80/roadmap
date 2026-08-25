# Acceptance-Success Attestation + Target Pointer v2 Design

## Status

Human-approved architecture for `roadmap#182`, a bounded child of `roadmap#141` triggered by blocker Message `roadmap#181`. This document defines the producer-side authority model required before target repositories may enforce automated material merge from bounded roadmap acceptance evidence.

GitHub live state remains runtime authority. `roadmap-agent-pr/v1` remains accepted foundation/index protocol and is not reinterpreted as merge authority.

## Problem

Task 5 established a strict bounded chain from a target PR to an implementation Session, immutable candidate seal, platform-authenticated successful candidate-validation attestation, fresh independent acceptance Session, and final acceptance checkpoint.

That chain still lacks one durable fact needed by a target repository: proof that the final `acceptance.decision=accepted` checkpoint itself successfully passed the roadmap event-local validator.

A failed `issue_comment.created` event leaves its comment in GitHub. A later target cannot infer success from comment existence. It also cannot reconstruct decision-time Claim authority from the current acceptance Session body because legitimate lifecycle progression releases the acceptance Claim while integration gates are pending. Timestamp equality is chronology metadata only and is not an immutability or successful-validation proof.

Therefore a structurally coherent v1 pointer must remain insufficient for automated material merge enforcement.

## Design choice

Extend the existing successful-validation pattern symmetrically rather than introducing a second trust system.

Candidate authority remains:

```text
implementation Session
→ review_candidate checkpoint
→ github-actions[bot] candidate-validation attestation
```

Final acceptance authority becomes:

```text
fresh acceptance Session
→ accepted checkpoint
→ github-actions[bot] acceptance-validation attestation
```

A target-enforceable pointer v2 binds both chains. The target still does not receive merge authority from roadmap evidence alone; target protection/ruleset and worker-credential no-bypass proof remain separate mandatory integration authority.

## Acceptance-validation attestation protocol

Use a distinct non-checkpoint marker so bot publication cannot recursively enter ordinary Session/Checkpoint handling:

````text
<!-- roadmap-agent-acceptance-validation-attestation:start -->
```json
{
  "protocol": "roadmap-agent-acceptance-validation-attestation/v1",
  "acceptance_session": 200,
  "acceptance_checkpoint_comment_id": 5400123500,
  "acceptance_checkpoint_body_sha256": "<64-lowercase-hex>",
  "candidate_session": 141,
  "candidate_checkpoint_comment_id": 5400123456,
  "candidate_validation_attestation_comment_id": 5400123499,
  "work_item": "netkeep80/foo#123",
  "pr": "netkeep80/foo#456",
  "head_sha": "<H>",
  "base_sha": "<B>",
  "decision": "accepted"
}
```
<!-- roadmap-agent-acceptance-validation-attestation:end -->
````

Fields are exact and closed: unknown/missing fields fail validation rather than being ignored.

`acceptance_checkpoint_body_sha256` is SHA-256 over the exact UTF-8 bytes of the newly-created acceptance checkpoint comment body supplied to the successful event-local validation path. The digest binds authority to exact immutable content; timestamps never replace it.

## Attestation authority

An acceptance-validation attestation has authority only when bounded resolution proves all of the following:

- the referenced acceptance Session exists and is `roadmap-agent-session/v2`;
- that Session is for the exact work item and has `work_phase=acceptance`;
- the referenced acceptance checkpoint comment belongs to that exact Session issue;
- the checkpoint is `roadmap-agent-checkpoint/v2` and contains final `acceptance.decision=accepted` for the exact candidate tuple;
- the attestation comment also belongs to the exact acceptance Session issue;
- GitHub REST identity for the attestation author is `github-actions[bot]` with type `Bot`;
- exactly one acceptance-validation attestation block is present;
- every bound id and tuple field matches the acceptance checkpoint and target pointer;
- the current exact acceptance checkpoint body SHA-256 matches the attested digest;
- edit/delete provenance for the attestation remains append-only according to the existing event-local evidence-integrity boundary.

User-authored lookalikes, copied bot text, malformed blocks, wrong comment ids, wrong Sessions, wrong digest, wrong decision, wrong H/B, wrong PR, or wrong work item have zero authority.

## Emission boundary

The Agent Status event path publishes an acceptance-validation attestation only after a newly-created final v2 acceptance checkpoint with `decision=accepted` passes the complete existing event-local acceptance validator.

Publication is forbidden for:

- `changes_requested`;
- partial review/checkpoint comments without a final decision;
- any failed event-local validation;
- edited or deleted checkpoints;
- v1 checkpoints;
- ordinary Session issue edits;
- candidate `review_candidate` seal events, which keep their existing candidate-attestation path;
- creation of either bot-attestation marker itself.

No automatic historical scan or backfill is introduced. Authority is produced only at the successful write boundary for the exact new acceptance event.

If an Actions rerun produces more than one valid bot attestation, no history scan is needed: downstream authority references one exact attestation comment id.

## PR pointer v2

Keep the existing `roadmap-agent-pr:start/end` framing and introduce additive protocol `roadmap-agent-pr/v2`.

The v2 object contains all v1 fields plus exactly one new field:

```json
{
  "protocol": "roadmap-agent-pr/v2",
  "work_item": "netkeep80/foo#123",
  "pr": "netkeep80/foo#456",
  "candidate_session": 141,
  "candidate_checkpoint_comment_id": 5400123456,
  "candidate_validation_attestation_comment_id": 5400123499,
  "acceptance_session": 200,
  "acceptance_checkpoint_comment_id": 5400123500,
  "acceptance_validation_attestation_comment_id": 5400123599,
  "head_sha": "<H>",
  "base_sha": "<B>"
}
```

`roadmap-agent-pr/v1` remains strictly parseable for historical/current foundation use. It is explicitly non-merge-authoritative. Enforced automated material merge requires v2 or a future protocol with at least equivalent successful-acceptance proof.

## Bounded target verification chain

A target verifier for v2 resolves only explicitly referenced current evidence:

```text
target PR exact H/B
→ candidate implementation Session
→ candidate checkpoint exact body
→ candidate github-actions[bot] successful-validation attestation + candidate body digest
→ fresh different acceptance Session
→ accepted checkpoint exact body
→ acceptance github-actions[bot] successful-validation attestation + acceptance body digest
```

The verifier performs no unbounded issue/comment history scan. Every lookup is named by the pointer or by an exact object reached from the pointer.

Validation fails closed for missing or duplicate pointer blocks, malformed JSON, unknown protocol/fields, stale target H/B, same implementation/acceptance Session, mismatched work item/PR/tuple, wrong referenced ids, wrong bot identity, wrong checkpoint digest, wrong decision, edited/deleted authoritative evidence, or any unresolved required fact.

A valid v2 chain proves exact independently validated roadmap acceptance only. It does not return or imply `integration_allowed` without target-local enforcement facts.

## Target-local integration authority

Automated material merge remains forbidden unless the target repository independently proves all of the following on the exact candidate:

- the acceptance-aware check is physically required by branch protection/ruleset;
- all other existing required target checks remain required and GREEN;
- the actual worker credential cannot merge with the acceptance-aware check missing, pending, or RED;
- a negative missing/forged/stale evidence probe is physically blocked;
- a positive exact v2 acceptance chain makes the same required check GREEN;
- no alternate merge path bypasses the requirement.

Unknown enforcement or unknown material classification fails closed. No global docs-only bypass exists.

## Compatibility and migration

The producer implementation is additive:

- existing `roadmap-agent-validation-attestation/v1` candidate semantics remain unchanged;
- existing Session v1/v2 and Checkpoint v1/v2 semantics remain unchanged except for recognizing the new non-checkpoint attestation marker at the event-routing boundary;
- `roadmap-agent-pr/v1` parser/verifier regression fixtures remain GREEN and v1 stays foundation-only;
- `roadmap-agent-pr/v2` adds the acceptance-success reference and strict coherence checks;
- no existing acceptance comment is retroactively granted an attestation;
- no historical comment is rewritten;
- no automatic material merge is enabled by this producer change;
- `SCHEDULED_WORKERS.md` and Scheduled Task prompts remain unchanged and workers remain paused until the existing rollout restart gates pass.

## Implementation boundaries

Expected producer surfaces are intentionally narrow:

- acceptance-pointer parser/verifier logic for dual-read v1/v2;
- acceptance-success attestation parsing/coherence helpers;
- event-local evidence-integrity validation for new attestation edit/delete provenance;
- Agent Status workflow publication step after successful final acceptance validation;
- focused tests and Portfolio validate wiring where needed;
- `AGENT_PROTOCOL.md` documentation of the additive authority chain.

The implementation must reuse existing bounded GitHub evidence resolution and SHA-256/body-provenance conventions wherever possible. It must not introduce an independent network crawler, database, status file, or second source of Session/Claim truth.

## Testing strategy

TDD begins with fail-closed regressions before production changes.

Required RED/GREEN cases:

1. A structurally valid accepted checkpoint that lacks an acceptance-success attestation cannot satisfy v2 target verification.
2. An acceptance comment whose event-local validation failed cannot acquire target merge authority merely because the comment exists.
3. A user-authored or wrong-author bot-lookalike attestation fails.
4. Wrong acceptance Session, checkpoint id, body SHA-256, candidate Session/seal/attestation id, work item, PR, H/B, or decision fails.
5. Edited/deleted acceptance-validation attestation events fail closed.
6. `changes_requested`, partial reviews, v1 checkpoints, and ordinary issue edits emit no acceptance-success attestation.
7. Creation of the distinct bot-attestation marker does not recurse into checkpoint handling.
8. Successful exact accepted v2 evidence emits one platform-bot attestation bound to the exact body digest and tuple.
9. A complete v2 bounded verifier input validates both candidate and acceptance successful-validation chains.
10. Existing v1 pointer fixtures and candidate-attestation semantics remain unchanged and GREEN.
11. Full exact-head Portfolio validate and repo-guard remain GREEN before sealing.

## Integration topology

Development for #182 may be stacked from the exact independently accepted #177 head so the additive work can proceed without treating advisory-policy acceptance as automated merge authority.

This stack does not inherit acceptance. Before #182 integration:

1. Task 5 foundation #177 must be integrated through its permitted authority path.
2. The #182 branch/PR must be reconciled to the resulting exact main.
3. All exact-head CI must be rerun after reconciliation.
4. A new immutable #182 implementation seal and successful candidate attestation must bind the reconciled H/B.
5. A fresh different acceptance Session must independently accept that exact candidate.
6. The final accepted checkpoint must itself produce the new acceptance-validation attestation.
7. Only then can downstream repo-guard#351 resume the physical required-check/no-bypass pilot.

Any head/base movement invalidates prior #182 seal/acceptance evidence.

## Non-goals

This change does not:

- merge #177 or #182 automatically;
- enable automated merge globally or per target;
- change work selection, Claim ordering, handoff semantics, or scheduler slots;
- resume Scheduled Workers;
- change target branch protection;
- implement the repo-guard target verifier itself;
- backfill attestation comments for historical acceptance decisions;
- weaken candidate validation, acceptance independence, chronology, or provenance checks.

## Success criteria

The producer capability is complete when exact-head tests prove fail-closed v2 semantics, a real fresh accepted checkpoint produces a platform-authenticated acceptance-validation attestation, v1 remains compatible and non-merge-authoritative, independent exact-candidate acceptance succeeds, and downstream `repo-guard#351` can consume the new bounded chain for its separate physical enforcement/no-bypass pilot.