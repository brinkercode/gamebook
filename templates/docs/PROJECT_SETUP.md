# {{PROJECT_NAME}} — Project Setup

> Single-machine development: the gaming PC does everything. Code, compile, editor, playtest, profiling, captures, multiplayer testing — all here. Existing always-on infrastructure hosts only the pre-cooked Linux dedicated server when multiplayer realism testing requires it.
>
> If you grow into a split-machine topology later, see `gamebook/guides/split-machine-setup.md`.

---

## 1. Machine roles

| Concern | Gaming PC | Always-on host (existing homelab) |
|---|---|---|
| Code editing (IDE) | ✓ | — |
| Git repos | ✓ | — |
| C++ compile | ✓ | — |
| UE5 editor | ✓ | — |
| PIE multi-client multiplayer testing | ✓ | — |
| Cooked playtest | ✓ | — |
| GPU profiling (Insights / RenderDoc / PIX) | ✓ | — |
| Wwise GUI | ✓ | — |
| OBS capture | ✓ | — |
| `make gate` pre-push | ✓ | — |
| Cooked Linux dedicated server (multiplayer realism) | — | ✓ (thin systemd / Docker container) |

There is no self-hosted CI runner; `make gate` runs locally before push. Per the 1-2 person scale, that's correct — see related rationale in your `feedback-two-engineer-scale` memory.

---

## 2. Gaming PC — what you have

- AMD Ryzen 5 7600X (6C/12T)
- NVIDIA RTX 4070 SUPER
- 32 GB RAM
- 1 TB NVMe SSD recommended (engine ~50 GB + project + DDC + cooked builds adds up fast)
- Wired GbE for LFS pulls
- Xbox Wireless Controller (best UE5 input support) or DualSense
- Closed-back headphones (spatial audio)
- Second monitor (strong recommend)

> Vertical slice perf target = **60 FPS on GTX 1060 / PS5-equivalent**. The 4070 SUPER vastly exceeds that — use Unreal Insights frame budgets and `stat unit` ceilings on the dev rig, don't trust raw framerate.

---

## 3. Software install (gaming PC)

### Engine + IDE
- [ ] **Epic Games Launcher** — https://epicgames.com/launcher
- [ ] **Unreal Engine {{ENGINE_VERSION}}** via the launcher
- [ ] System env var `UE_ROOT` = `C:\Program Files\Epic Games\UE_5.4` (or your install path)
- [ ] IDE — pick one:
  - **JetBrains Rider for Unreal** ($149/yr indie) — recommended for C++ ergonomics
  - **Visual Studio 2022 Community** (free) with workload "Game Development with C++" + Unreal Engine integration
- [ ] **Linux cross-compile toolchain** (required to cook the Linux dedicated server from Windows):
  - Download `v22_clang-16.0.6-...-Linux.exe` from Epic's cross-compile toolchain page
  - Install — sets `LINUX_MULTIARCH_ROOT` env var
  - In Unreal Editor → Platforms → Linux → confirm SDK detected

### Version control
- [ ] **Git for Windows** + Git LFS — `git lfs install` after install
- [ ] SSH key paired to GitHub
- [ ] Optional: SSH key paired to existing homelab (for `scp`/`rsync` of cooked dedicated server)

### Audio middleware (only if `audio = Wwise`)
- [ ] **AudioKinetic Launcher** + Wwise 2023.x — same major version is what matters; pin in the launcher to avoid drift

### Profiling + debug
- [ ] **Unreal Insights** — bundled at `<UE_ROOT>\Engine\Binaries\Win64\UnrealInsights.exe`
- [ ] **RenderDoc** (free) — frame capture, GPU debug
- [ ] **PIX for Windows** (free) — GPU timing

### Capture + content tools
- [ ] **OBS Studio** (free) — playtest capture
- [ ] **Audacity** (free) — SFX cleanup
- [ ] Optional: Blender, Quixel Mixer (free); Substance Painter ($20/mo indie)

### Accounts (cross-cutting, one-time)
- [ ] **Epic Games** (engine + Marketplace + Quixel + MetaHuman)
- [ ] **GitHub** + LFS data pack ($5/mo per 50 GB once project has assets)
- [ ] **AudioKinetic** if Wwise (free under $200k revenue + first 8000 sound IDs)
- [ ] **Discord** (team comms / playtest community)
- [ ] **Steamworks** ($100 one-time per game, before shipping)
- [ ] **Epic Online Services (EOS)** — if cross-platform or EOS Ecom

---

## 4. First clone + first build

```powershell
cd C:\Dev\repos
git clone git@github.com:<user>/{{PROJECT_NAME}}.git
cd {{PROJECT_NAME}}
git lfs pull

# Regenerate IDE project files
& "$env:UE_ROOT\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" `
  -projectfiles -project="$pwd\{{PROJECT_NAME}}.uproject" -game -rocket -progress

# Compile editor target — 15–45 min first time, incremental after
make build

# Open editor
& "$env:UE_ROOT\Engine\Binaries\Win64\UnrealEditor.exe" "$pwd\{{PROJECT_NAME}}.uproject"
```

---

## 5. Daily loop

```
Edit code in IDE  →  make build  →  open editor (or just hot-reload)  →
PIE single-client OR multi-client for multiplayer  →  iterate  →
make gate STEP=lint && STEP=test  →  git push
```

For multiplayer day-to-day: editor → toolbar → Number of Players = 2 (or more) → uncheck "Run Under One Process" → Play. Each client gets its own window. Fast, no networking config.

---

## 6. Multiplayer testing ladder

Use the cheapest option that proves what you're testing.

### 6.1 PIE multi-client (default — gaming PC only)
Editor → Play Settings → Number of Players ≥ 2, Net Mode = "Play As Listen Server" or "Play As Client", "Run Under One Process" OFF.
- **Use for:** day-to-day gameplay work, ability/replication wiring, UI for multiple local players.
- **Won't catch:** real latency, dropped packets, reconnect, server-only authority bugs that PIE's optimizations hide.

### 6.2 Cooked listen-server + cooked client (same gaming PC, separate processes)
```powershell
make package-dev
# Run listen server
& ".\Build\Windows\{{PROJECT_NAME}}\{{PROJECT_NAME}}.exe" L_VerticalSlice?Listen -windowed -ResX=1280 -ResY=720
# Run client (separate cmd) — connects to 127.0.0.1
& ".\Build\Windows\{{PROJECT_NAME}}\{{PROJECT_NAME}}.exe" 127.0.0.1 -windowed -ResX=1280 -ResY=720
```
- **Use for:** boundaries PIE hides — UI focus, input device sharing, audio focus, separate processes' memory.
- **Won't catch:** latency realism, dedicated-server-specific code paths.

### 6.3 Cooked Linux dedicated server on the existing homelab (full realism)
Cook the Linux dedicated server on the gaming PC, ship it to the homelab, run it as a systemd unit. **This is the canonical realism test.**

```powershell
# On gaming PC — cross-cook the dedicated server for Linux
make package-server PLATFORM=Linux
# Output: Build/LinuxServer/{{PROJECT_NAME}}Server.tar.gz (or unpackaged dir)
```

```bash
# Ship to homelab
rsync -avz Build/LinuxServer/ user@homelab:/srv/{{PROJECT_NAME}}-server/

# On homelab — first time only: install as a systemd unit (see template below)
# Then start
sudo systemctl start {{PROJECT_NAME}}-server
sudo journalctl -u {{PROJECT_NAME}}-server -f
```

```ini
# /etc/systemd/system/{{PROJECT_NAME}}-server.service
[Unit]
Description={{PROJECT_NAME}} dedicated server
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/{{PROJECT_NAME}}-server
ExecStart=/srv/{{PROJECT_NAME}}-server/{{PROJECT_NAME}}Server.sh L_VerticalSlice -log -port=7777
Restart=on-failure
RestartSec=5
User=gameserver
Group=gameserver
# Tight resource limits — homelab is running other services
MemoryMax=2G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

Open port 7777/UDP on the homelab firewall (LAN only by default — only forward to internet for external playtests).

- **Use for:** real-network latency profiling, dedicated-server-only code paths (CheatManager off, server auth strict), reconnect/timeout behavior, soak testing.
- **Resource cost on homelab:** ~200-500 MB RAM, one core, no GPU. Won't disrupt citadel-lite / opal-m1-pg / phantom-dashboard. The `MemoryMax=2G` and `CPUQuota=200%` in the unit cap it.

### 6.4 External playtesters over Internet
Only when ready. Either:
- Port-forward 7777/UDP on your router to the homelab; share `<your-public-ip>:7777` with playtesters
- OR use Steam Sockets / EOS P2P relay (no port forwarding needed, gives you NAT traversal). Wire via `OnlineSubsystemSteam` or `OnlineSubsystemEOS`.

---

## 7. Day-to-day `make` targets

```bash
make build                      # Recompile C++
make gate                       # Full pre-push gate
make gate STEP=lint             # Slice gate — fastest
make gate STEP=test             # Functional Tests headless
make gate STEP=build
make gate STEP=cook
make cook-smoke                 # Slim cook of LT_SmokeCook map
make automation-critical        # @critical Functional Tests headless
make gauntlet-critical          # Scripted Gauntlet scenarios
make package-dev                # Dev Windows package
make package-shipping           # Optimized release package
make package-server PLATFORM=Linux   # Cross-cook Linux dedicated server
make index                      # Refresh .claude/INDEX.json
make clean                      # Wipe Intermediate/Saved/DerivedDataCache
```

---

## 8. Pre-push checklist (replaces CI)

Run before every `git push` to main / before opening a PR:

```powershell
make gate STEP=lint
make gate STEP=test
make gate STEP=build
make cook-smoke
```

If you touched the dedicated server code path, also:
```powershell
make package-server PLATFORM=Linux    # validates Linux cross-cook still works
```

Per `feedback-two-engineer-scale` and `feedback-run-full-ci-before-shipping`: a self-hosted CI runner is overkill at this scale; the local pre-push gate is the right answer. Just don't skip it.

---

## 9. Backup strategy

- **Code:** `git push` regularly. Second remote optional: `git remote add backup <other-host>`.
- **LFS:** the GitHub LFS host IS your backup if the remote is healthy. If you move to self-hosted LFS, snapshot the LFS dir nightly to external storage.
- **Project folder:** cloud-sync the repo daily (Dropbox / iCloud / OneDrive), excluding `Intermediate/`, `Saved/`, `DerivedDataCache/`, `Binaries/`.
- **Wwise project (`WwiseAudio/`):** version controlled. `WwiseAudio/<Project>.wproj` + `Originals/` (raw source audio) go in LFS.

---

## 10. Common errors

**`UBT: Could not find engine install`** — `UE_ROOT` is unset or wrong. `echo %UE_ROOT%`.

**`LFS pointer found — binary missing`** — `git lfs pull`. If still failing, check LFS storage quota on the host.

**Wwise `AK_FileNotFound` in editor log** — SoundBanks not generated. Wwise menu → Generate SoundBanks.

**Editor crashes opening project** — most often plugin version mismatch (Wwise, common UI extras) or engine patch drift. Confirm `.uproject` engine version matches what's installed.

**`make gate STEP=test` hangs** — UnrealEditor-Cmd dialog popping up in headless mode. Add `-unattended -nopause -nosplash -nullrhi` to the gate.sh test step.

**Dedicated server on homelab fails to start** — usually missing `.so` dependencies (vulkan, libc++abi). Install on homelab: `sudo apt install libvulkan1 libc++1 libc++abi1`. Check `journalctl -u {{PROJECT_NAME}}-server -n 100` for the actual error.

**Linux cross-compile from Windows fails** — `LINUX_MULTIARCH_ROOT` env var not set or wrong toolchain version. The toolchain version is engine-version-specific; check Epic's docs for the right one for {{ENGINE_VERSION}}.

---

## 11. Team config (`.editorconfig`)

- Line endings: `LF` (even on Windows)
- Indent: spaces, 4 (`.cpp`, `.h`); tabs, 4 (`.ini`)
- Trailing whitespace trimmed
- Final newline required

Verify with `make gate STEP=lint`.
