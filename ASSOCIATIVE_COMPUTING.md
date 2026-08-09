# Варианты развития ассоциативной архитектуры компьютеров

Срез: 2026-08-09.

Этот документ описывает **варианты будущего развития**, а не уже принятую архитектуру. Они намеренно расположены от наиболее реалистичных software-only шагов к более спекулятивным hardware-моделям.

Главная рекомендация: не выбирать конечную машину заранее. Сначала доказать workload и semantics на программном уровне, затем специализировать только те операции, которые действительно становятся bottleneck.

## 1. Базовая модель

Условная классическая архитектура:

```text
CPU
  executes instruction stream
        ↓
RAM addressed by locations
        ↓
files / databases / serialized objects
```

Candidate associative architecture:

```text
persistent canonical link space
        ↑       ↑       ↑
      find    query   realize
        ↓       ↓       ↓
link-native programs / data / state
        ↓
explicit executor + effects
```

Разница не в отсутствии адресов вообще. Внутренняя реализация всё равно будет использовать offsets, IDs, cache lines и физические адреса. Разница в том, что они не являются главным **semantic interface** системы.

## 2. Вариант A — software associative machine

### Идея

Первый и наиболее реалистичный вариант уже фактически строится вокруг AVM:

```text
LinkStore
+ Relations Model
+ Executor
+ structural query
+ explicit find/realize/effects
```

Обычный CPU остаётся неизменным. Ассоциативная архитектура существует как runtime abstraction.

### Что можно получить

- единый graph-native representation для программ и данных;
- structural inspection без отдельного debugger object model;
- persistence backend независимо от frontend syntax;
- deterministic replay;
- возможность измерить реальные workloads до hardware speculation.

### Что нужно доказать

- nontrivial program corpus;
- performance profile exact-pair/incoming/outgoing/pattern operations;
- memory overhead;
- persistent reopen semantics;
- tooling ergonomics;
- реальные задачи, где model проще или надёжнее традиционного object/DB stack.

### Portfolio fit

```text
anum_docs -> semantics
avm       -> runtime
PMM       -> candidate persistent substrate
jsonRVM   -> differential oracle
aprover   -> inspection/proof workload
```

Это рекомендуемый **первый основной target**.

## 3. Вариант B — persistent single-space computer

### Идея

Следующий шаг — убрать границу:

```text
process memory <-> persisted application state
```

не за счёт сериализации, а за счёт долговременного ассоциативного пространства.

Приложение не загружает базу в object graph. Оно подключается к существующему пространству связей:

```text
open persistent link space
→ resolve known roots
→ continue execution
```

### Возможная архитектура

```text
persistent medium / mmap / NVRAM
        ↓
relocatable persistent address-space manager
        ↓
canonical LinkStore
        ↓
Executor sessions
```

### Плюсы

- почти исчезает boot-time semantic reconstruction;
- natural long-lived agents/workflows;
- одинаковая структура до и после restart;
- trace/history/state могут жить рядом с program graph;
- snapshot/branch/rollback становятся естественными операциями над средой.

### Риски

- crash consistency;
- schema/semantic evolution;
- garbage/lifetime management;
- concurrency;
- long-lived corruption;
- version migration;
- security boundaries внутри единого пространства.

### Ключевой эксперимент

AVM persistent workload должен переживать:

```text
execute
→ close process
→ reopen at another address
→ continue from persistent roots/state
```

без hidden JSON reconstruction или process-address identity.

## 4. Вариант C — content/structure-addressed associative machine

### Идея

Усилить canonicality: identity значительной части immutable structures выводится из самой структуры или canonical interning.

Это не обязательно означает cryptographic hash как единственную identity. Возможны:

- local canonical `LinkId` exact pair;
- content hash для transport/distribution;
- stable logical names expressed by links;
- translation layer local-ID ↔ structural identity.

### Польза

- deduplication;
- cheap structural equality внутри store;
- memoization;
- reproducible program/value identity;
- distributed caching.

### Риски

- cycles плохо сочетаются с простым recursive hashing;
- mutable identity требует отдельной модели;
- cryptographic addressing дорого для hot path;
- нельзя смешивать local storage ID и ontological/semantic identity.

### Рекомендация

Использовать **двухуровневую identity model**:

```text
fast local opaque LinkId
+ optional stable structural/export identity
```

а не заставлять каждую runtime операцию вычислять глобальный hash.

## 5. Вариант D — associative dataflow / reactive execution

### Идея

В классическом executor центр исполнения — явный вызов:

```text
execute(entity)
```

В dataflow-варианте часть вычислений активируется появлением структуры, удовлетворяющей pattern/condition.

Концептуально:

```text
pattern P becomes satisfied
        ↓
relation/program R becomes runnable
        ↓
produces new links/effects
        ↓
may satisfy further patterns
```

Это уже ближе к ассоциативному компьютеру, где поиск и исполнение связаны напрямую.

### Где это полезно

- incremental computation;
- rule systems;
- dependency propagation;
- event processing;
- build systems;
- reactive agents;
- knowledge inference.

### Главная опасность

Без строгой effect model такая машина быстро превращается в недетерминированную сеть скрытых triggers.

Нужны:

- pure vs materializing vs external-effect classification;
- deterministic conflict/order semantics;
- bounded activation;
- explicit provenance;
- cycle/quiescence rules.

### Возможная стратегия

Не менять AVM Executor сразу. Сначала добавить scheduler **над** canonical executor:

```text
associative matcher
→ produces explicit runnable entities
→ canonical Executor executes them
```

Scheduler не должен становиться вторым semantic engine.

## 6. Вариант E — associative coprocessor

### Идея

Если profiling покажет, что основная стоимость AVM находится в:

- exact pair lookup;
- incoming/outgoing traversal;
- constrained pattern matching;
- interning/canonicalization;

то эти операции можно ускорять отдельным устройством, не меняя всю компьютерную архитектуру.

```text
host CPU
   |
   +-- ordinary application/effects
   |
   +-- associative accelerator
          find(a,b)
          outgoing(a)
          incoming(b)
          match(pattern)
          intern(a,b)
```

### Реализации

#### FPGA

Хорош для первого hardware prototype:

- configurable pipelines;
- parallel index lookup;
- deterministic benchmark;
- можно быстро менять representation.

#### CAM / TCAM-like structures

Интересны для pattern/partial-key lookup, но обычная TCAM дорога по площади и энергии. Вероятнее как маленький hot cache, а не полное link storage.

#### GPU

Подходит для массовых independent graph scans/matches, но плохо для fine-grained pointer chasing и frequent canonical inserts без специальной организации данных.

#### SIMD CPU accelerator

Самый дешёвый шаг: layout/index algorithms, batch query, vectorized comparison и compact adjacency representation.

### Рекомендация

Порядок:

```text
profile
→ optimize software layout
→ batch/SIMD
→ GPU/FPGA experiment
→ only then custom silicon
```

## 7. Вариант F — link-processing instruction set

### Идея

Если associative primitives устойчиво доминируют workload, можно представить минимальную ISA или coprocessor ISA вокруг связей.

Не как окончательное предложение, а как research sketch:

```text
GET_BEGIN   dst, link
GET_END     dst, link
FIND_PAIR   dst, begin, end
INTERN_PAIR dst, begin, end
FIRST_OUT   iter, begin
NEXT_OUT    dst, iter
FIRST_IN    iter, end
NEXT_IN     dst, iter
MATCH       result, pattern
EXEC        entity
```

### Ключевой вопрос

Что здесь действительно должно быть instruction, а что лучше оставить runtime macro-operation?

Например, `MATCH` может быть слишком сложным для стабильной ISA. Гораздо реалистичнее аппаратно ускорять небольшой substrate:

```text
pair lookup
adjacency iteration
canonical insertion
```

а higher-level matching компилировать в эти primitives.

### Почему это интересно

У conventional CPU cache hierarchy оптимизирована вокруг spatial/temporal locality адресов.

У link processor можно исследовать другую locality:

```text
relational locality:
links sharing begin/end/pattern are likely to be accessed together
```

Это может привести к необычной cache/index architecture.

## 8. Вариант G — distributed associative fabric

### Идея

Link space распределён между узлами, а приложение работает с logical relations вместо файлов/REST resources как первичной модели.

```text
node A link partition
node B link partition
node C link partition
       ↕
canonical protocol / replication / query routing
```

### Возможные применения

- distributed knowledge bases;
- shared persistent agent state;
- replicated dependency graphs;
- large relation stores;
- multi-machine execution.

### Сложные вопросы

- global exact-pair uniqueness;
- identity allocation;
- partitioning by begin/end vs content;
- consistency model;
- conflict resolution;
- causal history;
- distributed transactions vs explicit eventual semantics;
- query fan-out.

### Предпочтительный путь

Не начинать с global IDs и strong global uniqueness.

Сначала:

```text
independent stores
+ stable export identities
+ explicit import/merge mapping
```

Затем исследовать federation. Это лучше согласуется с принципом, что numeric `LinkId` не обязан быть глобальным смыслом.

## 9. Вариант H — self-hosting associative environment

### Идея

Наиболее важный software milestone перед custom hardware — система начинает описывать собственную работу внутри той же relational substrate.

Не в мистическом смысле, а инженерно:

- package metadata как links;
- program graph как links;
- build/dependency graph как links;
- runtime configuration как links;
- execution traces как links;
- requirements/proofs as linked artifacts;
- migrations as explicit transformations.

Тогда tooling работает не с десятком независимых formats, а с общей структурой.

### Возможная эволюция

```text
AVM application
→ AVM-based package/workflow descriptions
→ link-native build/dependency engine
→ persistent runtime workspace
→ shell/inspection environment over same space
```

Это можно считать аналогом «операционной среды», но не нужно сразу пытаться создать полноценную ОС.

### Критерий

Self-hosting полезен только если он **уменьшает количество special-case tooling**, а не если JSON/YAML/build scripts просто механически перекодированы в links.

## 10. Вариант I — neural-associative hybrid

### Идея

Ассоциативный runtime может хорошо дополнять, а не заменять neural models.

Разделение ролей:

```text
neural model
  → fuzzy perception / proposal / heuristic search

associative substrate
  → persistent identity / exact structure / constraints / replay
```

Это особенно интересно для agents:

- LLM предлагает действие/структуру;
- canonical graph хранит долговременное состояние;
- AVM выполняет проверяемые relations;
- proof/validation layer проверяет critical artifacts;
- trace сохраняет provenance.

### Почему это лучше, чем «всё нейросеть»

Нейросеть сильна в приблизительном сопоставлении, но слаба как единственный источник exact persistent identity и deterministic replay.

Ассоциативная структура, наоборот, сильна в exact relations, но не обязана решать fuzzy recognition.

### Связь с `NNets`

`NNets` можно рассматривать как отдельный research source идей, но никакой прямой integration не должна приниматься без benchmark/use case.

## 11. Самый дальний вариант — hardware-native associative computer

Это наиболее спекулятивная ветвь.

Возможная машина имеет:

```text
persistent link memory
+ hardware canonical pair index
+ relational caches
+ lightweight execution cores
+ effect/I-O gateways
```

В ней conventional RAM и CPU не обязательно исчезают. Скорее меняется центр архитектуры:

```text
не CPU владеет данными и вызывает storage,
а persistent relation space является долговременной средой,
а execution cores активируются для обработки её структур.
```

### Почему не следует проектировать её сейчас

Пока неизвестно:

- какие associative operations реально доминируют;
- какие data layouts оптимальны;
- насколько важны cycles;
- какая доля workload read-only vs intern/materialize;
- нужна ли strong canonicality;
- как выглядит effect scheduling;
- выигрывает ли система у обычного CPU + optimized graph DB.

Без ответов custom hardware рискует аппаратно зафиксировать неправильную abstraction.

## 12. Рекомендуемая траектория portfolio

### Horizon 1 — сейчас

**Цель:** корректная software model.

```text
anum_docs accepted contracts
→ AVM 1.5 link-native semantics
→ frozen jsonRVM differential corpus
→ stable persistent LinkStore boundary
```

### Horizon 2 — следующий крупный этап

**Цель:** persistent associative runtime.

```text
AVM + persistent backend
→ close/reopen continuation
→ crash/failure contracts
→ realistic persistent workloads
→ measurements
```

### Horizon 3

**Цель:** associative scheduler and self-hosting experiments.

```text
structural pattern activation
+ explicit effect ordering
+ persistent workflow/program state
+ common inspection tooling
```

### Horizon 4

**Цель:** acceleration based on evidence.

```text
batch/index layout
→ SIMD/GPU/FPGA associative kernels
→ benchmark against CPU implementation
```

### Horizon 5

Только если предыдущие этапы показывают устойчивое преимущество:

```text
link-oriented coprocessor ISA
→ relational cache experiments
→ custom hardware research
```

## 13. Какие метрики решат, есть ли смысл двигаться дальше

Нужны не только benchmark ops/sec.

### Representation metrics

- сколько независимых representations/formats удалось убрать;
- сколько serialization/deserialization boundaries исчезло;
- сколько duplicate indexes/storage models не понадобилось.

### Correctness metrics

- deterministic replay;
- persistence/reopen correctness;
- inspectability;
- explicit effect coverage;
- corruption/failure detection.

### Performance metrics

- bytes per canonical link;
- exact-pair lookup latency;
- incoming/outgoing traversal throughput;
- intern throughput;
- pattern-match throughput;
- cache locality;
- persistent reopen cost;
- write amplification.

### Application metrics

- complexity of real programs vs traditional implementation;
- incremental update cost;
- query latency;
- debugging/provenance effort;
- migration/versioning cost.

## 14. Мой рекомендуемый архитектурный выбор

Если выбирать сегодня, я бы **не** проектировал сразу отдельный ассоциативный CPU.

Наиболее перспективная линия выглядит так:

```text
1. AVM как canonical software machine
2. PMM-class persistent backend под LinkStore
3. единое persistent program/data/state space
4. associative scheduler над тем же Executor
5. self-hosted workflows/tooling
6. profiling
7. специализированный accelerator только для proven hot primitives
```

То есть первый качественный скачок, скорее всего, будет не «новый процессор», а **новая persistent runtime architecture**.

И уже после неё станет ясно, оправдан ли второй скачок — аппаратный.

## 15. Ключевой принцип дальнейшего проектирования

Каждый новый уровень должен удалять специальность, а не добавлять ещё один параллельный мир.

Хорошее развитие:

```text
JSON frontend
Anum frontend
C++ builder
        ↓
one denotation
        ↓
one LinkStore
        ↓
one Executor
        ↓
explicit effects
```

Плохое развитие:

```text
JSON VM
+ Anum VM
+ graph VM
+ persistent VM
+ hardware VM
```

Если новая оптимизация требует второго semantic path, сначала нужно доказать, что это действительно аппаратная реализация того же contract, а не новая несовместимая машина.
