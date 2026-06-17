# Claude Code Hooks — Gamebook (UE5 FPS)

> Quality + lifecycle hooks for Unreal Engine 5 game development. `gamebook-init.sh` symlinks all four into `.claude/hooks/` and `.git/hooks/pre-commit` automatically.

---

## The Four Hooks

### `pre-commit.sh` — Fast staged-file checks (blocks bad commits)

Runs only on staged files (<10s target). Blocks commit on failure.

- **Git LFS**: Blocks any binary >100MB not tracked by Git LFS; blocks `.uasset`/`.umap`/`.fbx`/`.png`/`.wav`/`.ogg` if NOT in LFS
- **Saved/Intermediate/DerivedDataCache**: Blocks commits that include transient directories
- **Naming conventions**: Light check on changed `.uasset` paths against UE5 prefix rules (BP_, M_, T_, S_, DA_, etc.)
- **Engine version**: Blocks commit to `main` if `.uproject` Engine version mismatches `Config/DefaultEngine.ini`
- **Clang-format**: Runs `clang-format --dry-run` on staged C++ files (warns if missing; doesn't block)

Installed by `gamebook-init.sh` as `.git/hooks/pre-commit` symlinked to this file.

### `gate.sh` — Deterministic full check (the agent contract)

Every agent runs `make gate` (which calls `gate.sh`) before emitting a HANDOFF. Same checks CI runs.

- `lint`: clang-format on Source/ (requires UE_ROOT env; skips if missing)
- `test`: UnrealEditor-Cmd with `-ExecCmds="Automation RunTests Project.+Functional;Quit"` (Functional Tests tagged @critical)
- `build`: UnrealBuildTool compile editor target
- `cook`: Slim variant cook (Development, single platform, single map)
- `index`: Regenerate `.claude/INDEX.json`

Exit 0 = pass (`{ "gate_result": "pass" }`). Non-zero = structured JSON describing the failed step. Run a single step with `bash gate.sh lint`.

### `post-commit-audit.sh` — Diagnostic context for Claude

Runs after `git commit` via Claude Code's PostToolUse hook. Reports design/structure findings as `additionalContext` so Claude sees them in-context. Also re-runs `gen-index.sh` to keep `.claude/INDEX.json` fresh.

- Warns if `Content/` changed but no `DA_` or `DT_` data assets updated
- Warns if `Source/` changed but no Functional Test added/touched
- Warns if `Config/DefaultGame.ini` or `Config/DefaultEngine.ini` changed without a note in commit message

### `session-end.sh` — Auto-refresh repo data when chat ends

Runs on Claude Code's `Stop` event (chat finishes, agent stops, conversation ends). Cheap and idempotent. Each session-end:
1. Refreshes `.claude/INDEX.json` so the next conversation/agent gets a current map.
2. Appends a one-line entry to `.claude/activity.log` capturing branch, dirty/clean state, files changed, commits in last 24h, session id.
3. Trims the log to the last 500 lines.
4. Cleans `DerivedDataCache/` and `Intermediate/` directories if safe.

The log is `.gitignore`d. Read it via `tail -20 .claude/activity.log` for a quick "what's happened lately" view across sessions.

---

## Setup (manual — `gamebook-init.sh` does this for you)

`.claude/settings.json` registers `post-commit-audit.sh`:

```json
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Bash", "hooks": [
        { "type": "command", "command": ".claude/hooks/post-commit-audit.sh" }
      ]}
    ]
  }
}
```

`.git/hooks/pre-commit` symlinks to `pre-commit.sh`:

```bash
ln -sf "$GAMEBOOK/hooks/pre-commit.sh" .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

`Makefile` wraps `gate.sh`:

```make
gate:
	@bash $(GAMEBOOK)/hooks/gate.sh
```

---

## Customizing post-commit checks

`post-commit-audit.sh` has `CUSTOMIZE` comment markers for project-specific GAS patterns or asset naming rules. Edit per project — the file is symlinked from gamebook, so prefer adding rules upstream when they generalize.
