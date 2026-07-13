# Wave protocol — how agents behave when a workflow invokes them

Every agent in `agents/` runs in one of two modes. Read this once; it governs the contract with
the L2 control plane (`.claude/workflows/*-wave.js`). The studio metaphor is literal: waves are
the producer's process; department verifiers are QA; nobody grades their own work.

## Mode A — schema-driven (a wave invoked you)

The wave calls you with `agentType: <you>` **and a JSON Schema**. The StructuredOutput tool forces
your final message to match that schema. In this mode:

1. **Return exactly the schema object. Nothing else** — no prose, no markdown fence. The schema is
   the contract; a handoff file is optional (skip it unless the wave's prompt asks for one).
2. **Do not gate yourself as truth.** Run your slice checks to *inform* your work, but your
   `gate_result` / pass-fail self-report is **advisory only** — an independent `qa-gate-verifier`
   re-runs the gate and produces the verdict that advances the wave. You get no vote.
3. **Do only your one job.** The wave owns ordering, retries, and integration. Don't run the full
   `make gate`, don't start the next phase, don't commit.
4. **Respect the stage.** `resolve-project` gives the wave the project's lifecycle stage. Past
   content-lock, additions are defects; in beta, the regime is debug-only. If your task violates
   the stage's regime, return `status: "blocked"` with the reason instead of doing it anyway.

## Mode B — legacy inline (a `/command` or the main loop invoked you directly)

No schema is enforced. Write `.claude/handoffs/<you>.json` per [HANDOFF.md](HANDOFF.md) **and**
emit the same JSON as your final message.

## Roles vs agents (staffing)

Waves address **roles** (`design-combat`, `eng-network`). At `solo`/`indie` staffing, several roles
are played by one agent per the merge table in `references/PROFILES.json`. If you're invoked as a
merged seat, you carry every merged role's mandate for this task — but still emit one schema object.

## Binary-asset rule (UE5 reality)

You cannot hand-author `.uasset`/`.umap` binaries. Authored surfaces are text: C++, `.ini`,
DataTable CSV/JSON, editor **Python scripts** run via `UnrealEditor-Cmd -run=pythonscript`
(see `skills/ue5-editor-python`). When you create assets that way, record them in
`assets_authored[]` with the generator script path — the script, not the binary, is the reviewable
artifact.

## The one rule (both modes)

The layer that does the work is never trusted to grade itself. Whether you self-report `pass` or
not, a separately-invoked verifier decides. Authors author; verifiers verify; greenlight panels —
which never built the thing being judged — are the only writers of `stage`. See
[../../.claude/workflows/README.md](../../.claude/workflows/README.md) and
[schemas/README.md](schemas/README.md).
