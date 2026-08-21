# BoodaFlow Operating Standard

Status: Official project operating standard

## Purpose

BoodaFlow is the default engineering and operating model for current and future software projects in this portfolio. It prioritizes autonomous operation, verifiable correctness, shared state, recoverability, cost control, and minimal owner intervention.

## Core operating principles

1. **Autonomy first**
   - Routine collection, validation, analysis, execution-in-simulation, state updates, monitoring, retries, recovery, and reporting should run without manual triggering.
   - Owner intervention is reserved for approvals, policy changes, unsafe conditions, unresolved failures, and actions that cannot be safely automated.

2. **One authoritative state**
   - Each domain has one source of truth for durable runtime state.
   - Frontends read state; they do not become the authoritative runtime.
   - Workers update state through explicit, auditable interfaces.

3. **One final decision authority**
   - Multiple discovery and analysis engines may operate in parallel.
   - Only one coordinator may authorize a state-changing decision for a given portfolio or workflow.
   - Conflicting engines never mutate the same state independently.

4. **Fail closed**
   - Missing, stale, contradictory, malformed, or unsafe data blocks action.
   - Live-money trading remains disabled unless a separate explicit production-readiness process authorizes it.
   - Secrets, credentials, and privileged operations are never exposed to public clients.

5. **Evidence before promotion**
   - New strategies begin in simulation/paper mode.
   - Positive amplification requires sufficient completed evidence and positive cost-adjusted expectancy.
   - Weak or unstable strategies are automatically reduced, quarantined, or pruned.

6. **Test before merge, verify after deploy**
   - Changes use branches and pull requests.
   - Focused automated tests run before merge.
   - Production/preview verification checks actual application behavior after deployment.
   - Red checks are blockers, not decorations.

7. **Observable by default**
   - Every autonomous worker records heartbeat, last successful cycle, next expected cycle, health, failure reason, decision reason, state version, and data freshness.
   - Important decisions are replayable from durable logs or event history.

8. **Recoverable by design**
   - Workers are idempotent where possible.
   - Duplicate execution, restart, timeout, provider outage, partial data, and stale state are expected failure modes and must be handled explicitly.
   - Recovery must not silently reset authoritative state.

9. **Cost-aware automation**
   - Do not use frontend deployments as a runtime database or recurring job mechanism.
   - Avoid unnecessary preview deployments and duplicate CI runs.
   - Run the smallest useful test surface for each change, then broader validation at merge/release boundaries.
   - Persist runtime state in a database or appropriate durable store instead of committing heartbeat artifacts to Git.

10. **Modular specialization**
    - Discovery, analysis, risk, execution/simulation, persistence, presentation, and monitoring remain separate concerns.
    - Components communicate through versioned contracts instead of direct hidden coupling.

## Standard autonomous workflow

Collect -> Validate -> Normalize -> Discover -> Analyze -> Rank -> Risk Gate -> Simulate/Act -> Persist -> Observe -> Learn -> Repeat

Every stage must expose enough metadata to explain why a candidate advanced, was rejected, or was stopped.

## BoodaFlow intelligence model

### BoodaFlow
The coordinator and orchestration layer. It owns workflow progression, state-changing authority, health, retries, and final policy gates.

### BoodaFlow Mentality
The adaptive evidence layer. It learns from completed outcomes, adjusts confidence, suppresses weak sources, and prevents premature positive amplification.

### BoodaFlow Trees Blossom
The branch competition model. Candidate sources/markets/strategies are treated as branches that can seed, observe, bloom, or prune based on current evidence, historical performance, data quality, and portfolio context.

### BoodaFlow Maximum Overdrive
A high-throughput analysis mode, not a risk bypass. It increases parallel discovery and evaluation breadth while preserving the same or stricter risk, safety, and state-integrity rules.

## Trading-system specialization

For the combined Alpha Hunter + Kavora architecture:

- **Alpha Hunter** owns broad opportunity discovery and candidate generation.
- **Kavora Markets** owns deeper portfolio-context analysis, ranking, and strategy evaluation.
- **BoodaFlow** owns the final risk/decision gate and authoritative paper-portfolio mutation.
- **Supabase or another approved durable backend** owns shared persistent runtime state.
- **Vercel/frontends** present state and control surfaces; they are not recurring worker state stores.

### Shared candidate contract

All discovery engines must publish a normalized, versioned candidate containing at minimum:

- candidate_id
- schema_version
- observed_at
- source
- symbol/market
- signal
- raw_confidence
- model/strategy version
- price/reference value
- data freshness metadata
- feature/evidence summary
- rejection/safety metadata when applicable

Kavora may enrich candidates but must preserve source attribution and candidate identity.

### Final decision contract

BoodaFlow produces one final paper decision per evaluated candidate or portfolio action:

- ACCEPT / REJECT / HOLD / EXIT
- adjusted confidence
- risk decision
- portfolio exposure context
- reason codes
- evidence snapshot
- decision timestamp
- decision version

Only accepted paper decisions may mutate the shared paper portfolio.

## Definition of done for autonomous projects

A project is not considered autonomous merely because it has a cron job. It is complete only when:

- normal operation requires no manual trigger;
- state survives restarts;
- duplicate runs cannot create duplicate actions;
- data freshness is enforced;
- failed providers degrade safely;
- retries are bounded;
- important decisions are auditable;
- alerts only surface actionable failures;
- tests protect critical behavior;
- production behavior has been verified;
- runtime costs are monitored and unnecessary deployments/jobs are eliminated.

## Default implementation sequence

1. Define versioned contracts.
2. Establish authoritative persistent state.
3. Separate workers from presentation/deployment.
4. Implement autonomous collection and validation.
5. Add decision/risk gates.
6. Add idempotency and recovery.
7. Add observability and health.
8. Add adaptive learning only from durable completed outcomes.
9. Add focused CI and post-deploy verification.
10. Optimize cost and throughput after correctness is proven.

## Change policy

Changes to this operating standard should be reviewed as architecture changes, because downstream projects are expected to inherit it by default.
