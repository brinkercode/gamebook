# Figma Integration

> Figma-to-UMG workflow for building game UI from design assets.

---

## Instructions for Claude

**Figma is the source of truth for UI.** Before building any UMG widget, HUD element, or store screen:

1. **Ask if Figma mockups exist** for the UI being built
2. If yes — use the Figma MCP server to extract design data programmatically
3. If no — run the [brand interview](../skills/brand-interview.md) and establish a visual language before building widgets
4. Never start building UMG widgets without visual guidance (mockups, style guide, or design doc)

---

## Figma MCP Setup

Uses Figma's official first-party MCP server. No PAT required — authenticates via OAuth browser login.

### Remote Server (Recommended)

Works on all Figma plans. No desktop app required.

```bash
# Project-scoped (current project only)
claude mcp add --transport http figma https://mcp.figma.com/mcp

# User-scoped (all projects)
claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp
```

After adding, run `/mcp` inside Claude Code, select the `figma` server, and click Authenticate. This opens a browser for OAuth login.

### Desktop Server

Alternative that runs locally via the Figma desktop app. Requires a Dev or Full seat on a paid plan.

1. Open a file in Dev Mode (`Shift+D`)
2. Click "Enable desktop MCP server" in the inspect panel
3. Add the server:

```bash
claude mcp add --transport http figma-desktop http://127.0.0.1:3845/mcp
```

### Rate Limits

- Starter/View/Collab seats: 6 tool calls per month
- Dev/Full seats (Professional plan+): per-minute rate limits matching Tier 1 Figma REST API

---

## MCP Tools Reference

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `get_design_context` | Structured layout and style data from Figma frames | Primary tool — use for every widget/screen build |
| `get_variable_defs` | Extract design tokens: colors, spacing, typography variables | During project setup — populate `docs/DESIGN.md` and widget style sets |
| `get_screenshot` | Visual screenshot of a Figma selection | Validate your UMG implementation matches the mockup |
| `get_metadata` | Sparse XML of layer structure (IDs, names, types, positions, sizes) | Understand large file structure before fetching specific screens |
| `get_code_connect_map` | Retrieve existing Figma-to-widget mappings | Check if widgets already have Code Connect mappings |
| `add_code_connect_map` | Create new Figma-to-widget mappings | After building a widget, map it back to Figma |
| `get_code_connect_suggestions` | Detect and suggest widget mappings | Batch-map existing widgets to Figma |
| `send_code_connect_mappings` | Confirm and finalize Code Connect suggestions | Finalize suggested mappings |
| `create_design_system_rules` | Generate a rules file for consistent output | During project setup — codify visual conventions |
| `get_figjam` | Retrieve FigJam diagram metadata with screenshots | Working with FigJam flow diagrams |
| `whoami` | Return authenticated user identity and seat info | Verify connection |

---

## Workflow: New Project Setup

When the Figma MCP is connected, the **project-scaffolder** uses it during setup:

### 1. Extract Design Tokens

```
1. Get the Figma file URL from the designer
2. Call get_variable_defs to extract all design tokens
3. Call get_metadata to understand the file structure (HUD, Menus, Store, etc.)
4. Map color tokens to the project's UMG style set or global color palette DA_UIColors
5. Populate docs/DESIGN.md with extracted values and screen inventory
```

### 2. Map Colors to UMG Style Sets

UMG does not use CSS variables. Map Figma tokens to a `UCommonButtonStyle`, named `FSlateColor` references, or a `UDataAsset`-backed color table:

```cpp
// Content/UI/Data/DA_UIColors.uasset — a UPrimaryDataAsset
// Fields filled from Figma get_variable_defs output:

UPROPERTY(EditDefaultsOnly, Category="Colors")
FLinearColor Primary;          // Figma: primary

UPROPERTY(EditDefaultsOnly, Category="Colors")
FLinearColor PrimaryForeground; // Figma: primary-foreground

UPROPERTY(EditDefaultsOnly, Category="Colors")
FLinearColor Surface;          // Figma: surface/background

UPROPERTY(EditDefaultsOnly, Category="Colors")
FLinearColor Destructive;      // Figma: destructive/danger

UPROPERTY(EditDefaultsOnly, Category="Colors")
FLinearColor Accent;           // Figma: accent/highlight
```

Reference `DA_UIColors` from widgets via a game-instance subsystem — never hardcode `FLinearColor` in widget C++ or Blueprints.

### 3. Inventory Screens

Use `get_metadata` to enumerate every Figma frame and map it to a UMG widget class:

| Figma Frame | UMG Widget | Content Path |
|-------------|-----------|--------------|
| HUD / Main | `WB_HUD_Main` | `Content/UI/HUD/WB_HUD_Main` |
| Pause Menu | `WB_Menu_Pause` | `Content/UI/Menus/WB_Menu_Pause` |
| Inventory | `WB_Inventory` | `Content/UI/Menus/WB_Inventory` |
| Store / Shop | `WB_Store_Main` | `Content/UI/Store/WB_Store_Main` |
| Item Card | `WB_Store_ItemCard` | `Content/UI/Store/WB_Store_ItemCard` |
| Ability Slot | `WB_HUD_AbilitySlot` | `Content/UI/HUD/WB_HUD_AbilitySlot` |
| Damage Number | `WB_VFX_DamageNumber` | `Content/UI/VFX/WB_VFX_DamageNumber` |

Document this table in `docs/DESIGN.md`.

---

## Workflow: Building Widgets

When the **design-technical** builds a widget:

### 1. Get the Design Context

```
# User provides a Figma frame URL (e.g., https://www.figma.com/design/FILE_KEY/Name?node-id=123-456)

# For complex screens (HUD, store) — understand structure first:
1. Call get_metadata with the frame URL
2. Identify composable sub-panels (e.g., HUD → WB_HUD_HealthBar, WB_HUD_AbilityBar, WB_HUD_Minimap)

# For individual widgets or small components:
1. Call get_design_context with the frame URL
2. Extract layout dimensions, colors, font specs, anchoring intent
3. Build UMG hierarchy to match
```

### 2. Translate to UMG

The MCP returns layout/style data in web terms. Translate to UMG anchoring and sizing:

| Figma Concept | UMG Equivalent |
|---------------|---------------|
| Auto Layout (horizontal) | Horizontal Box |
| Auto Layout (vertical) | Vertical Box |
| Free-position frame | Canvas Panel with Anchors |
| Fill container | Size Box → Fill or Horizontal/Vertical Box slot Fill |
| Fixed size | Size Box with explicit Width/Height override |
| Gap | Padding on slots or Spacer widget |
| Component | User Widget (WB_ class) |
| Component variant | Widget Switcher or Collapsed/Visible toggle |
| Overlay | Overlay widget or Canvas Panel z-order |
| Scroll area | Scroll Box |

UMG anchor presets: top-left (0,0)–(0,0), center (0.5,0.5)–(0.5,0.5), full-stretch (0,0)–(1,1). Match the Figma frame's intended screen attachment.

### 3. Handle Images and Textures

Textures referenced in Figma mockups map to UMG `Image` widgets:

```
- Export Figma assets as PNG at 2x resolution → import to Content/UI/Textures/T_<Name>
- Set Compression: UserInterface2D on all UI textures
- Set LODGroup: UI
- Use SlateBrush (FSlateBrush) to reference the texture in widget C++ or directly in Blueprint
- Never use TextureRenderTarget or scene capture for static UI imagery
```

For icons, prefer the project's icon Data Table (`DT_Icons`) over one-off texture references.

### 4. Typography

Map Figma text styles to UMG `FSlateFontInfo` entries stored in a shared style set or the project's `UCommonTextStyle` assets:

| Figma Text Style | UMG / Common UI Asset | Size | Weight |
|------------------|-----------------------|------|--------|
| Heading/H1 | `TS_Heading1` | 36 | Bold |
| Heading/H2 | `TS_Heading2` | 28 | SemiBold |
| Body | `TS_Body` | 16 | Regular |
| Caption | `TS_Caption` | 12 | Regular |
| HUD/Stat | `TS_HUDStat` | 20 | Bold |
| Damage Number | `TS_DamageNumber` | 24–48 (runtime scaled) | ExtraBold |

Always use `UCommonTextBlock` with a named `UCommonTextStyle` — never set font inline on a raw `TextBlock`.

### 5. Visual Validation

After building, compare your widget to the mockup:

```
1. Call get_screenshot for the original Figma frame
2. PIE the map that spawns this widget (or use the UMG Designer preview)
3. Screenshot via UE's Take Screenshot or Ctrl+F9 in PIE
4. Adjust anchoring, padding, colors, and font sizes to match
```

---

## UMG-Specific Design File Best Practices

For the best results, ask designers to prepare Figma files with:

- **Semantic layer names** — "Health Bar Fill", "Ability Icon Slot 1", not "Rectangle 12" or "Group 5"
- **Auto Layout** — communicates intended stack direction; translates to Horizontal/Vertical Box
- **Components** — reusable elements (icon slots, stat readouts, button) defined as Figma components
- **Design variables** — all colors, radii, and spacing as Figma variables (not raw values)
- **Screen-resolution frames** — 1920×1080 base for HUD/menu; 2560×1440 for wide/ultra; mobile at 390×844 if applicable
- **State variants** — Normal, Hover, Pressed, Disabled, Focused states as Figma variants so UMG interactive states can be verified

---

## Common UMG Screen Patterns

### HUD Layout

HUD widgets anchor to screen edges. Figma frame = 1920×1080. Map quadrants:

| Figma Region | Canvas Panel Anchor | Widget |
|--------------|---------------------|--------|
| Top-left | (0,0)–(0,0) | `WB_HUD_HealthStamina` |
| Top-center | (0.5,0)–(0.5,0) | `WB_HUD_Crosshair` |
| Top-right | (1,0)–(1,0) | `WB_HUD_Minimap` |
| Bottom-center | (0.5,1)–(0.5,1) | `WB_HUD_AbilityBar` |
| Bottom-left | (0,1)–(0,1) | `WB_HUD_StatusEffects` |

Bind all dynamic values (health %, cooldown progress) via `UWidget::BindingDelegate` or call `SetPercent`/`SetText` from GAS `AttributeSet` change delegates — never tick-poll in the widget's Tick function.

### Store Screen Layout

```
WB_Store_Main (Canvas, full-stretch)
├── WB_Store_Header          (top anchor, fixed height 80px)
│   ├── Image: store logo
│   └── WB_CurrencyDisplay   (currency readout)
├── WB_Store_CategoryTabs    (below header, horizontal tabs)
├── ScrollBox: WB_Store_ItemGrid  (fills remaining vertical space)
│   └── Uniform Grid Panel
│       └── WB_Store_ItemCard × N
└── WB_Store_PurchaseModal   (overlay, initially Collapsed)
    ├── WB_ItemPreview
    ├── WB_PriceBreakdown
    └── WB_ConfirmButton
```

`WB_Store_ItemCard` binds to a `UDA_StoreItem` (Primary Data Asset). The store widget fetches the item list from the **EOS Ecom** or **Steam MicroTxn** backend via a `ULocalPlayerSubsystem` — never call platform APIs from within the widget itself.

### Pause Menu

Use `UCommonActivatableWidget` for all full-screen menus so Common UI handles input routing and back-button behavior automatically. Figma states (main, settings, confirm-quit) map to widget stack push/pop, not visibility toggles.

---

## When No Figma Assets Exist

### Fallback Workflow

1. Run the [brand interview](../skills/brand-interview.md) to establish visual identity
2. Create `docs/DESIGN.md` from interview answers
3. Define `DA_UIColors` from the agreed palette
4. Create `UCommonTextStyle` assets from the agreed type scale
5. Build widgets using the project style set; reference `get_screenshot` after each for visual sanity

### Design Decisions to Make Without Figma

| Decision | Default | Document in DESIGN.md |
|----------|---------|----------------------|
| Primary/accent color | Dark charcoal + vivid accent | Yes |
| Font | Barlow (HUD) + Barlow Condensed (stat numbers) | Yes |
| Corner radius | 4px (tight/game-appropriate) | Yes |
| HUD opacity | 80% background panels | Yes |
| Menu style | Dark full-screen with blur background | Yes |
| Damage number style | Floating, arc trajectory, scale-pop anim | Yes |
| Store layout | Grid (4 cols at 1080p) | Yes |

---

## Client Project MCP Configuration

When setting up a new client project, add the Figma MCP:

```bash
# Run in the client project directory
claude mcp add --transport http figma https://mcp.figma.com/mcp
```

This creates a `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

Commit `.mcp.json` so all team members get the Figma MCP automatically. Each person authenticates individually via OAuth on first use.

---

## Quality Checks

When building UMG widgets from Figma:

- [ ] Colors reference `DA_UIColors` or named `UCommonTextStyle` — no inline `FLinearColor` literals
- [ ] Typography uses `UCommonTextStyle` assets — no inline font overrides
- [ ] Anchors match Figma frame intent (edge-locked HUD elements, centered modal dialogs)
- [ ] All UI textures set Compression: UserInterface2D and LODGroup: UI
- [ ] Dynamic values (health, ammo, cooldown) bound via delegate or explicit setter — no Tick polling
- [ ] Full-screen menus use `UCommonActivatableWidget` for proper input routing
- [ ] Interactive states (Normal/Hover/Pressed/Disabled) implemented for all buttons
- [ ] Store widgets read item data from Data Assets — no hardcoded product data
- [ ] Platform API calls (EOS Ecom, Steam MicroTxn) go through a subsystem, not widget code
- [ ] Widget passes PIE visual check against `get_screenshot` of the Figma frame

---

## After Building

1. Update `docs/DESIGN.md` with any new style decisions made during implementation
2. Note deviations from Figma and why (e.g., UMG anchoring constraints, performance tradeoffs)
3. If new reusable widgets were created, document them in DESIGN.md under Widget Patterns
4. Map new widgets to Figma components with `add_code_connect_map`
