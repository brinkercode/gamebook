# Verdict schemas — the wave ↔ agent contract

Every `agent()` call in a wave passes one of these JSON Schemas; the harness's structured-output
mechanism forces the agent's final message to match it. Waves embed **compact mirrors** of these
(scripts have no filesystem access) — the canonical definitions live here.

| Schema | Emitted by | Read by |
|---|---|---|
| `project.schema.json` | `resolve-project` | every wave (binding: capabilities + stage + staffing) |
| `handoff.schema.json` | authors (eng-*, design-technical, art-*, audio-*, narrative-*) | wave + downstream agents (`systems_surface[]` is the C++→BP contract) |
| `gate-verdict.schema.json` | `qa-gate-verifier` | wave — **the only verdict that advances a build step** |
| `greenlight-verdict.schema.json` | greenlight panels (director agentTypes on the `greenlight`/`judge` tier) | stage-transition waves — the only writers of `stage` |
| `review.schema.json` | department directors (eng/art/design) | wave (blockers fail it) |
| `security.schema.json` | `eng-director` vs SECURITY_CHECKLIST.md | wave |
| `finding.schema.json` | review-wave dimension reviewers | adversarial verifier → report |
| `playtest-report.schema.json` | `qa-playtest-analyst` | playtest/slice waves (fun ≠ correctness) |
| `defect-inventory.schema.json` | `qa-bug-hunter`, bug-bash triage | alpha/beta/rc gates (P0–P4 counts) |
| `crash-inventory.schema.json` | `qa-crash-correlator` | hotfix/bug-hunt waves |
| `milestone-acceptance.schema.json` | `producer` (independent review seat) | milestone-wave (deficiency-list loop) |
| `cert-verdict.schema.json` | `qa-compliance` | cert-preflight/release waves (go/no-go) |
| `perf-report.schema.json` | `qa-gate-verifier` (stat capture) | perf-budget-wave |
| `asset-audit.schema.json` | `qa-lead` | asset-audit-wave |

**Non-trusting rule:** `handoff.schema.json` keeps `gate_result` for back-compat, but gate logic
**ignores** it — only `gate-verdict.schema.json` from an independent `qa-gate-verifier` advances a
wave. Same shape one level up: only `greenlight-verdict.schema.json` from a panel that did not
build the work advances a *stage*.
