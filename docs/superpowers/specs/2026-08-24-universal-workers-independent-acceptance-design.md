# Universal Scheduled Workers + Independent Acceptance Design

## Status

Human-approved architecture for `roadmap#62`. This document is the implementation authority for the migration; GitHub live state remains runtime authority.

## Goals

- Invocation duration, reasoning depth, model and scheduler slot are non-authoritative.
- One LIVE winning Claim per explicit work item.
- Long workers may perform many bounded verified steps; short workers checkpoint and hand off.
- External waits release Scheduled Worker Claims.
- Work selection is normalized and finish-first; handoffs/messages are evidence inputs, not global priority queues.
- Material changes require independent exact-candidate acceptance before automated merge.
- New evidence validation is local/write-boundary and fail-closed; automatic full-history scans are forbidden.

## Protocol evolution

Keep Role and Message at v1. Add dual-read support for `roadmap-agent-session/v2` and `roadmap-agent-checkpoint/v2`. Historical v1 remains valid and is never rewritten. After cutover, new autonomous Sessions are v2.

Session v2 adds immutable:

```json
{
  "work_item": "netkeep80/foo#123",
  "work_phase": "implementation"
}
```

`work_phase` is exactly `implementation | acceptance`. A v2 Session represents one work item and one phase. `claims` is either `[work_item]` while owned or `[]` after release. Acceptance Sessions never own a working branch.

Checkpoint v2 mirrors `work_item`. Structured v2 Checkpoint authority is append-only; correction is a new Checkpoint, not an edit of the canonical JSON.

## Review candidate

Implementation may seal an immutable candidate:

```json
{
  "review_candidate": {
    "work_item": "netkeep80/foo#123",
    "pr": "netkeep80/foo#456",
    "head_sha": "<H>",
    "base_sha": "<B>"
  }
}
```

The validator resolves the changed Checkpoint, attached Session, exact PR and current open Session claimant set for that exact work item. The claimant lookup is bounded current-state evidence only: it does not read Checkpoint history or use Agent Status as authority. It proves implementation phase, matching work item, current deterministic winning Claim, canonical PR and exact H/B.

A failed `issue_comment.created` workflow does not roll the GitHub comment back. Therefore the continued existence of a syntactically valid seal is not proof that the seal ever passed its write-boundary authority checks. Timestamp equality is also not an immutability proof because GitHub comment timestamps do not distinguish every possible same-second mutation.

## Successful-validation attestation

After and only after a `review_candidate` creation event passes the complete event-local validation, the Agent Status workflow publishes a separate durable comment on the same candidate Session Issue using `GITHUB_TOKEN`. GitHub records that comment as authored by the platform identity `github-actions[bot]`. It uses a distinct marker so it does not recursively route through ordinary Agent Checkpoint handling:

````text
<!-- roadmap-agent-validation-attestation:start -->
```json
{
  "protocol": "roadmap-agent-validation-attestation/v1",
  "candidate_session": 141,
  "candidate_checkpoint_comment_id": 5400123456,
  "candidate_checkpoint_body_sha256": "<64-lowercase-hex>",
  "work_item": "netkeep80/foo#123",
  "pr": "netkeep80/foo#456",
  "head_sha": "<H>",
  "base_sha": "<B>"
}
```
<!-- roadmap-agent-validation-attestation:end -->
````

The digest is SHA-256 over the exact UTF-8 bytes of the seal comment body from the successful event payload. The attestation binds successful seal-time validation to the exact candidate Session, exact seal comment id, exact seal body and exact candidate tuple. A seal that failed validation receives no attestation. If the referenced seal body later changes, even inside the same timestamp second, its digest no longer matches.

An attestation has authority only when the bounded verifier resolves the exact referenced comment, proves it belongs to the candidate Session Issue, proves `user.login == github-actions[bot]` and `user.type == Bot`, parses exactly one attestation block, and matches every bound field. User-authored lookalikes have zero authority. Duplicate valid attestations from a rerun are harmless because an acceptance certificate references one exact attestation comment id; no attestation history scan is required.

Attestation comments are append-only authority evidence. Editing or deleting an attestation routes through the event-local integrity boundary and fails closed. Timestamp fields remain chronology metadata only; they never substitute for the body digest or platform author identity.

## Acceptance certificate

Final acceptance uses a fresh Session and exact pointers to both the implementation seal and its successful-validation attestation:

```json
{
  "acceptance": {
    "candidate_session": 141,
    "candidate_checkpoint_comment_id": 5400123456,
    "candidate_validation_attestation_comment_id": 5400123499,
    "work_item": "netkeep80/foo#123",
    "pr": "netkeep80/foo#456",
    "head_sha": "<H>",
    "base_sha": "<B>",
    "decision": "accepted"
  }
}
```

Decision is `accepted | changes_requested`. Final acceptance requires a different Session, acceptance phase, identical work item/PR/H/B and unchanged current PR candidate. It bounded-fetches the exact candidate Session, seal comment and attestation comment; validates the seal body against the attested SHA-256; and validates the exact tuple against both comments. No historical comment scan is permitted.

Candidate Session `created_at`, candidate seal `created_at`, acceptance Session `created_at`, and acceptance checkpoint `created_at` are mandatory valid timestamps. Missing or invalid chronology metadata fails closed. The candidate Session must predate or equal its seal, the seal must strictly predate the fresh acceptance Session, and the acceptance Session must predate or equal its acceptance checkpoint. Timestamp metadata proves ordering only, not immutability.

At decision time the acceptance Session must still own exactly `[work_item]` and be the deterministic current winning claimant in the bounded current open Session set; released or losing acceptance Sessions have zero decision authority. Head or base movement invalidates integration authority for the old certificate. Partial reviews are factual Checkpoints without a final decision and never add confidence arithmetically.

## PR pointer

A target PR may carry one small machine-readable current-state block that points to the current candidate seal and current final acceptance certificate. The pointer is an index only; target validation fetches and validates roadmap evidence. Missing, forged, stale or mismatched pointers fail closed.

## Normalized selection

Runtime reconstructs transient `WorkCandidate` values with repository, role, work item, phase, effective priority, explicit local order, continuation flag, executability, occupancy, stale-recovery requirement and evidence.

Messages change derived state; they do not form a separate priority queue. Handoffs supply continuation evidence; they do not grant priority.

Ranking:

1. explicit effective portfolio/workstream priority;
2. explicit dependency/local order when declared;
3. continuation before genuinely new work within the same effective rank;
4. repository full name lexical order;
5. work-item issue number ascending.

Mixed priority such as `P0/P1` is not heuristically collapsed; autonomous ranking requires an exact effective priority from declared authority.

`data/worker-policy.json` moves to schema v3 and replaces `work_source_order` with `selection_policy: normalized-finish-first-v1`.

## Handoff takeover

Implementation takeover uses overlap-before-clear:

1. predecessor handoff has zero claims and may retain current branch;
2. successor creates fresh Session/Claim and wins collision;
3. successor revalidates exact branch/PR and persists the same branch ownership;
4. refresh proves predecessor still claim-free and successor still winner;
5. predecessor clears branch, becomes completed and closes;
6. only then may successor mutate the branch.

This avoids an orphan window. Acceptance Sessions do not adopt implementation branches.

## Target-local enforcement

Roadmap evidence answers who/what/phase/exact acceptance. Target repository remains final integration authority.

A reusable immutable-pinned target verifier validates only the bounded PR pointer chain. Automated merge is allowed only when the target's actual protection/ruleset requires the independent acceptance check and a negative no-bypass probe proves the worker credential cannot merge without it.

Where enforcement is absent, unknown or advisory: implementation and review are allowed, automated material merge is forbidden.

Unknown material classification defaults to material. No global docs-only exemption exists.

## Rollout

1. dual-read v1/v2 parser and validators;
2. event-local v2 write-boundary integrity plus successful-validation attestation;
3. normalized selector and policy v3;
4. overlap-before-clear handoff transfer;
5. candidate sealing and independently attested acceptance certificates;
6. bounded target verifier;
7. target pilot with positive and negative enforcement evidence;
8. reconcile legacy active state without rewriting history;
9. two-worker production pilot;
10. five identical phase-shifted workers only after all restart gates pass.

## Restart gate

Five workers remain paused until v2 is deployed, v1 dual-read stays green, automatic historical scans remain absent, successful-validation attestation and selector/transfer/acceptance are proven, target fail-closed enforcement has real no-bypass evidence, non-enforced targets are explicit no-auto-merge, a two-worker overlap soak passes, and current control-plane status is valid.
