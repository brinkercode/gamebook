# Generator recipes

## Data Asset
```python
import unreal
tools = unreal.AssetToolsHelpers.get_asset_tools()
path, name = "/Game/Data/Weapons", "DA_Rifle"
if not unreal.EditorAssetLibrary.does_asset_exist(f"{path}/{name}"):
    factory = unreal.DataAssetFactory()
    factory.set_editor_property("data_asset_class", unreal.load_class(None, "/Script/MyGame.WeaponData"))
    asset = tools.create_asset(name, path, None, factory)
else:
    asset = unreal.EditorAssetLibrary.load_asset(f"{path}/{name}")
asset.set_editor_property("base_damage", 42.0)
unreal.EditorAssetLibrary.save_loaded_asset(asset)
```

## DataTable from CSV
```python
import unreal
factory = unreal.CSVImportFactory()
factory.automated_import_settings.import_row_struct = unreal.load_object(None, "/Script/MyGame.FWeaponRow")
task = unreal.AssetImportTask()
task.filename = unreal.Paths.project_dir() + "Source/Data/weapons.csv"
task.destination_path = "/Game/Data"
task.destination_name = "DT_Weapons"
task.factory = factory
task.automated = True
task.save = True
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
```

## Blueprint subclass of a C++ base
```python
import unreal
factory = unreal.BlueprintFactory()
factory.set_editor_property("parent_class", unreal.load_class(None, "/Script/MyGame.PickupBase"))
bp = unreal.AssetToolsHelpers.get_asset_tools().create_asset("BP_HealthPickup", "/Game/Blueprints/Pickups", None, factory)
# defaults on the CDO:
cdo = unreal.get_default_object(bp.generated_class())
cdo.set_editor_property("heal_amount", 25.0)
unreal.EditorAssetLibrary.save_loaded_asset(bp)
```

## Niagara system (duplicate-and-parameterize a template)
```python
import unreal
src = "/Game/VFX/Templates/NS_BurstTemplate"
dst = "/Game/VFX/NS_HealBurst"
if not unreal.EditorAssetLibrary.does_asset_exist(dst):
    unreal.EditorAssetLibrary.duplicate_asset(src, dst)
ns = unreal.EditorAssetLibrary.load_asset(dst)
# set user parameters via NiagaraSystemEditorData / set_niagara_variable_* helpers
unreal.EditorAssetLibrary.save_loaded_asset(ns)
```

## Material instance
```python
import unreal
factory = unreal.MaterialInstanceConstantFactoryNew()
factory.set_editor_property("initial_parent", unreal.EditorAssetLibrary.load_asset("/Game/Materials/M_Master"))
mi = unreal.AssetToolsHelpers.get_asset_tools().create_asset("MI_Rock_Mossy", "/Game/Materials/Instances", None, factory)
unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(mi, "Roughness", 0.8)
unreal.EditorAssetLibrary.save_loaded_asset(mi)
```

## Input Mapping Context + Action
```python
import unreal
tools = unreal.AssetToolsHelpers.get_asset_tools()
ia = tools.create_asset("IA_Dash", "/Game/Input", unreal.InputAction, unreal.DataAssetFactory())
imc = unreal.EditorAssetLibrary.load_asset("/Game/Input/IMC_Default")
# map key via imc.map_key(ia, unreal.InputCoreTypes.KEY_LeftShift) pattern
unreal.EditorAssetLibrary.save_loaded_asset(ia)
unreal.EditorAssetLibrary.save_loaded_asset(imc)
```

Headless run wrapper:
```bash
"$UE_ROOT/Engine/Binaries/Linux/UnrealEditor-Cmd" "$PROJECT.uproject" \
  -run=pythonscript -script="Tools/Python/gen/weapons_da.py" -unattended -nullrhi -nosplash
```
