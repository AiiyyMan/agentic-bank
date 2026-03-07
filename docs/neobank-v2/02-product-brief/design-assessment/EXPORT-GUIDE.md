# SwiftBank Design Token Export Guide

One-time manual step. The Figma Variables API is Enterprise-only and the Official Figma MCP requires OAuth (no headless support), so we export via plugin.

## Prerequisites

- A browser with access to Figma
- A Figma account (free tier works)
- The Tokens Studio plugin installed (step 1 below)

## Step-by-Step: Tokens Studio Export

### Phase 1 — Setup

1. **Duplicate the SwiftBank file to your drafts**
   - Go to: https://www.figma.com/community/file/1433372637060119685
   - Click **"Open in Figma"** (or "Duplicate")
   - This creates an editable copy in your drafts — plugins can't run on community file pages directly

2. **Install Tokens Studio plugin** (if not already installed)
   - Go to: https://www.figma.com/community/plugin/843461159747178978/tokens-studio-for-figma
   - Click **"Try it out"** or **"Save"**

3. **Open your duplicated SwiftBank file** in the Figma editor

### Phase 2 — Import Variables into Tokens Studio

4. **Launch the plugin**
   - Right-click anywhere on the canvas → **Plugins** → **Tokens Studio for Figma**
   - Or use the menu: **Resources** (grid icon in toolbar) → **Plugins** → search "Tokens Studio" → **Run**

5. **Start with a new empty file**
   - When the plugin opens, select **"New empty file"**
   - This creates a blank token workspace to import into

6. **Configure Base Font Size** (important for correct rem values)
   - In the plugin, go to **Settings** (gear icon)
   - Find **"Base Font Size"** → click **"Change"**
   - Enter `16` (standard base font size)
   - Save and go back to the Tokens page

7. **Import Variables from the Figma file**
   - Click the **"Styles & Variables"** button (on the Tokens page)
   - Select **"Import Variables"**
   - The Import Variables modal appears

8. **Configure import settings**
   - **"Convert numbers to dimensions"** → Enable (checked) — this adds `px` units
   - **"Use rem for dimension values"** → Enable if you want rem units (uses the base font size from step 6)
   - Or leave both unchecked for raw unitless values — we can convert later

9. **Review the import preview**
   - The plugin shows a diff list of all Variables it found
   - **New Tokens** section (green) — Variables to be created as tokens
   - Verify you see the SwiftBank collections (look for color, spacing, typography, radius variables)

10. **Click "Import all"**
    - This pulls all Variable collections into Tokens Studio as token sets
    - Collections become **folders**, modes become **token sets** within those folders

### Phase 3 — Export as JSON

11. **Switch to JSON view**
    - Look for the **Token View toggle** above the token list (right side of plugin)
    - Click it to switch from **List view** to **JSON view**
    - The selected token set's JSON will be displayed

12. **Export each token set**
    - In the left sidebar, click each token set (highlighted in blue when selected)
    - For each one:
      - Select all the JSON content in the viewer (Ctrl+A / Cmd+A)
      - Copy it (Ctrl+C / Cmd+C)
      - Paste into a new `.json` file on your machine
    - Name files after the token set/collection they came from

13. **Repeat for all token sets**
    - Go through every collection folder and mode in the left sidebar
    - Copy each one's JSON separately

### Phase 4 — Save and Upload

14. **Name your files clearly**
    ```
    tokens/
      primitives.json          # base colors, spacing scales, radii, font sizes
      semantic.json            # aliases (e.g., text-primary → gray-900)
      components.json          # component-specific tokens
    ```
    If the SwiftBank file uses different collection names, match those names.

15. **Upload to the repo**
    - Place all JSON files in:
      ```
      docs/neobank-v2/02-product-brief/design-assessment/tokens/
      ```
    - You can git commit + push, or paste the JSON content directly into the chat

## What to Check Before You're Done

- [ ] Each Variable collection has a corresponding JSON file
- [ ] Color values are present (hex, rgba, or 0-1 float format — all fine)
- [ ] Spacing/sizing values are present (px or rem)
- [ ] Token aliases are preserved (references like `{colors.primary.500}` not resolved to raw values)
- [ ] Multiple modes exported if they exist (e.g., light/dark theme modes)

## Token Format Reference

Tokens Studio outputs W3C Design Tokens Community Group 4.0 format:
```json
{
  "colors": {
    "primary": {
      "500": {
        "value": "#3B82F6",
        "type": "color"
      }
    }
  },
  "spacing": {
    "sm": {
      "value": "8px",
      "type": "spacing"
    }
  }
}
```

Aliases (references to other tokens) look like:
```json
{
  "text": {
    "primary": {
      "value": "{colors.gray.900}",
      "type": "color"
    }
  }
}
```

## Troubleshooting

**Plugin won't run?**
→ Make sure you duplicated the file to your own drafts first. Plugins don't run on community file preview pages.

**"NaNrem" values appearing?**
→ Set the Base Font Size in Settings (step 6) before importing.

**Missing variables?**
→ Some community files may have Variables hidden from publishing. Check the Variables panel in Figma (diamond icon in right sidebar) to see what's actually there.

**Large number of variables?**
→ That's fine — export everything. We'll filter and map on the server side.

## After Export

Once the JSON files are in the repo, we will:
1. Parse and validate the token JSON
2. Map to our three-tier architecture (primitive → semantic → component)
3. Update `global.css` CSS variables (RGB triplets) + `tailwind.config.js` mappings
4. Generate TypeScript token constants for programmatic use (charts, gauges)
5. Validate light/dark theme switching via `@media (prefers-color-scheme: dark)` CSS overrides + NativeWind `dark:` variant

## Sources

- [Tokens Studio: Import Variables](https://docs.tokens.studio/figma/import/variables)
- [Tokens Studio: JSON View](https://docs.tokens.studio/manage-tokens/token-sets/json-view)
- [Tokens Studio: Export Options](https://docs.tokens.studio/figma/export/options)
- [Tokens Studio Plugin](https://www.figma.com/community/plugin/843461159747178978/tokens-studio-for-figma)
