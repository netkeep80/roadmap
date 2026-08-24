# Agent Control Plane — design

Дата: 2026-08-24

## Цель

Расширить `netkeep80/roadmap` от portfolio control plane до координационного центра для нескольких автономных AI-агентов, работающих параллельно над разными public repositories.

Целевой UX:

```text
human -> gives one GitHub URL
       -> https://github.com/netkeep80/roadmap/issues/<role-issue>
agent -> reads role issue
      -> restores current context
      -> reads inbox/claims/dependencies
      -> enters the target repository
      -> follows local repository + repo-guard protocol
      -> leaves durable checkpoint/handoff
```

Агенту не требуется отдельный checkpoint от человека, имя роли или предварительное знание структуры portfolio.

## 1. Главные инварианты

### 1.1 One URL bootstrap

Одна permanent Agent Role issue является полным bootstrap entrypoint роли.

Человек должен иметь возможность запустить новый экземпляр агента одной ссылкой:

```text
https://github.com/netkeep80/roadmap/issues/<role-issue>
```

После чтения issue агент обязан самостоятельно определить дальнейшие источники истины и текущую работу.

### 1.2 One public repository = one developer role

Для каждого repository, который находится в live public owner scope `netkeep80`, существует ровно одна открытая permanent role issue:

```text
[Agent Role] <repository> developer
```

Role identity — номер issue в `netkeep80/roadmap`. Имя repository является human-readable payload, но не отдельным глобальным role namespace.

`roadmap` также получает собственную роль `roadmap developer / portfolio coordinator`; это всё равно repository-developer role, просто её repository responsibility включает control-plane governance.

Не создавать отдельные постоянные роли по подсистемам (`visual`, `mts`, `storage`) если они не соответствуют отдельному public repository. Cross-repository специализация выражается dependency/workstream metadata, а не вторым набором role identities.

### 1.3 Public-only privacy firewall

Agent Control Plane относится только к public repositories.

Текущие role issues, machine-readable agent state, generated snapshots, messages, claims и dependency refs не должны содержать:

- private repository names;
- private repository URLs;
- private issue/PR identifiers;
- private commit SHA;
- private repository lifecycle/status;
- косвенные записи, существующие только для описания private repository.

Любая repository reference в agent protocol должна resolve-иться в текущий public owner inventory и в зарегистрированный public portfolio registry.

Unknown/non-public repository reference -> validation failure, never optimistic acceptance.

Validator и sync должны сериализовать только public-scope facts. Техническая аутентификация GitHub API не расширяет semantic scope control plane.

### 1.4 Intent != observed facts != execution context

Сохраняется существующее разделение:

```text
data/portfolio.json
  = portfolio intent / ownership / priorities / dependencies

GitHub live public state + data/status.json
  = observed repository facts

Agent Role issues
  = stable execution contract per repository

Agent Session issues/comments
  = transient execution context

local repository issues/PRs
  = implementation backlog and change lifecycle
```

Role/session state не имеет права автоматически менять portfolio priority, lifecycle или canonical ownership.

### 1.5 roadmap coordinates, repo-guard integrates

`roadmap` отвечает на вопросы:

```text
who am I?
what repository do I own?
what should I inspect next?
who else is working?
what is claimed?
what dependency/message is waiting?
who must be notified?
```

`repo-guard` отвечает за repository/PR correctness и integration lifecycle:

```text
is the exact change valid?
is the exact PR head valid?
what integration next_action is allowed?
```

Agent Control Plane не создаёт второй merge coordinator и не дублирует repo-guard Constraint Program.

## 2. Permanent Agent Role issue

Role issue остаётся открытой всё время, пока repository входит в public Agent Control Plane.

Рекомендуемый title:

```text
[Agent Role] <repository> developer
```

Role issue содержит stable machine-readable contract и короткую human-readable инструкцию.

Canonical block:

```yaml
protocol: roadmap-agent-role/v1
repository: netkeep80/<repository>
scope: public-only
state: active
role_kind: repository-developer
portfolio_authority: propose
```

Для `roadmap`:

```yaml
protocol: roadmap-agent-role/v1
repository: netkeep80/roadmap
scope: public-only
state: active
role_kind: repository-developer
portfolio_authority: coordinate
```

Role issue обязана ссылаться только на stable control-plane entrypoints:

- `README.md`;
- `OPERATING_MODEL.md`;
- `data/portfolio.json`;
- `data/status.json`;
- `EXECUTION.md`;
- соответствующий repository;
- соответствующие public portfolio workstream/local epic refs.

Она не должна копировать динамические exact SHA, текущие PR status и прочий быстро устаревающий state.

## 3. Bootstrap protocol

Получив только URL role issue, агент выполняет конечный алгоритм:

```text
1. read role issue
2. validate protocol + public-only repository identity
3. read current roadmap main / operating model / portfolio intent / factual status
4. verify repository still belongs to live public scope
5. inspect active sessions for this role
6. inspect unresolved messages addressed to this role
7. inspect active claims relevant to repository
8. read target repository PORTFOLIO.md + local README/issues/PRs
9. read local repo-policy/repo-guard state and exact workflows
10. resume an existing handoff OR select next unclaimed executable work
11. create/continue an Agent Session
12. work under local repository lifecycle rules
13. checkpoint after meaningful gate transitions
14. send cross-role messages when dependencies change
15. hand off or complete session
```

Если role contract malformed, repository больше не public, conflicting role coverage обнаружен или source-of-truth state неполон — агент fail closed и не начинает repository mutation.

## 4. Agent Session

Permanent role не хранит растущий рабочий журнал. Каждый конкретный запуск/отрезок работы получает отдельную Session issue.

Title:

```text
[Agent Session] <repository> / <date-or-session-id>
```

Canonical session block:

```yaml
protocol: roadmap-agent-session/v1
role_issue: <number>
repository: netkeep80/<repository>
state: working
claims: []
current_pr: null
blocked_by: []
```

Finite session states:

```text
starting
working
waiting
blocked
handoff
completed
abandoned
```

Session body содержит только compact operational state. Длинная история идёт комментариями-checkpoints.

Не сохранять private chain-of-thought. Durable context состоит из проверяемых фактов:

- сделано;
- decisions уже приняты;
- exact public SHA/PR/issue refs;
- CI/repo-guard evidence;
- blockers;
- next executable action;
- outgoing/incoming message refs.

## 5. Checkpoint / handoff

Checkpoint — structured comment в Session issue:

```yaml
protocol: roadmap-agent-checkpoint/v1
state: working
completed:
  - public fact / gate
refs:
  - netkeep80/repo#123
  - commit:<public-sha>
blockers: []
next:
  - exact next action
messages: []
```

Перед `handoff` обязателен последний checkpoint, достаточный для нового агента, который знает только role URL.

Новый агент не доверяет checkpoint вслепую: GitHub repository state остаётся source of truth и reread-ится перед mutation/lifecycle transition.

## 6. Claims and parallel work selection

Claim предотвращает случайное дублирование одной local issue несколькими агентами, но не вводит global repository lock.

Claim хранится в Session issue как public issue/PR reference.

Перед выбором работы агент читает активные sessions своей role issue.

Collision resolution должна быть deterministic:

```text
earlier active Session issue creation wins;
if GitHub timestamps are equal, lower Session issue number wins.
```

Проигравшая session освобождает claim и выбирает другую executable работу.

Claim не даёт merge authority и не заменяет repo-guard integration semantics.

## 7. Inter-agent messages

Cross-repository сообщения, которые должны пережить завершение чата, оформляются отдельными roadmap issues.

Title:

```text
[Agent Message] #<source-role> -> #<target-role>: <subject>
```

Canonical block:

```yaml
protocol: roadmap-agent-message/v1
from_role_issue: <number>
to_role_issues:
  - <number>
kind: dependency-ready
requires_ack: true
state: open
refs:
  - netkeep80/public-repo#123
```

Finite `kind`:

```text
info
request
blocker
dependency-ready
dependency-broken
handoff
decision-required
coordination
```

Finite lifecycle:

```text
open
acknowledged
resolved
```

Messages requiring ACK remain observable until the target role acknowledges them.

Local implementation discussion stays в local issue/PR; roadmap message существует только когда информация materially пересекает repository boundary или должна быть durable coordination event.

## 8. Role coverage registry

Не вводить второй manually-maintained список repository names только ради agent roles.

Canonical public repository set остаётся `data/portfolio.json` плюс live public-owner coverage validation.

Machine-readable role mapping может быть generated/derived:

```json
{
  "schema_version": 1,
  "roles": [
    {
      "repository": "netkeep80/example",
      "issue": 123
    }
  ]
}
```

Но source of identity — сами permanent role issues; generated mapping нужен для fast lookup/validation, а не как альтернативный human-maintained truth.

Required relation:

```text
live public owner repositories
        ==
registered public portfolio repositories
        ==
repositories represented by exactly one active Agent Role issue
```

Любая разница является control-plane drift.

## 9. Validation

`portfolio-validate` / supporting script must eventually prove:

1. every registered repository is public;
2. every live public owner repository is registered;
3. every registered public repository has exactly one open `roadmap-agent-role/v1` issue;
4. no role issue points outside public registry;
5. every session references an existing active role and the same repository;
6. every claim points to the role repository;
7. every message source/target role exists;
8. every repository ref inside structured agent blocks resolves to public registry;
9. malformed protocol blocks fail closed;
10. generated agent snapshot never serializes non-public repositories.

Validation should parse finite structured blocks rather than infer semantics from arbitrary prose.

## 10. Generated operational snapshot

После базового protocol rollout `portfolio-sync` может генерировать compact agent state alongside portfolio status, например:

```text
data/agents.json
AGENTS_STATUS.md
```

Snapshot is factual, generated, and disposable.

It may contain:

- repository -> role issue;
- active sessions;
- claims;
- unresolved messages;
- blockers;
- last checkpoint timestamp.

It must not become the write path for agents. Durable writes remain GitHub issues/comments.

## 11. Repository role semantics

Все роли имеют один тип: `repository-developer`.

Различия между проектами берутся из existing portfolio metadata:

```text
priority
lifecycle
role
canonical_for
objective
next_gate
depends_on
workstreams/local epics
```

Следовательно отдельный role taxonomy не требуется.

Примеры поведения:

- active repository developer продолжает executable local backlog;
- blocked repository developer сначала проверяет upstream message/gate;
- research repository developer следует evidence milestone;
- oracle/archive/maintenance repository developer не придумывает feature growth вопреки lifecycle;
- roadmap developer координирует portfolio drift/role coverage, но не переписывает portfolio decisions автоматически.

## 12. Migration / rollout

Переход выполнять incremental slices, не big bang:

```text
A0 design + public-only authority
A1 role protocol + one-URL bootstrap
A2 role coverage validator + generated mapping
A3 create one permanent role issue per live public repository
A4 sessions + checkpoints
A5 messages + ACK lifecycle
A6 claims + collision rules
A7 generated agent status
A8 repo-guard/local workflow integration guidance
A9 real multi-agent acceptance proof
```

После A3 пользователь уже может раздавать role issue URLs существующим агентам; A4-A9 затем улучшают continuity/coordination без изменения role identity.

## 13. Acceptance proof

Финальный acceptance требует real public-only proof минимум с тремя repository roles:

```text
Role A: upstream repository
Role B: dependent repository
Role C: independent repository
```

Доказать:

1. каждый новый agent стартует только по role URL;
2. A делает durable dependency-ready message B;
3. B видит и ACK-ит message до dependent transition;
4. C продолжает independent work без global lock;
5. две sessions пытаются claim одну local issue, collision resolves deterministically;
6. новый agent подхватывает role из последнего handoff без pasted chat checkpoint;
7. stale checkpoint не переопределяет fresh GitHub state;
8. repo-guard/local CI остаётся единственным integration correctness path;
9. validator proves 1:1 coverage across entire live public portfolio;
10. public roadmap outputs содержат zero non-public repository references.

## 14. Non-goals

Не строить в первом release:

- external agent daemon/service/database;
- realtime websocket chat;
- вторую систему merge queue;
- second portfolio registry;
- role hierarchy beyond one repository developer role per public repository;
- automatic portfolio priority/canonical-owner decisions;
- private repository coordination in this public control plane;
- storage of hidden reasoning / chain-of-thought.

## 15. Current repository constraint

На момент design snapshot `roadmap` имеет только `portfolio-validate` и `portfolio-sync`; `repo-policy.json` и blocking branch protection отсутствуют. Поэтому Agent Control Plane rollout не должен заявлять repo-guard protection там, где её ещё нет. Governance hardening `roadmap` при необходимости выполняется отдельным explicit gate через существующий portfolio repo-guard workstream.
