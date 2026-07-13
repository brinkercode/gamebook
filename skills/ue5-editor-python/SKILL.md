---
name: ue5-editor-python
description: Deterministic binary-asset authoring — create/modify .uasset content (Blueprints, Data Assets, Niagara, materials, levels) via headless editor Python scripts instead of hand-editing binaries. The generator script is the reviewable artifact.
version: 1.0
---

# UE5 Editor Python — the deterministic asset channel

Agents cannot hand-author `.uasset`/`.umap` binaries. This skill is the studio's answer: every
binary asset is *generated* by a Python script run headlessly through the editor. The script is
text — reviewable, diffable, re-runnable, gate-verifiable. The binary is build output.

## When to use

Any time a wave task needs an asset that isn't plain text: Data Assets, DataTables from CSV,
Blueprint subclasses of C++ bases, Niagara systems, material instances, widget blueprints,
level actors/placement, input mapping contexts.

## How it works

1. Write the generator under `Tools/Python/gen/<domain>_<asset>.py` using the `unreal` module
   (`unreal.AssetToolsHelpers`, `unreal.EditorAssetLibrary`, factory classes).
2. Idempotent by construction: check `EditorAssetLibrary.does_asset_exist` first; update in place
   rather than duplicate; script ends with `save_loaded_asset`.
3. Run headless: `UnrealEditor-Cmd <project>.uproject -run=pythonscript -script="Tools/Python/gen/<file>.py" -unattended -nullrhi`
   (wrap via `make asset-gen SCRIPT=...` if the Makefile target exists).
4. Verify: re-run is a no-op; `make index` picks the asset up; cook-smoke proves it cooks.
5. Record in the handoff's `assets_authored[]`: `{asset_path, generator_script, summary}`.

## Rules

- The generator script is committed; treat it like source. Never edit the generated binary by hand afterward — regenerate.
- One script per asset family, parameterized, not one per asset.
- BP logic stays thin (systems live in C++) — a generated Blueprint should mostly wire events to C++ functions and set defaults.
- Requires the **Python Editor Script Plugin** enabled (scaffold enables it by default).

## Resources (read on demand)

- `resources/recipes.md` — factory snippets per asset type (DataAsset, DataTable-from-CSV, BP subclass, Niagara, material instance, IMC)
- `resources/level-editing.md` — spawning/placing actors in levels headlessly
