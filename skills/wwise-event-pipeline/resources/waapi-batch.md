# WAAPI batch authoring

Requires Wwise authoring app running with WAAPI enabled (default port 8080), `pip install waapi-client`.

```python
from waapi import WaapiClient

with WaapiClient() as client:
    # create an event + play action targeting an existing sound
    evt = client.call("ak.wwise.core.object.create", {
        "parent": "\\Events\\Default Work Unit",
        "type": "Event", "name": "Play_Rifle_Fire",
        "children": [{
            "type": "Action", "name": "",
            "@ActionType": 1,  # Play
            "@Target": "\\Actor-Mixer Hierarchy\\Default Work Unit\\Weapons\\Rifle_Fire",
        }],
        "onNameConflict": "merge",
    })

    # RTPC (Game Parameter)
    client.call("ak.wwise.core.object.create", {
        "parent": "\\Game Parameters\\Default Work Unit",
        "type": "GameParameter", "name": "RTPC_Player_Health",
        "@Min": 0, "@Max": 100, "onNameConflict": "merge",
    })

    # assign to a bank
    client.call("ak.wwise.core.soundbank.setInclusions", {
        "soundbank": "\\SoundBanks\\Default Work Unit\\SB_Weapons",
        "operation": "add",
        "inclusions": [{"object": evt["id"], "filter": ["events", "structures", "media"]}],
    })

    client.call("ak.wwise.core.project.save")
```

Headless alternative when the authoring app can't run: edit the Wwise work-unit XML files directly
(they're stable, documented XML — `Events/Default Work Unit.wwu`), then regenerate banks with
`WwiseConsole generate-soundbank <project>.wproj` in CI. Prefer WAAPI when available; XML edits
must round-trip through a project load before being trusted.

Idempotency: `onNameConflict: "merge"` everywhere; scripts re-run clean.
