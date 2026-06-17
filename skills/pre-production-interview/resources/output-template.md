# `docs/PRE_PRODUCTION.md` Template

> Populate every section. Replace `{{PROJECT_NAME}}` everywhere. Delete the italic guidance once filled.

---

```markdown
# {{PROJECT_NAME}} — Pre-Production Plan

> The first doc. Every other doc, interview, and agent reads this before doing anything else.

**Status:** _Locked / Draft_
**Owner:** _your-name_
**Last updated:** _YYYY-MM-DD_

---

## 1. Aesthetic Paragraph

_One paragraph. Three to five sentences. Genre + mood + visual reference + a moment. Quote at least two reference games and one film/show if helpful. This paragraph is the bible — every other doc and interview must align._

> _"{{PROJECT_NAME}} is …"_

**Reference games:**
- _Game 1 — what we're borrowing_
- _Game 2 — what we're borrowing_
- _Game 3 — what we're explicitly NOT borrowing_

**Reference film/show (if applicable):** _Title — for what (lighting, pacing, color)_

---

## 2. Free Asset Shopping List

Grab these from the Epic Games Launcher / Quixel Bridge / external free sources BEFORE building anything custom. Check each box when imported to `Content/Marketplace/<PackName>/`.

### 2.1 FPS sample / starter project
- [ ] _e.g. Lyra Starter Game_ — _why: starting point for GAS + Common UI + input_

### 2.2 Characters
- [ ] _e.g. Paragon: Aurora_ — _why: matches stylized aesthetic, fully rigged_
- [ ] _e.g. MetaHuman Sample_ — _why: NPC variety_

### 2.3 Environments
- [ ] **Quixel Megascans** (always) — _free with Epic ID, browse via Quixel Bridge_
- [ ] _e.g. Soul: City_ — _why: matches urban aesthetic_

### 2.4 Weapons / props
- [ ] _e.g. Infinity Blade: Weapons_ — _why: 130+ melee weapons for fantasy build_

### 2.5 VFX
- [ ] _e.g. Particle Effects Pack_ — _why: starting point for impact FX_

### 2.6 Animation
- [ ] _e.g. Game Animation Sample_ — _why: motion-matching locomotion_

### 2.7 Audio
- [ ] _e.g. Freesound.org curated set_ — _why: SFX library for first-pass weapon/UI sounds_
- [ ] _Decision: Wwise / MetaSounds / TBD_

### 2.8 UI
- [ ] **Common UI Plugin** (bundled) — _enable in Plugins_
- [ ] **Lyra UI** (reference) — _menu stack as template_

### 2.9 External free tools to install
- [ ] Blender (3D modeling)
- [ ] Quixel Mixer (materials)
- [ ] OBS Studio (playtest capture)
- [ ] Audacity (audio cleanup)

---

## 3. Vertical Slice Feature Set

### 3.1 IN — vertical slice must ship with these (≤ 5)
1. _Feature_ — _one-line rationale tying it to the aesthetic paragraph_
2. _Feature_ — _…_
3. _Feature_ — _…_
4. _Feature_ — _…_
5. _Feature_ — _…_

### 3.2 LATER — post-vertical-slice (parking lot)
- _Feature_ — _why deferred_
- _Feature_ — _…_

### 3.3 OUT — explicitly not this game
- _Feature_ — _why excluded_
- _Feature_ — _…_

---

## 4. Day-1 Test Loop (the 2-minute proof)

The smallest playable thing that proves the core fantasy works.

**Loop:**
1. _Player spawns at …_
2. _Player does … (the one button press that has to feel amazing)_
3. _Player encounters …_
4. _Player succeeds / fails when …_
5. _Player sees …_

**Success signal:** _How will we know it's working? (telemetry counter / playtester quote / gut feel)_

**Tuning targets (week 1):**
- _e.g. Time-to-first-shot < 8 seconds from spawn_
- _e.g. 80% of playtesters reach the encounter without prompting_

---

## 5. Tooling Confirmations

| Tool | Choice |
|---|---|
| IDE | _Rider for UE / VS 2022 / VSCode+clangd / Xcode_ |
| Controller | _Xbox / PS5 / 8BitDo / KBM only_ |
| Capture | _OBS / ShadowPlay / Steam recorder / capture card_ |
| Playtest cadence | _weekly / biweekly / on-demand_ |
| Playtester pool | _3 friends / Discord / Steam Playtest / external_ |
| Crash reporting | _built-in CRC / Sentry / BugSplat / none yet_ |
| Source control host | _GitHub / GitLab / Bitbucket_ |
| LFS storage | _GitHub LFS / GitLab / Backblaze B2 / self-hosted_ |
| Task tracking | _Linear / Notion / ClickUp / Trello / GitHub Projects_ |

---

## 6. Risk Flags

_Anything that came up in the interview that smells expensive, risky, or out of indie scope. Address each before locking the plan._

- ⚠️ _e.g. "Multiplayer co-op" — flagged but user wants it. Decision: defer to LATER, single-player only for vertical slice._
- ⚠️ _e.g. "Custom shader for water" — requires shader engineer or weeks of trial-and-error. Decision: use Megascans water material for v1._
- ⚠️ _e.g. "Voice acting for protagonist" — recording + processing is real cost. Decision: text-only barks for vertical slice._

---

## 7. Next Interviews to Run (in order)

1. [ ] `concept-interview` — refines aesthetic paragraph into design pillars + multiplayer stance
2. [ ] `art-direction-interview` — refines visual style + locks asset list
3. [ ] `narrative-interview` — story, opening hook, characters
4. [ ] `audio-direction-interview` — refines audio direction from §2.7
5. [ ] `monetization-interview` — in-game microtransactions plan (if any)
6. [ ] `target-platform-interview` — Steam / EOS / console specifics, min spec
7. [ ] `project-scaffolder` — writes `project.config.json`, runs `gamebook-init.sh`

---

## 8. Locked decisions log

_Every irreversible decision goes here with date + rationale. Future you will thank present you._

| Date | Decision | Rationale |
|---|---|---|
| _YYYY-MM-DD_ | _e.g. Lyra as starter project_ | _GAS pre-wired, modern Common UI, saves 2-3 weeks_ |
| _YYYY-MM-DD_ | _e.g. Single-player only for vertical slice_ | _Multiplayer = entire second project's worth of work_ |
```
