# Gamebook Rules

> Auto-loaded standards copied into every project's `.claude/rules/`. Edit and they apply on the next session — no rebuild step.

These rule files are the source of truth for how Claude Code reasons about a gamebook project. `gamebook-init.sh` copies them into each new project. They are also referenced by every agent's `AGENT.md` (read on-demand for the relevant scope).

Treat `rules/*.md` as plain Markdown that the IDE (Claude Code, Continue.dev, Cursor, etc.) loads via path scoping in frontmatter.

---

## Files

| File | Scope | Read by |
|---|---|---|
| [`standards.md`](standards.md) | Universal rules — apply to every task, every project, every surface | All task types |
| [`ue5-cpp.md`](ue5-cpp.md) | UPROPERTY/UFUNCTION/UCLASS, header/cpp split, smart pointers, hot reload | Any C++ work |
| [`ue5-blueprints.md`](ue5-blueprints.md) | When BP is appropriate, performance, nativization, BP communication | Any Blueprint work |
| [`ue5-gas.md`](ue5-gas.md) | GameplayAbility lifecycle, GameplayEffects, AttributeSets, GameplayTags, prediction | Any GAS work |
| [`ue5-replication.md`](ue5-replication.md) | RPC types, role checks, Replication Graph basics | Any multiplayer / replication work |
| [`ue5-naming.md`](ue5-naming.md) | Full prefix table — BP_/WB_/M_/T_/SK_/A_/DA_/DT_/NS_/GA_/GE_ etc. | All asset and class naming |
| [`ue5-perf.md`](ue5-perf.md) | 60fps budgets, draw calls, LOD, Stat commands, Unreal Insights | Any perf/optimization work |
| [`ue5-input.md`](ue5-input.md) | Enhanced Input only, IMC priority, context swap on state | Any input / control work |
| [`ue5-niagara.md`](ue5-niagara.md) | VFX guidelines, GPU sims, LOD, pooling | Any VFX / Niagara work |
| [`wwise.md`](wwise.md) | Wwise integration, switch/state, RTPC, banks | Any audio work |
| [`git-lfs.md`](git-lfs.md) | .gitattributes patterns, lock workflow, max binary size, exclude Saved/Intermediate | Any asset commit / LFS work |
| [`ue5-microtransactions.md`](ue5-microtransactions.md) | Cosmetics-only baseline, soft/hard currency, server-side validation, anti-dark-pattern | Any monetization feature |

---

## When to edit

- **Adding a new rule** — edit the appropriate file. Next session in any project picks it up (rules are copied at `gamebook-init.sh` time; rerun `gamebook-init.sh` in old projects to refresh, or symlink `.claude/rules/` to gamebook for live updates).
- **Changing a rule** — edit and save.
- **New system / tool area** — create a new `.md` file here, add path scoping in the frontmatter so the IDE loads it for the right files.
- **Removing a rule** — delete the line or section.

---

## Writing style and conventions

- **Direct imperatives** — "Never write gameplay logic in a handler Blueprint", "Always replicate via UPROPERTY with Condition". Not "it's best practice to..."
- **Call out system names explicitly** — "Use **UAbilitySystemComponent**", not "use the ability component."
- **Cite exact paths** — `Source/<ProjectName>/`, `Content/Core/`, `.claude/handoffs/systems.json`.
- **Code examples are small** — 10–20 lines, one specific pattern. Full implementations bloat context.
- **"Never" rules are non-negotiable** — reserve for actual footguns. Exceptions go on the same line: "prefer X over Y except when Z."
- **Group by domain, not alphabet** — related rules stay together.
- **Frontmatter `paths:`** — IDE tooling uses this to scope rules to relevant files. Keep accurate.

---

## Relationship to other gamebook docs

`rules/*.md` are **hard standards** — short, enforceable, IDE-loaded.
Top-level gamebook files (`guides/`, `agents/`) are **explanatory** — full walkthroughs, historical context, rationale for humans.

When writing a new explanatory doc, extract the enforceable parts into the matching `rules/*.md`.
