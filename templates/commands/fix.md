---
description: Small, scoped change (bug fix, refactor, one-file feature). Single agent, one review pass, gate. No multi-phase orchestration.
argument-hint: <what to change in plain English>
---

# /fix — small-change pipeline

For changes **scoped to a single surface**: one C++ class, one Blueprint, one UMG widget, or one Data Asset. If the change touches both a C++ system and its Blueprint consumers, or modifies a GAS AttributeSet schema, use `/ship` instead.

Sizing rubric:

| Size | Examples | Command |
|---|---|---|
| Trivial | Comment, rename, INI value, Data Table row | Just do it inline. No command. |
| Small | Single C++ class fix, internal refactor, Blueprint logic tweak, widget styling, ability tuning | `/fix <description>` |
| Full feature | New ability + Blueprint wiring + level scripting · GAS AttributeSet schema change · New weapon with C++ + BP + VFX + audio | `/ship <description>` |

---

## Phase 0 — Prep

1. **Require `project.config.json`.**
   ```bash
   test -f project.config.json && \
     jq -e '.stack.engine and .stack.abilities' project.config.json >/dev/null
   ```
   If missing/malformed, STOP with:

   > `project.config.json` missing. Run the `project-scaffolder` agent first
   > (it can infer choices from existing code in brownfield projects), then re-run `/fix`.

2. **Load engine context** from `project.config.json`. When you read or edit code, the matching `.claude/rules/ue5-cpp.md` or `.claude/rules/ue5-blueprints.md` fires via path scoping — trust it for syntax/idioms.
3. **Scope check.** If `$ARGUMENTS` is under 4 words or vague, `AskUserQuestion` ONCE to clarify.
4. **Detect shape:**
   ```bash
   test -f Makefile && grep -q "^gate:" Makefile && echo HAS_GATE
   ```
5. **Capture base SHA:** `git rev-parse --short HEAD`.
6. **No handoff dir reset** — `/fix` doesn't use multi-agent handoffs. If you need them, escalate to `/ship`.

---

## Phase 1 — Make the change (you, directly)

Do the work yourself. No subagent. Read the file(s), edit them, run the slice gate.

**Escalation triggers — STOP and tell the user "re-run as `/ship $ARGUMENTS`" if:**
- The change requires editing both a C++ class and one of its Blueprint consumers in non-trivial ways.
- It adds or renames a `UPROPERTY` on a `UAttributeSet` subclass (GAS schema change).
- It requires a new Niagara System, Wwise Event, or Input Action that also needs Blueprint or level wiring.
- It touches both `Source/` and `Content/` in non-trivial ways.

After editing:
```bash
make gate STEP=build && make gate STEP=test
```

If build or tests fail on the changed slice, fix them. One retry. If they still fail, STOP and report.

---

## Phase 2 — Review (one agent)

```
Agent[code-reviewer]: <BRIEF — review the diff from <base> to HEAD>
```

The reviewer reads `git diff <base>..HEAD`, applies the code-reviewer checklist (GAS pattern audit, save/asset/perf hygiene), returns a JSON handoff. Address blockers before Phase 3.

For changes touching:
- Network replication (`UPROPERTY(Replicated)`, RPCs, `GetLifetimeReplicatedProps`)
- Save/Load (`USaveGame` subclasses, slot names)
- Platform APIs (Steam MicroTxn, EOS Ecom, console stores)
- Input security surfaces

also spawn `code-reviewer` with a security flag in the BRIEF — it applies the security checklist section.

---

## Phase 3 — Validation

```bash
make gate          # full integrated gate (build + cook-smoke + automation-critical)
```

---

## Phase 4 — Report

```
✅/❌ /fix <slug>  ·  <duration>

Change:
  <one-sentence summary>

Files: <N>
  <path1> — <one-liner>

Review:
  code-reviewer        : <pass/fail> · <B blockers>

Gate:
  make gate            : <pass/fail>

Next: <ready to commit | list of blockers | "escalate to /ship">
```

**Then stop.** The user commits.

---

## Hard rules

- **One surface.** Editing across `Source/` AND `Content/` with non-trivial changes in both → switch to `/ship`.
- **No GAS AttributeSet schema changes.** Those require systems→content handoff coordination. Use `/ship`.
- **No new top-level Plugins or module dependencies** unless trivially obvious and explained in the diff.
- **One review pass, one retry max.** If review keeps finding blockers, you misjudged scope — escalate.
- **No commits.** User reviews and commits manually.
