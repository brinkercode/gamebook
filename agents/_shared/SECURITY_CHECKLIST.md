# Security Checklist

> Quick-reference checklist for the code-reviewer and build-release-engineer agents. Read only the sections relevant to the current change. UE5 / indie FPS context — focus on save tampering, microtransaction integrity, and network trust.

---

## Save File Integrity {#save}

- `USaveGame` slot bytes encrypted with `FAES::EncryptData` before write
- Encryption key derived per-install via `FPlatformProcess::GetMachineId` (or platform equivalent) — never hardcoded constant
- Schema version field FIRST in every `USaveGame` subclass; migration path on load
- HMAC or checksum byte block at end of slot — reject mismatched on load
- Cloud sync (Steam Cloud / EOS PlayerData) uses the same encrypted payload, never plaintext
- No `UObject*` raw refs serialized — `TSoftObjectPtr` only
- Slot reads catch deserialization exceptions and fall back to "corrupt save" UX, never crash

---

## Microtransactions (Steam MicroTxn / EOS Ecom) {#monetization}

- **Server-authoritative validation** — never grant entitlements from a client RPC alone
- Steam: `ISteamUserStats::InitTxn` → server callback `MicroTxnAuthorizationResponse_t` → server-side `FinalizeTxn`
- EOS: `EOS_Ecom_QueryEntitlements` from a backend service, never trust client `EOS_Ecom_Checkout` result
- Receipts/transactions persisted server-side; client only gets a redeemable token
- Entitlement state recomputed from server source-of-truth on every login — never cached client-only
- Cosmetics-only economy (locked decision). Any item touching gameplay attributes = automatic review escalation
- Console store integration (PlayStation/Microsoft/Nintendo) follows the same server-validation rule via first-party SDKs
- Refund/revocation path tested before ship — entitlement revoked server-side must remove access within 1 login

---

## Cheat / Tamper Resistance {#anti-tamper}

- Critical game state (player health, ammo, currency) computed server-side in multiplayer
- Single-player: accept that local memory editing is trivial — focus tamper-resistance on saves + leaderboards only
- Leaderboard submissions signed server-side; never accept client-submitted scores directly
- Speedhack mitigation: server-time deltas for cooldowns (in MP); reject GAS ability activations with `WithValidation`
- No debug/cheat console commands shipped in `Shipping` builds — `WITH_EDITOR` / `UE_BUILD_SHIPPING` guards on every `Exec` UFUNCTION
- Stripped `pdb`/symbol files from shipping packages
- `bUseUnityBuild` and `bUsePCHFiles` enabled to slow trivial reverse engineering (defense-in-depth only)

---

## Network Security (multiplayer only) {#network}

- Every `UFUNCTION(Server, ...)` RPC has `WithValidation` returning false on out-of-range / unauthorized state
- `_Validate` checks bounds, ownership, and timing — not just type
- No `Multicast` RPC for state changes — only for cosmetic events (sounds, particles)
- Replicated properties use `COND_OwnerOnly` / `COND_SkipOwner` aggressively to prevent state leakage
- Ability activation goes through GAS prediction — server reconciles, never trusts client outcome
- Chat / voice: profanity filter + report flow; never log player messages at `Log` verbosity
- Server bind to specific port; DDoS mitigation belongs at the orchestration layer (dedicated server only)

---

## Secret Management {#secrets}

- No API keys / SDK secrets committed to source — agents cannot read `.env`, `*.pfx`, `*.key`, `OnlineSubsystemEOS.ini` with production creds
- Steam appid in `steam_appid.txt` (gitignored in shipping branch); dev override only
- EOS client secret in CI secret store, injected at package time via `Build.cs` `PublicDefinitions`
- Signing certs (`.pfx` for Windows, provisioning profiles for consoles) in CI secret store
- Wwise license / SDK keys not committed
- `Saved/` is gitignored — never commit captured logs, crash dumps, or `Saved/Cooked/`

---

## Input Validation {#input}

- All `UFUNCTION(BlueprintCallable)` exposed to designers validate inputs (`ensure` + safe fallback)
- Data Asset references checked for null before dereference — designers will misconfigure
- Data Table row lookups handle missing rows gracefully (`FindRow<>` returns null, log + fallback)
- File paths from user input (mod tools, screenshot save) sanitized against directory traversal
- Save slot indices bounded (e.g. 0..9) — reject negative or absurd values

---

## Asset / Build Hygiene {#assets}

- No `MarketplaceProduct` assets committed without confirming license allows redistribution in cooked builds
- Quixel Megascans usage tracked (Megascans license = free for UE projects, but document the assertion)
- Cooked build excludes `Editor/` content, debug textures, source PSDs
- Asset Audit (`UE5 → Window → Developer Tools → Asset Audit`) run before shipping — flag oversized textures (>4K), uncompressed audio, unreferenced assets
- `T_*` textures have correct `Compression Settings` (BC1/BC3/BC7) — never `Uncompressed` in shipping content
- LODs configured on every `SK_*`/`SM_*` over 5K tris

---

## Performance Gates {#perf}

These belong in `code-reviewer` reviews, not just `build-release-engineer`:

- Tick disabled by default on `UActorComponent` (`PrimaryComponentTick.bCanEverTick = false`)
- No `Cast<>` in Tick — cache the pointer on `BeginPlay`
- Niagara LOD configured; no infinite-range cosmetic systems
- UMG `NativeTick` disabled (`bCanEverTick = false`) unless explicitly needed
- Async loading for all level-streamed content (`StreamLevelsForLocation` or `LevelStreamingDynamic`)
- Shipping target: 60 FPS at 1080p on GTX 1060 / PS5-equivalent (locked vertical slice baseline)
- Nanite / Lumen OFF for vertical slice — traditional LODs + baked lighting. Re-evaluate post-vertical-slice only.

---

## Plugin Trust {#plugins}

- Marketplace plugins reviewed for source quality before vendoring under `Plugins/`
- New plugin = entry in `<Project>.uproject` `Plugins[]` AND `deps_added` in the handoff JSON
- Engine-shipped plugins preferred over marketplace equivalents
- Wwise / FMOD integration: verify the SDK version matches the engine version; mismatch crashes silently in shipping
