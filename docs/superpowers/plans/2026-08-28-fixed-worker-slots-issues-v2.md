# Fixed Worker Slots — Issue Breakdown

Umbrella: `[Agent Control Plane] Fixed five-slot Scheduled Worker execution`.

Implementation order:

1. Slot protocol + generation fence.
2. Slot-first runtime + idle self-dispatch + assignment-race handling.
3. Five permanent Slot issues + Agent Status projection + docs.
4. Migrate current resumable work into Slot assignments.
5. Remove anonymous Session/Claim/Handoff machinery from the forward Scheduled Worker hot path while preserving historical compatibility.

Canonical design: `docs/superpowers/specs/2026-08-28-fixed-worker-slots-design.md`.
Canonical implementation plan: `docs/superpowers/plans/2026-08-28-fixed-worker-slots-plan.md`.
