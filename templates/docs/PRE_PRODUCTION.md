# {{PROJECT_NAME}} — Pre-Production Plan

> The first doc. Every other doc, interview, and agent reads this before doing anything else.
> Populated by the `pre-production-interview` skill. Update in place when scope changes.

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
- [ ] _e.g. Lyra Starter Game_ — _why_

### 2.2 Characters
- [ ] _pack name_ — _why_

### 2.3 Environments
- [ ] **Quixel Megascans** (always — free with Epic ID)
- [ ] _pack name_ — _why_

### 2.4 Weapons / props
- [ ] _pack name_ — _why_

### 2.5 VFX
- [ ] _pack name_ — _why_

### 2.6 Animation
- [ ] _pack name_ — _why_

### 2.7 Audio
- [ ] _pack name_ — _why_
- [ ] _Decision: Wwise / MetaSounds / TBD_

### 2.8 UI
- [ ] **Common UI Plugin** (bundled — enable in Plugins)
- [ ] **Lyra UI** (reference for menu stack)

### 2.9 External free tools
- [ ] Blender — _if you'll touch meshes_
- [ ] Quixel Mixer — _if you'll author materials_
- [ ] OBS Studio — _for playtest capture_
- [ ] Audacity — _for SFX cleanup_

> Full catalog: `gamebook/skills/pre-production-interview/resources/free-assets-catalog.md`

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

### 3.3 OUT — explicitly not this game
- _Feature_ — _why excluded_

> Full FPS feature catalog: `gamebook/skills/pre-production-interview/resources/feature-checklist.md`

---

## 4. Day-1 Test Loop (the 2-minute proof)

The smallest playable thing that proves the core fantasy works.

**Loop:**
1. _Player spawns at …_
2. _Player does … (the one button press that has to feel amazing)_
3. _Player encounters …_
4. _Player succeeds / fails when …_
5. _Player sees …_

**Success signal:** _How we'll know it's working — telemetry counter / playtester quote / gut feel_

**Tuning targets (week 1):**
- _e.g. Time-to-first-shot < 8 seconds from spawn_

---

## 5. Tooling Confirmations

| Tool | Choice |
|---|---|
| IDE | _Rider for UE / VS 2022 / VSCode+clangd / Xcode_ |
| Controller | _Xbox / PS5 / 8BitDo / KBM only_ |
| Capture | _OBS / ShadowPlay / Steam recorder / capture card_ |
| Playtest cadence | _weekly / biweekly / on-demand_ |
| Playtester pool | _names or "3 friends in Discord"_ |
| Crash reporting | _built-in CRC / Sentry / BugSplat / none yet_ |
| Source control host | _GitHub / GitLab / Bitbucket_ |
| LFS storage | _GitHub LFS / GitLab / Backblaze B2 / self-hosted_ |
| Task tracking | _Linear / Notion / ClickUp / Trello / GitHub Projects_ |

---

## 6. Risk Flags

_Anything that came up that smells expensive, risky, or out of indie scope. Decide before locking._

- ⚠️ _flagged item_ — _decision_

---

## 7. Next Interviews to Run (in order)

1. [ ] `concept-interview`
2. [ ] `art-direction-interview`
3. [ ] `narrative-interview`
4. [ ] `audio-direction-interview`
5. [ ] `monetization-interview` _(skip if no microtransactions in slice)_
6. [ ] `target-platform-interview`
7. [ ] `project-scaffolder`

---

## 8. Locked decisions log

| Date | Decision | Rationale |
|---|---|---|
| _YYYY-MM-DD_ | _decision_ | _rationale_ |
