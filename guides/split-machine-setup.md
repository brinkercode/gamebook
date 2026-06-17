# Split-Machine Setup — Homelab + Gaming PC

> **Alternative topology — not the default.** The default in `templates/docs/PROJECT_SETUP.md` is single-machine on the gaming PC. Reach for this split only when you have (a) a dedicated dev-class homelab with 8+ modern cores and 64+ GB RAM, (b) a team large enough that always-on CI / shared services pay for themselves, or (c) a need to keep your gaming PC free of background dev workloads.
>
> Code lives on the homelab (edited via VSCode Remote-SSH); the UE5 editor and playtest live on the gaming PC. GitHub is the sync layer.

---

## 1. Why split

Running the UE5 editor on a headless server is painful — no GPU, no display, no playtest. Running a dedicated server / build pipeline on the same machine you're trying to play on is also painful — competes for resources, requires manual lifecycle. Splitting means each machine does what its hardware is built for.

| Concern | Lives on |
|---|---|
| Code editing (VSCode Remote-SSH target) | Homelab |
| Git repositories (canonical clone) | Homelab |
| GitHub Actions self-hosted runner | Homelab |
| Dedicated UE server build (multiplayer) | Homelab |
| Mock backend (IAP receipt validation, telemetry) | Homelab |
| Wwise SoundBank generation (headless) | Homelab |
| Headless cook for distribution | Homelab |
| C++ compilation for editor binaries | **Gaming PC** (editor needs them locally) |
| UE5 editor (`UnrealEditor`) | Gaming PC |
| Playtest in PIE | Gaming PC |
| Cooked package playtest | Gaming PC |
| Wwise editor (GUI) | Gaming PC |
| GPU profiling (Insights, RenderDoc, PIX) | Gaming PC |
| OBS playtest capture | Gaming PC |

---

## 2. The dev loop

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  Homelab (Linux server)     │         │  Gaming PC (Win/Linux)       │
│                             │         │                              │
│  • VSCode Remote-SSH target │         │  • UE5 editor                │
│  • git origin (push/pull)   │         │  • git origin (pull only)    │
│  • CI runner                │         │  • Playtest + cooked builds  │
│  • Dedicated server (mp)    │         │  • Wwise GUI                 │
│  • Mock IAP / telemetry     │         │  • Profiling                 │
└──────────────┬──────────────┘         └──────────────┬───────────────┘
               │                                       │
               │      ┌────────────────────┐           │
               └─────►│       GitHub       │◄──────────┘
                      │   (sync layer)     │
                      └────────────────────┘
```

**Iteration:**
1. VSCode (on your laptop / wherever you are) opens via Remote-SSH to the homelab.
2. Edit `.h` / `.cpp` / `Content/*.uasset` (via UE asset editor, when needed) on the homelab.
3. `git add`, `git commit`, `git push` from the homelab shell.
4. On the gaming PC: `git pull` (or set up a watcher — see §6).
5. On the gaming PC: `make build` to recompile the C++ slice. Incremental — seconds for one file.
6. On the gaming PC: open `UnrealEditor` (or `make play`) → PIE → playtest.
7. Repeat. Both machines stay in sync via GitHub.

**For multiplayer:**
- Homelab runs the dedicated server build (`make build-server`) and binds to the local network.
- Gaming PC's editor / cooked client connects to `<homelab-ip>:7777`.

---

## 3. Homelab setup

### 3.1 Required
- Linux (Ubuntu 22.04+ recommended) or Windows Server
- 8+ CPU cores
- 32 GB+ RAM (Unreal cook + LFS cache + services adds up)
- 1 TB+ SSD (engine + project + DDC + cooked packages)
- Always-on network
- SSH server (`openssh-server`)

### 3.2 Software install
```bash
# UE5 engine (source build for headless server cook on Linux)
# Link GitHub account to Epic, then:
git clone --depth=1 -b 5.4 https://github.com/EpicGames/UnrealEngine.git /opt/UnrealEngine
cd /opt/UnrealEngine
./Setup.sh
./GenerateProjectFiles.sh
make UnrealEditor      # ~2 hours, ~150 GB
make UnrealServer      # for dedicated server cook (if multiplayer)

# Set system-wide UE_ROOT
echo 'export UE_ROOT=/opt/UnrealEngine' | sudo tee /etc/profile.d/ue.sh

# Toolchain
sudo apt install -y clang-15 lld-15 libvulkan-dev mono-devel git git-lfs build-essential
git lfs install --system

# VSCode Remote-SSH support
sudo apt install -y openssh-server
# Configure SSH per your usual hardening (keys only, no password, fail2ban, etc.)

# Optional: Wwise headless (for SoundBank generation in CI)
# Download Wwise Linux SDK from AudioKinetic, install per their docs
```

### 3.3 GitHub Actions self-hosted runner
```bash
# Per repo: Settings → Actions → Runners → New self-hosted runner → Linux x64
mkdir -p ~/actions-runner && cd ~/actions-runner
# Follow GitHub's download + config commands (token + url)
./config.sh --url https://github.com/<user>/<repo> --token <token>
sudo ./svc.sh install
sudo ./svc.sh start
```

The runner picks up jobs from `.github/workflows/ci.yml`. With UE5 already installed on the homelab, cook + automation tests run in 10–30 min per CI run (vs. hours on hosted runners).

### 3.4 Mock backend services (optional, when ready)
For IAP testing without hitting Steam, run a local mock receipt-validator:
```bash
# Example: Go stub at homelab:8443 that always returns "valid"
cd ~/services/mock-iap && go run main.go    # or systemd unit
```
Point your `gameplay-systems-engineer`-built `URequestReceiptValidation` at `http://<homelab-ip>:8443` during development.

---

## 4. Gaming PC setup

### 4.1 Specs assumed
- 32 GB RAM
- NVIDIA RTX 4070 SUPER (or equivalent)
- AMD Ryzen 5 7600X (or equivalent 6+ core)
- 1 TB NVMe SSD
- Windows 11 or Linux

### 4.2 Software install
- **Epic Games Launcher** + Unreal Engine 5.4+ (same version as homelab — version mismatch is the #1 cause of "editor crashes on open")
- **Git for Windows** (or system git on Linux) + Git LFS
- **Visual Studio 2022 Community** (Windows) with Game Development with C++ workload
  - OR **Rider for Unreal Engine** ($149/yr indie) — recommended for C++ ergonomics; same SSH/Git config as VSCode for code parity
- **AudioKinetic Launcher** + Wwise (same major version as homelab, if using Wwise)
- **OBS Studio** for capture
- **Unreal Insights** (bundled), **RenderDoc** (free), **PIX** (free, Windows)

### 4.3 Clone the project
```powershell
# From PowerShell or Git Bash
cd C:\Dev\repos
git clone git@github.com:<user>/<project>.git
cd <project>
git lfs pull

# Set UE_ROOT (System Properties → Environment Variables)
# UE_ROOT = C:\Program Files\Epic Games\UE_5.4
```

### 4.4 First build + open editor
```powershell
# Regenerate project files
& "$env:UE_ROOT\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" `
  -projectfiles -project="$pwd\<Project>.uproject" -game -rocket -progress

# Compile (15–45 min first time, then incremental)
make build      # or open the .sln in VS and Build

# Open editor
& "$env:UE_ROOT\Engine\Binaries\Win64\UnrealEditor.exe" "$pwd\<Project>.uproject"
```

---

## 5. GitHub LFS — bandwidth math

LFS bandwidth from gaming PC `git pull` is what hurts. A typical UE5 vertical slice clocks 20–80 GB of LFS objects. GitHub LFS free tier = 1 GB/mo bandwidth — burned in one fresh clone.

**Recommendations:**
- Start with a GitHub LFS data pack ($5/mo = 50 GB storage + 50 GB/mo bandwidth) — fine for a 2-person team for ~6 months.
- Outgrow it? Move to GitLab or Backblaze B2 + `git-lfs-s3`. Or self-host `gitea` on the homelab as your LFS origin (the homelab already has the storage).

**Optimization:** `git lfs fetch --recent` (instead of `--all`) on the gaming PC limits the working set to recent refs.

---

## 6. Optional: skip the git roundtrip

For when iteration speed is the bottleneck, an SMB/NFS mount from homelab to gaming PC lets the gaming PC see homelab edits instantly — no commit/push/pull. **Caveats:**

- Network latency on every file open in the editor (UE asset operations are chatty). Only acceptable on a wired GbE+ LAN.
- Two editor instances editing the same `.uasset` from both machines = corruption. Lock workflow becomes manual.
- Cook output (gigabytes per cooked map) shouldn't traverse the mount — keep `Saved/`, `Intermediate/`, `Binaries/` machine-local.

**Default is git push/pull.** Reach for the mount only after you've measured the git roundtrip as a real cost.

If you do go the mount route:
```bash
# Homelab: export the repo via Samba
sudo apt install samba
# Edit /etc/samba/smb.conf — add a share for /home/<user>/repos with the right perms

# Gaming PC: mount as drive Z:
net use Z: \\<homelab-ip>\repos /user:<homelab-user>
```
Open the .uproject from `Z:\<project>\<Project>.uproject` and accept the latency.

---

## 7. CI on the homelab

`.github/workflows/ci.yml` runs on the self-hosted runner. Typical pipeline:

```yaml
on:
  pull_request:
    branches: [main]

jobs:
  gate:
    runs-on: [self-hosted, linux, ue5]
    steps:
      - uses: actions/checkout@v4
        with: { lfs: true }
      - run: make gate STEP=lint
      - run: make gate STEP=test     # headless Functional Tests, -nullrhi
      - run: make gate STEP=build    # editor target compile
      - run: make gate STEP=cook     # slim cook validation

  package-dev:
    runs-on: [self-hosted, linux, ue5]
    needs: gate
    if: github.event.pull_request.draft == false
    steps:
      - uses: actions/checkout@v4
        with: { lfs: true }
      - run: make package-dev
      - uses: actions/upload-artifact@v4
        with:
          name: dev-build-${{ github.sha }}
          path: Build/**
          retention-days: 7
```

The dev-build artifact lands in GitHub Actions; the gaming PC downloads it directly when you want to playtest the actual cooked binary (not just PIE).

**For a 2-person team, run CI on `pull_request` only** — not on `push: main`. The drift window between commit and merge is near-zero at this scale (per [[two-engineer-scale]]).

---

## 8. Where each `make` target runs

| Target | Homelab | Gaming PC | Notes |
|---|---|---|---|
| `make build` | ✓ (CI validates compile) | ✓ (editor needs the binaries) | Run on whichever machine you're opening the editor from. |
| `make gate STEP=lint` | ✓ | ✓ | Run anywhere. |
| `make gate STEP=test` | ✓ (`-nullrhi`) | ✓ | Homelab in CI; gaming PC for local pre-push checks. |
| `make cook-smoke` | ✓ | ✓ | Homelab is faster (more cores, no GUI competition). |
| `make automation-critical` | ✓ | ✓ | Headless on homelab CI; gaming PC for local. |
| `make gauntlet-critical` | Gaming PC only | ✓ | Needs a real display+GPU for the scripted client to run. |
| `make package-dev` / `package-shipping` | ✓ | ✓ | Homelab in CI for distributable artifacts; gaming PC for local debug builds. |
| `make play` (open editor + run map) | ✗ | ✓ | Editor requires GPU. |

---

## 9. Common pitfalls

**Engine version drift.** Gaming PC on 5.4.2, homelab on 5.4.4 → editor crashes opening project files cooked by the other machine. **Pin the patch version on both, in the launcher and source build.**

**Git LFS bandwidth surprise.** Fresh clone on the gaming PC consumes a month of GitHub LFS bandwidth. Use a data pack or self-host LFS.

**Wwise SoundBank version mismatch.** Wwise plugin version + Wwise app version + SDK version all need to match on both machines. Pin Wwise versions in `Plugins/Wwise/Wwise.uplugin` and check the `WwiseAudio/<Project>.wproj` metadata.

**Forgetting to `git pull` on the gaming PC.** Hot loops where you edit on homelab and try to play on gaming PC without pulling = playing yesterday's build. Set up a pre-launch hook: `cd <project> && git pull --ff-only && make build`.

**Trying to run the editor headlessly on homelab.** `UnrealEditor -nullrhi -nosound` works for automation tests but not for actual editor work. Don't fight it — editor stays on the gaming PC.

**Compiling on homelab, opening editor on gaming PC.** The compiled `.so` / `.dll` is OS-specific and lives in `Binaries/`. Each machine must compile for its own platform. Don't push `Binaries/` to git (it's `.gitignore`d for a reason).

---

## 10. When to deviate

This topology works for ~95% of indie projects. Reach for something else when:

- **The gaming PC is your only machine.** Skip the homelab entirely. Run everything on the gaming PC. Just use `PROJECT_SETUP.md` as a single-machine setup.
- **You're prototyping a mobile / VR target.** Editor on the gaming PC, but cook + deploy targets the device directly — no homelab in the loop for cooked builds.
- **You've outgrown LFS bandwidth.** Move LFS origin to self-hosted on the homelab; GitHub becomes code-only.
- **You're shipping a multiplayer game with regular external playtests.** The homelab's dedicated server becomes a real public-facing service; harden accordingly (firewall, observability, automated restarts via systemd).
