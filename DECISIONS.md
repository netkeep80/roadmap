# Portfolio decisions

Этот файл — компактный журнал **принятых portfolio-level решений**. Он не заменяет PR discussion и local design docs; его задача — дать историю направления без археологии по десяткам репозиториев.

## D-001 — Один canonical owner на слой

**Статус:** accepted  
**Дата:** 2026-08-09  
**Связано:** roadmap #1, PR #10

Решение:

- `PersistMemoryManager` владеет persistent storage primitives, но не JSON/VM semantics;
- `pjson` владеет persistent JSON semantics;
- `anum_docs` владеет normative МТС/Anum contracts;
- `avm` является future canonical link-native Relations Model runtime;
- `aprover` — downstream proof/search consumer;
- `jsonRVM` — migration oracle, а не второй future runtime;
- legacy implementations удаляются после migration, Git остаётся архивом.

**Следствие:** compatibility implementation без named removal gate считается архитектурным долгом, а не нормальной конечной формой.

## D-002 — Portfolio управляется gates, а не календарными обещаниями

**Статус:** accepted  
**Дата:** 2026-08-09  
**Связано:** PR #10

Переход между этапами происходит после проверяемого acceptance condition: upstream contract, conformance, consumer migration, independent validation, safety evidence или explicit research decision.

**Следствие:** `EXECUTION.md` строит dependency lanes и gates, а не искусственный календарный Gantt.

## D-003 — Long-term направление: persistent associative runtime прежде custom hardware

**Статус:** accepted как research direction, не как production architecture  
**Дата:** 2026-08-09  
**Связано:** roadmap #11, PR #12

Предпочтительная последовательность:

```text
software semantics
→ persistent runtime
→ realistic workload
→ associative scheduler / self-hosting
→ profiling
→ accelerator
→ only then possible custom hardware
```

Hardware specialization должна реализовывать тот же observable semantic contract, а не создавать вторую VM.

## D-004 — `roadmap` является главным portfolio control plane

**Статус:** accepted  
**Дата:** 2026-08-09  
**Связано:** roadmap #13, PR #14, PR #15, PR #18

Решение:

- `roadmap` — первая точка входа для всего `netkeep80` portfolio;
- human-maintained `data/portfolio.json` хранит intent: priorities, lifecycle, ownership, objectives, gates, dependencies;
- GitHub-derived `STATUS.md` / `data/status.json` хранят observed state и successful-check freshness;
- local repositories владеют implementation backlog;
- новый public repository без записи в registry считается governance drift;
- автоматизация может обновлять факты, но не имеет права самостоятельно менять portfolio decisions;
- semantic-vs-GitHub workstream mismatch показывается как health warning, а broken tracked references являются hard failure.

**Следствие:** актуальность roadmap поддерживается не ручным копированием GitHub state, а разделением semantic intent и generated facts.

## D-005 — MTS foundation reset v2 предшествует прежней v0.6 production migration

**Статус:** superseded как активное ordering решением D-007; сохранено как historical decision  
**Дата:** 2026-08-09  
**Связано:** roadmap #3, `anum_docs#200`, `#201`, `#202`, прежний `#194–#199`

Live control-plane выявил, что `anum_docs#194` теперь прямо заблокирован новым foundation reset. Поэтому portfolio больше не считает `#195` непосредственным следующим production шагом.

Текущий на тот момент порядок:

```text
#200  5-link semantic kernel / meaning-of-meaning
  ↓
#201  minimal quaternary Anum streaming interpreter + context network
  ↓
#202  dictionary-driven universal associative interpreter / theory network
  ↓
explicit decision about surviving v0.6 assumptions
  ↓
rewrite/revalidate #194–#199
  ↓
accepted production/reference migration
```

**Исторические следствия:**

- `aprover` не repin-ился на foundation-reset candidate;
- AVM продолжал только те gates, которые frontend-neutral и не требовали нового candidate MTS contract;
- старый `#194–#199` план не считался автоматически валидным после `#202` — он должен был быть переписан/перепроверен;
- `anum_docs` оставался единственным normative owner, поэтому AVM/aprover не создавали локальную alternative semantics, пока upstream foundation решался.

## D-006 — Child backlinks являются live governance invariant

**Статус:** accepted  
**Дата:** 2026-08-09  
**Связано:** roadmap #16, control-plane backlink guard

Одноразового внедрения `PORTFOLIO.md` недостаточно. Каждый current child repository должен постоянно сохранять discoverable link обратно на central control plane.

Validator/sync проверяет для каждого текущего child repository:

- root `PORTFOLIO.md` существует в default branch;
- файл указывает на `https://github.com/netkeep80/roadmap`;
- файл указывает на central `STATUS.md`;
- dynamic priority/lifecycle/current gate при этом не копируются в child repository.

**Следствие:** missing/invalid backlink является hard control-plane failure так же, как unregistered repository или broken tracked gate. Generated `STATUS.md` показывает live coverage `verified_child_backlinks / child_repository_count`; фиксированное количество child repositories намеренно не зашивается в решение, потому что portfolio может расти.

## D-007 — Accepted MTS v0.7 является текущим production baseline для downstream consumers

**Статус:** accepted  
**Дата:** 2026-08-12  
**Связано:** roadmap #3/#24, `anum_docs#237/#271/#401/#403`, `aprover#152`

`anum_docs` завершил Gate P и одним атомарным C7+C8+C9 cutover принял `mts-contract/v0.7` / `mts-conformance/v0.7` как текущую production/reference границу. Historical Python semantic runtime удалён; compatibility runtime отсутствует; v0.6 остаётся неизменяемым previous-release evidence.

Новый portfolio ordering:

```text
accepted anum_docs MTS v0.7
        ↓
aprover#152 exact current-upstream repin
        ↓
consumer conformance / current pointer

accepted anum_docs MTS v0.7
        ↓
AVM MTS-dependent frontend may repin when a local gate requires it

accepted anum_docs MTS v0.7
        ↓
anum_parser laboratory tracks current umbrella provenance while its Anum leaf remains v0.4
```

Решение:

- downstream repin теперь **разрешён**, но не считается автоматически выполненным;
- `aprover#152` — первый явный proof/search consumer handoff на v0.7;
- `anum_parser` остаётся non-normative laboratory consumer: experiments не становятся МТС semantics без принятия в `anum_docs`;
- AVM больше не блокируется ожиданием Foundation-v2 acceptance, но не обязан тянуть MTS в frontend-neutral gates;
- `anum_docs#122/#123` продолжаются как отдельные research/versioned extension tracks и не делают accepted v0.7 «candidate» задним числом;
- старые accepted artifacts остаются version-scoped replay evidence;
- downstream consumers не создают локальную alternative MTS semantics.

**Следствие:** прежняя D-005 цепочка считается завершённым historical ordering. Текущая P0 граница сдвинулась с upstream foundation migration на downstream exact-pin/conformance и локальные AVM migration gates.

## D-008 — Public Agent Control Plane: одна repository role и one-URL bootstrap

**Статус:** accepted  
**Дата:** 2026-08-24  
**Связано:** PR #26, `AGENTS.md`, `AGENT_PROTOCOL.md`

`roadmap` расширяется от portfolio control plane до durable координационного центра AI-агентов для **public repositories only**.

Решение:

- каждый live public repository `netkeep80` имеет ровно одну permanent `[Agent Role] <repository> developer` issue;
- сама URL этой role issue является полным bootstrap identity: отдельное имя роли или pasted chat checkpoint от пользователя не требуются;
- `roadmap` тоже имеет repository-developer role, с дополнительным `portfolio_authority=coordinate`;
- отдельная subsystem-role taxonomy не создаётся: специализация/зависимости берутся из portfolio/local repository state;
- permanent Role хранит stable identity/authority, Agent Session хранит transient execution context, Checkpoint — resumable factual state, Claim — optimistic work selection, Agent Message — durable cross-repository communication;
- hidden chain-of-thought не является durable context;
- `data/portfolio.json` остаётся единственным manually-maintained portfolio repository registry; role mapping derived from GitHub Issues;
- Agent Control Plane не создаёт второй merge coordinator: local CI/repo-guard остаётся authority для change/integration correctness;
- initial role rollout выполняется idempotent reconciler-ом после accepted main change, а hard 1:1 coverage включается только после фактического появления ролей.

Public-only privacy invariant:

```text
live public owner scope
== public portfolio registry
== repositories represented by active Agent Roles
```

Non-public repository names/URLs/issues/PRs/SHAs/status/dependencies/roles не сериализуются в public Agent Control Plane. Authenticated inventory фильтруется до public set **до** agent-state projection.

**Следствие:** работающий или новый AI-агент может быть введён/повторно введён в роль одной постоянной GitHub URL, восстановить durable context через Sessions/Messages и продолжить работу после обязательной проверки свежего local GitHub state.

## D-009 — Forward Agent Control Plane остаётся coordination-only

**Статус:** accepted  
**Дата:** 2026-08-26  
**Связано:** roadmap #62, PR #188

Forward-модель намеренно ограничена координацией.

`roadmap` отвечает за:

- work discovery и normalized priority selection;
- permanent Role;
- transient Session и optimistic Claim;
- deterministic collision handling;
- genuine implementation handoff;
- stale recovery после fresh GitHub revalidation;
- durable cross-repository Messages.

Target repository отвечает за:

- implementation и tests;
- CI / repo-guard / branch protection;
- merge/integration correctness.

Рабочий selector один: explicit `P0/P1/P2...`, затем declared local/dependency order, затем continuation только как tie-break внутри одинакового effective rank, затем repository lexical order и issue number. Source type не является priority: handoff — continuation evidence, Message — вход в derived work/dependency state. Ambiguous mixed priority fail closed до explicit portfolio intent.

Новый forward flow **не создаёт и не требует** independent acceptance Sessions, candidate/acceptance seals, bot acceptance attestations, `roadmap-agent-pr/v1` или `/v2` merge pointers, GraphQL provenance merge gates, target-side replay roadmap acceptance, worker no-bypass proofs или roadmap-owned merge queue. Historical v1/v2 Session/Checkpoint evidence остаётся читаемым compatibility/history и не переписывается.

До production pilot допускается максимум два stabilization PR, причём второй только при фактически необходимой operational-state boundedness correction. После stabilization control-plane меняется только по правилу:

```text
real observed production failure
+ exact GitHub evidence / reproducer
+ smallest bounded correction
```

**Следствие:** следующим acceptance mechanism самого control plane является реальный two-worker production pilot, а не новая proof chain. Если pilot не показывает material coordination defect, инженерная разработка control plane прекращается и возобновляется полный five-worker pool.

## Как добавлять следующее решение

Новая запись должна содержать:

- identifier `D-NNN`;
- status (`proposed`, `accepted`, `superseded`, `rejected`);
- дату;
- связанные roadmap issue/PR;
- короткое решение;
- последствия;
- при supersede — ссылку на новое решение.
