# Agent Control Plane status

> **GENERATED FILE — DO NOT EDIT.** This is a read-only projection of validated public Agent Role / Session / Message / Checkpoint state in GitHub.

- Last successful agent-state check: **2026-08-24T11:06:49.228Z**
- Permanent public roles: **26/26**
- Active sessions: **4**
- Resumable handoffs: **1**
- Active claims: **2**
- Claim collisions: **0**
- Unresolved messages: **1**
- Blockers: **0**

## Role directory

| Repository | Permanent role | Authority |
|---|---|---|
| `netkeep80/a-num-` | [#30](https://github.com/netkeep80/roadmap/issues/30) | `propose` |
| `netkeep80/aes` | [#31](https://github.com/netkeep80/roadmap/issues/31) | `propose` |
| `netkeep80/anum_docs` | [#32](https://github.com/netkeep80/roadmap/issues/32) | `propose` |
| `netkeep80/anum_parser` | [#33](https://github.com/netkeep80/roadmap/issues/33) | `propose` |
| `netkeep80/aprover` | [#34](https://github.com/netkeep80/roadmap/issues/34) | `propose` |
| `netkeep80/associative_proofs` | [#35](https://github.com/netkeep80/roadmap/issues/35) | `propose` |
| `netkeep80/avm` | [#36](https://github.com/netkeep80/roadmap/issues/36) | `propose` |
| `netkeep80/BinDiffSynchronizer` | [#27](https://github.com/netkeep80/roadmap/issues/27) | `propose` |
| `netkeep80/god-mode` | [#37](https://github.com/netkeep80/roadmap/issues/37) | `propose` |
| `netkeep80/isocubic` | [#38](https://github.com/netkeep80/roadmap/issues/38) | `propose` |
| `netkeep80/jgit` | [#39](https://github.com/netkeep80/roadmap/issues/39) | `propose` |
| `netkeep80/jhub` | [#40](https://github.com/netkeep80/roadmap/issues/40) | `propose` |
| `netkeep80/jsonRVM` | [#41](https://github.com/netkeep80/roadmap/issues/41) | `propose` |
| `netkeep80/mast-calculator` | [#42](https://github.com/netkeep80/roadmap/issues/42) | `propose` |
| `netkeep80/meta_rm` | [#43](https://github.com/netkeep80/roadmap/issues/43) | `propose` |
| `netkeep80/mts_visual` | [#45](https://github.com/netkeep80/roadmap/issues/45) | `propose` |
| `netkeep80/mts-genesis` | [#44](https://github.com/netkeep80/roadmap/issues/44) | `propose` |
| `netkeep80/NNets` | [#28](https://github.com/netkeep80/roadmap/issues/28) | `propose` |
| `netkeep80/PersistMemoryManager` | [#29](https://github.com/netkeep80/roadmap/issues/29) | `propose` |
| `netkeep80/phprvm` | [#46](https://github.com/netkeep80/roadmap/issues/46) | `propose` |
| `netkeep80/pjson` | [#47](https://github.com/netkeep80/roadmap/issues/47) | `propose` |
| `netkeep80/repo-guard` | [#48](https://github.com/netkeep80/roadmap/issues/48) | `propose` |
| `netkeep80/roadmap` | [#49](https://github.com/netkeep80/roadmap/issues/49) | `coordinate` |
| `netkeep80/sample_cmake` | [#50](https://github.com/netkeep80/roadmap/issues/50) | `propose` |
| `netkeep80/termowood` | [#51](https://github.com/netkeep80/roadmap/issues/51) | `propose` |
| `netkeep80/usefull` | [#52](https://github.com/netkeep80/roadmap/issues/52) | `propose` |

## Active sessions

| Session | Worker slot | Repository | State | Claims | Current PR | Last activity |
|---|---|---|---|---|---|---|
| [#56](https://github.com/netkeep80/roadmap/issues/56) | — | `netkeep80/anum_docs` | `working` | `netkeep80/anum_docs#122` | — | 2026-08-24T09:54:51Z |
| [#59](https://github.com/netkeep80/roadmap/issues/59) | — | `netkeep80/sample_cmake` | `working` | — | — | 2026-08-24T09:55:55Z |
| [#61](https://github.com/netkeep80/roadmap/issues/61) | — | `netkeep80/mts_visual` | `starting` | — | — | 2026-08-24T10:01:02Z |
| [#64](https://github.com/netkeep80/roadmap/issues/64) | — | `netkeep80/roadmap` | `working` | `netkeep80/roadmap#62` | `netkeep80/roadmap#63` | 2026-08-24T10:15:50Z |

## Resumable handoffs

| Session | Worker slot | Repository | State | Claims | Current PR | Last activity |
|---|---|---|---|---|---|---|
| [#57](https://github.com/netkeep80/roadmap/issues/57) | — | `netkeep80/mts_visual` | `handoff` | — | — | 2026-08-24T09:59:39Z |

## Claims

| Claim | Winner | Contenders | State |
|---|---|---|---|
| `netkeep80/anum_docs#122` | [#56](https://github.com/netkeep80/roadmap/issues/56) | [#56](https://github.com/netkeep80/roadmap/issues/56) | active |
| `netkeep80/roadmap#62` | [#64](https://github.com/netkeep80/roadmap/issues/64) | [#64](https://github.com/netkeep80/roadmap/issues/64) | active |

## Unresolved messages

| Message | Kind | From | To | State | ACK |
|---|---|---|---|---|---|
| [#60](https://github.com/netkeep80/roadmap/issues/60) | `dependency-ready` | [#32](https://github.com/netkeep80/roadmap/issues/32) | [#45](https://github.com/netkeep80/roadmap/issues/45) | `acknowledged` | required |

## Blockers

_No active protocol blockers._

## Reading rule

- This snapshot is factual and disposable. It never replaces role/session/message Issues, local repository state, portfolio intent, CI, or repo-guard.
- `worker_slot` identifies the Scheduled Task slot for observability only; it grants no Role, claim, lease or authority.
- A `handoff` is resumable context, not a live executor and not a claim holder.
- Checkpoint free text remains only in the original Session comment and is not duplicated here.
- Agents must re-read GitHub before every write or lifecycle transition.

