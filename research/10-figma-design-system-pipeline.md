# Figma-to-Code Design System Pipeline Research

> Research date: 2026-03-06
> Focus: Bridging Figma and React Native (NativeWind) for a small team

---

## Table of Contents

1. [Figma Variables and Design Tokens](#1-figma-variables-and-design-tokens)
2. [W3C Design Tokens Community Group (DTCG) Format](#2-w3c-dtcg-format)
3. [Figma-to-Code Token Sync Tools](#3-figma-to-code-token-sync-tools)
4. [The Ideal Workflow: Figma to React Native/NativeWind](#4-the-ideal-workflow)
5. [Figma Component Structure Best Practices](#5-figma-component-structure-best-practices)
6. [Design System Documentation](#6-design-system-documentation)
7. [Real-World Examples](#7-real-world-examples)
8. [Recommendations for Our Project](#8-recommendations-for-our-project)

---

## 1. Figma Variables and Design Tokens

### What Are Figma Variables?

Figma Variables (released 2023, expanded 2024-2025) are raw values -- colors, numbers, strings, booleans -- that can change based on context (e.g., light/dark mode, mobile/desktop). They are Figma's native implementation of design tokens.

**Key concepts:**

- **Variables**: Atomic values (a color hex, a spacing number, a font size)
- **Collections**: Groups of related variables (e.g., "Colors", "Spacing", "Typography")
- **Modes**: Variants within a collection (e.g., "Light" and "Dark" modes in a Colors collection)
- **Aliases**: Variables that reference other variables (semantic tokens pointing to primitive tokens)

### How Variables Map to Design Tokens

Figma Variables map directly to the design token concept:

| Figma Concept | Design Token Concept |
|---|---|
| Variable | Token |
| Collection | Token group/category |
| Mode | Theme variant (light/dark, brand A/B) |
| Alias (variable referencing variable) | Semantic token referencing primitive token |
| Variable type (color, number, string, boolean) | Token type |

### Variable Types Supported

- **Color**: Solid colors (e.g., `#1A1A2E`, `rgba(26, 26, 46, 1)`)
- **Number**: Spacing, sizing, border-radius, opacity values
- **String**: Font family names, text values
- **Boolean**: Feature flags, visibility toggles

### Collections and Modes: Practical Structure

A well-structured Figma file typically has:

```
Collection: "Primitives"
  Mode: "Default"
  - color.blue.500 = #3B82F6
  - color.blue.600 = #2563EB
  - spacing.4 = 16
  - spacing.6 = 24
  - radius.md = 8

Collection: "Semantic Colors"
  Mode: "Light"
  - color.bg.primary = {Primitives.color.white}
  - color.bg.surface = {Primitives.color.gray.50}
  - color.text.primary = {Primitives.color.gray.900}
  - color.brand.primary = {Primitives.color.blue.600}
  Mode: "Dark"
  - color.bg.primary = {Primitives.color.gray.900}
  - color.bg.surface = {Primitives.color.gray.800}
  - color.text.primary = {Primitives.color.white}
  - color.brand.primary = {Primitives.color.blue.400}

Collection: "Typography"
  Mode: "Mobile"
  - fontSize.heading.xl = 28
  - fontSize.body.md = 16
  Mode: "Tablet"
  - fontSize.heading.xl = 36
  - fontSize.body.md = 18
```

### Exporting Figma Variables

**Native Figma REST API:**
- Figma provides REST API endpoints for querying, creating, updating, and deleting variables
- **Important limitation**: The Variables REST API requires an ENTERPRISE subscription plan
- Endpoints allow programmatic read/write of tokens for CI/CD integration

**Plugin-based export options (work on any plan):**
- **Design Tokens (W3C) Export**: Exports collections as JSON files in W3C DTCG format
- **Design Tokens Manager**: Full token management with import/export
- **Figma Variables to JSON**: Exports all variable types with alias support
- **Wave Design Token Exporter**: Exports variables and styles to structured JSON
- **Tokens Studio plugin** (the most popular option -- see Section 3)

### 2025-2026 Developments

- Figma announced at Config 2025 upcoming support for native variable export/import conforming with the DTCG token specification
- Figma is opening Dev Mode for custom integrations -- token export scripts, CI hooks, and linting tools can run inside the design environment
- Figma Schema 2025 includes extended variable collections

---

## 2. W3C DTCG Format

### What Is It?

The W3C Design Tokens Community Group (DTCG) released the **first stable specification (2025.10)** on October 28, 2025. This is the industry standard for describing design tokens in a vendor-neutral JSON format.

- **File extension**: `.tokens` or `.tokens.json`
- **Media type**: `application/design-tokens+json`
- **Format**: JSON with `$`-prefixed properties

### Format Structure

```json
{
  "color": {
    "brand": {
      "primary": {
        "$type": "color",
        "$value": "#3B82F6",
        "$description": "Primary brand color used for CTAs and links"
      },
      "secondary": {
        "$type": "color",
        "$value": "#10B981"
      }
    },
    "bg": {
      "primary": {
        "$type": "color",
        "$value": "{color.brand.primary}",
        "$description": "Alias token referencing primitive"
      }
    }
  },
  "spacing": {
    "sm": {
      "$type": "dimension",
      "$value": "8px"
    },
    "md": {
      "$type": "dimension",
      "$value": "16px"
    }
  },
  "typography": {
    "heading-lg": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Inter",
        "fontSize": "24px",
        "fontWeight": 700,
        "lineHeight": 1.2,
        "letterSpacing": "-0.02em"
      }
    }
  }
}
```

### Key Properties

| Property | Purpose |
|---|---|
| `$value` | The design decision (required) |
| `$type` | Token type (color, dimension, typography, etc.) |
| `$description` | Human-readable documentation |
| `$extensions` | Vendor-specific metadata |

### Supported Token Types (13 total)

1. **color** - Any color value
2. **dimension** - Sizes with units (px, rem)
3. **fontFamily** - Font stack
4. **fontWeight** - Numeric or named weight
5. **duration** - Time values for animations
6. **cubicBezier** - Easing curves
7. **number** - Raw numbers (line-height, opacity)
8. **strokeStyle** - Border styles
9. **border** - Composite border tokens
10. **transition** - Composite animation tokens
11. **shadow** - Drop/inner shadows
12. **gradient** - Color gradients
13. **typography** - Composite typography tokens

### Alias References

Tokens can reference other tokens using `{}` syntax:
```json
{
  "color": {
    "blue-500": { "$type": "color", "$value": "#3B82F6" },
    "brand-primary": { "$type": "color", "$value": "{color.blue-500}" }
  }
}
```

### Industry Adoption

10+ tools support or are implementing the standard: Penpot, Figma, Sketch, Framer, Knapsack, Supernova, zeroheight, Tokens Studio, Style Dictionary (v4+), and Terrazzo.

---

## 3. Figma-to-Code Token Sync Tools

### Tool Comparison Matrix

| Tool | Type | DTCG Support | Git Sync | Multi-Platform | Pricing | Best For |
|---|---|---|---|---|---|---|
| **Tokens Studio** | Figma plugin + platform | Yes (v2+) | GitHub, GitLab, Bitbucket, Azure | Via Style Dictionary | Free (basic) / Pro ($) | Full pipeline, small-to-large teams |
| **Style Dictionary** | CLI/Node build tool | Yes (v4+) | N/A (it IS the code tool) | CSS, JS, iOS, Android, RN | Free (OSS) | Token transformation engine |
| **Specify** | SaaS platform | Yes | API-based | 50+ output formats | Freemium | Enterprise token management |
| **Supernova** | SaaS platform | Yes | CI/CD integration | Multi-platform | Paid | Documentation + tokens |
| **Terrazzo** | CLI build tool | Yes (native) | N/A | CSS, JS, Sass | Free (OSS) | DTCG-native alternative to SD |

### Tokens Studio (formerly Figma Tokens)

**What it is**: The most popular Figma plugin for managing design tokens. It bridges Figma Variables with code repositories.

**How it works:**
1. Install the Tokens Studio plugin in Figma
2. Define tokens in the plugin UI or import from Figma Variables
3. Organize tokens into sets (primitive, semantic, component)
4. Connect to a Git provider (GitHub, GitLab, Bitbucket, Azure DevOps)
5. Push/pull tokens as JSON files to/from your repository
6. Tokens are stored as JSON files in W3C DTCG format (opt-in)

**Key features:**
- **Two-way sync**: Push tokens from Figma to Git, or pull from Git to Figma
- **Git storage providers**: Direct GitHub/GitLab integration via personal access tokens
- **Multi-file sync** (Pro): Tokens stored in folder structure (one file per set/theme)
- **Theme support**: Define theme groups that map to Figma modes
- **23+ token types**: Colors, spacing, typography, shadows, border-radius, opacity, and more
- **Alias/reference support**: Semantic tokens referencing primitives
- **W3C DTCG format**: Opt-in, with automatic format conversion

**Storage options:**
- **File mode** (free): All tokens in a single JSON file
- **Folder mode** (Pro): Multi-file structure, better for CI/CD and theme management

**Workflow:**
```
Designer updates token in Figma
  -> Tokens Studio plugin detects change
  -> Designer pushes to GitHub (creates branch + PR)
  -> CI/CD pipeline runs Style Dictionary build
  -> Platform-specific tokens generated
  -> PR merged -> tokens available in codebase
```

**Pricing:**
- Free tier: Basic token management, single-file sync
- Pro: Multi-file sync, themes, branching, advanced features
- Enterprise: SSO, audit logs, advanced permissions

### Style Dictionary (by Amazon)

**What it is**: An open-source build system for creating cross-platform design token outputs. It is the de facto standard transformation engine.

**Version status**: Style Dictionary v4 (stable), with first-class DTCG support. Recent updates include compatibility with `@tokens-studio/sd-transforms` package.

**How it works:**
1. Input: JSON token files (DTCG or legacy format)
2. Define transforms: How values should be converted per platform
3. Define formats: What output file format to generate
4. Run build: Generates platform-specific files

**Platform outputs:**

| Platform | Output Format |
|---|---|
| Web (CSS) | CSS custom properties (`:root { --color-primary: #3B82F6; }`) |
| Web (JS/TS) | ES modules, CommonJS, TypeScript constants |
| iOS | Swift enums, UIColor extensions |
| Android | XML resources, Kotlin objects |
| React Native | JS/TS theme objects |
| Tailwind CSS | `tailwind.config.js` theme extension |
| Sass | SCSS variables and maps |

**Configuration example (`config.mjs`):**
```javascript
import StyleDictionary from 'style-dictionary';
import { registerTransforms } from '@tokens-studio/sd-transforms';

// Register Tokens Studio transforms
registerTransforms(StyleDictionary, { platform: 'react-native' });

export default {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/css/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables'
      }]
    },
    js: {
      transformGroup: 'js',
      buildPath: 'build/js/',
      files: [{
        destination: 'tokens.js',
        format: 'javascript/es6'
      }]
    },
    tailwind: {
      transformGroup: 'js',
      buildPath: 'build/tailwind/',
      files: [{
        destination: 'theme.js',
        format: 'javascript/module'
      }]
    }
  }
};
```

**Key package: `@tokens-studio/sd-transforms`**
- Bridges Tokens Studio output with Style Dictionary
- Handles dimension units, opacity, line-height, font-weight conversions
- Supports `platform: 'react-native'` for RN-specific transforms
- Now requires Style Dictionary v5.0.0+

**Tailwind CSS integration:**
- `sd-tailwindcss-transformer` plugin generates a Tailwind-compatible config
- Output can be imported directly into `tailwind.config.js` as a preset
- CSS custom properties can be referenced in Tailwind theme: `var(--color-primary)`

### Specify

**What it is**: A design data platform that centralizes and distributes design tokens.

**How it works:**
1. Connect to Figma (syncs Styles and Variables)
2. Specify stores tokens in its internal format (SDTF - Specify Design Token Format)
3. Configure output templates for any platform
4. Generate tokens via API, CLI, or webhooks

**Key features:**
- 50+ token types supported
- Output templates for CSS, Tailwind, React Native, Flutter, Style Dictionary, and more
- Automatic sync from Figma
- API-driven distribution
- Specify 2.0 engine with powerful transformation capabilities

**Best for**: Teams wanting a managed platform rather than DIY pipeline.

### Supernova

**What it is**: An AI-powered design system management platform with strong documentation features.

**Key features:**
- Import tokens from Figma Variables or Tokens Studio
- Generate platform-specific code (CSS, iOS, Android, Flutter)
- Built-in documentation site builder (Supernova Portal, released Sept 2025)
- Unified search across Figma components, Storybook stories, tokens, and assets
- Version control and status tracking for tokens
- CI/CD integration via CLI
- Analytics on documentation usage

**Best for**: Teams needing polished documentation alongside token management.

### Terrazzo

**What it is**: A newer, DTCG-native alternative to Style Dictionary.

**Key features:**
- Built from the ground up for the W3C DTCG format
- Simpler configuration than Style Dictionary
- Plugin-based architecture
- CSS, JS, and Sass output

**Best for**: Teams starting fresh with DTCG tokens who want a simpler tool.

---

## 4. The Ideal Workflow

### End-to-End Pipeline: Figma to React Native (NativeWind)

```
  +------------------+
  |   FIGMA          |
  |  (Source of      |
  |   Design Truth)  |
  +--------+---------+
           |
           | Tokens Studio plugin
           | (push to Git on change)
           |
  +--------v---------+
  |   GITHUB REPO    |
  |  tokens/          |
  |   primitives.json |
  |   semantic.json   |
  |   component.json  |
  +--------+---------+
           |
           | GitHub Actions CI
           | (triggered on PR merge)
           |
  +--------v---------+
  |  STYLE DICTIONARY |
  |  + sd-transforms  |
  |                   |
  |  Transforms:      |
  |  - CSS variables   |
  |  - Tailwind theme  |
  |  - RN theme object |
  +--------+---------+
           |
           | Build output
           |
  +--------v---------+     +------------------+
  | build/            |     | REACT NATIVE APP |
  |  tailwind-theme.js | --> | tailwind.config  |
  |  variables.css     |     | global.css       |
  |  tokens.ts         |     | NativeWind       |
  +-------------------+     +------------------+
```

### Step-by-Step Workflow

#### Step 1: Designer Updates in Figma

A designer changes a color variable (e.g., `color.brand.primary` from `#3B82F6` to `#2563EB`).

- The change is made in the Figma Variables panel or Tokens Studio plugin
- The change applies everywhere the variable is used in the design file
- If using modes, both light and dark values can be updated

#### Step 2: Push to GitHub via Tokens Studio

The designer (or design systems lead) opens Tokens Studio and pushes:

1. Plugin shows diff of changed tokens
2. Creates a new branch (e.g., `design/update-brand-primary`)
3. Commits updated JSON token files
4. Opens a Pull Request automatically

**Token file structure in repo:**
```
tokens/
  primitives/
    colors.json       # Raw color palette
    spacing.json      # Spacing scale
    typography.json   # Font families, sizes, weights
    radii.json        # Border radius values
  semantic/
    colors.json       # Semantic color assignments (references primitives)
    shadows.json      # Shadow definitions
  themes/
    light.json        # Light mode overrides
    dark.json         # Dark mode overrides
```

#### Step 3: CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/build-tokens.yml
name: Build Design Tokens

on:
  push:
    branches: [main]
    paths: ['tokens/**']
  pull_request:
    paths: ['tokens/**']

jobs:
  build-tokens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Build tokens with Style Dictionary
        run: npx style-dictionary build --config sd.config.mjs

      - name: Validate token output
        run: npm run validate-tokens

      - name: Commit built tokens (if on main)
        if: github.ref == 'refs/heads/main'
        run: |
          git add build/
          git commit -m "chore: rebuild design tokens" || true
          git push
```

#### Step 4: Style Dictionary Configuration

```javascript
// sd.config.mjs
import StyleDictionary from 'style-dictionary';
import { registerTransforms } from '@tokens-studio/sd-transforms';

registerTransforms(StyleDictionary);

const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  platforms: {
    // For NativeWind/Tailwind: generates a JS theme object
    tailwind: {
      transforms: ['ts/resolveMath', 'ts/size/px', 'ts/color/css/hexrgba', 'name/kebab'],
      buildPath: 'src/theme/generated/',
      files: [{
        destination: 'tailwind-tokens.js',
        format: 'javascript/module',
        filter: (token) => token.attributes.category !== 'asset'
      }]
    },
    // For CSS Variables (used by NativeWind v4+)
    css: {
      transforms: ['ts/resolveMath', 'ts/size/px', 'ts/color/css/hexrgba', 'name/kebab'],
      buildPath: 'src/theme/generated/',
      files: [{
        destination: 'tokens.css',
        format: 'css/variables',
        options: {
          outputReferences: true  // Preserve alias relationships
        }
      }]
    },
    // For direct JS usage in React Native
    reactNative: {
      transforms: ['ts/resolveMath', 'ts/size/px', 'ts/color/css/hexrgba', 'name/camelCase'],
      buildPath: 'src/theme/generated/',
      files: [{
        destination: 'tokens.ts',
        format: 'javascript/es6'
      }]
    }
  }
});

await sd.buildAllPlatforms();
```

#### Step 5: NativeWind/Tailwind Configuration

**Option A: CSS Variables (NativeWind v4)**
```css
/* src/global.css */
@import './theme/generated/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--color-brand-primary)',
          secondary: 'var(--color-brand-secondary)',
        },
        bg: {
          primary: 'var(--color-bg-primary)',
          surface: 'var(--color-bg-surface)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        }
      },
      spacing: {
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)',
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
      }
    }
  }
};
```

**Option B: Direct JS import (simpler, works with NativeWind v4)**
```javascript
// tailwind.config.js
const tokens = require('./src/theme/generated/tailwind-tokens');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: tokens.color,
      spacing: tokens.spacing,
      borderRadius: tokens.radius,
      fontSize: tokens.fontSize,
    }
  }
};
```

#### Step 6: Usage in React Native Components

```tsx
// Using NativeWind classes that reference tokens
function AccountCard({ balance, accountName }) {
  return (
    <View className="bg-bg-surface rounded-lg p-md shadow-card">
      <Text className="text-text-secondary text-sm">{accountName}</Text>
      <Text className="text-text-primary text-2xl font-bold">
        ${balance.toFixed(2)}
      </Text>
    </View>
  );
}
```

### Automation Level Options

| Approach | Effort | Automation | Best For |
|---|---|---|---|
| **Manual export** | Low setup | None | Solo dev, rapid prototyping |
| **Tokens Studio + Git** | Medium setup | Semi-auto (designer pushes) | Small teams (recommended) |
| **Figma API + CI/CD** | High setup | Fully automated | Large teams, enterprise |
| **Specify/Supernova** | Medium setup | Platform-managed | Teams wanting managed solution |

### Recommended for a Small Team (2-5 people)

**Tokens Studio + Style Dictionary + GitHub Actions**

This is the sweet spot because:
- Tokens Studio is free for basic use (single-file sync)
- Style Dictionary is free and open-source
- GitHub Actions provides free CI/CD for public repos (and generous free tier for private)
- The designer stays in Figma, the developer stays in code
- Changes flow through Git (reviewable, revertible, traceable)

---

## 5. Figma Component Structure Best Practices

### Naming Conventions

**Match your code component library:**
```
Figma Component Name   ->   Code Component
Button/Primary         ->   <Button variant="primary" />
Button/Secondary       ->   <Button variant="secondary" />
Card/Account           ->   <AccountCard />
Input/Text             ->   <TextInput />
Input/Password         ->   <TextInput secureTextEntry />
```

**Naming rules:**
- Use PascalCase for component names (matches React conventions)
- Use `/` for grouping (Button/Primary creates a group "Button" with variant "Primary")
- Use clear, descriptive names that match Tailwind utility class intent
- Prefix internal sub-components with `_` (e.g., `_Button/Icon`)

### Variant Properties

Map Figma variant properties directly to component props:

| Figma Variant Property | Code Prop | Values |
|---|---|---|
| `Size` | `size` | `sm`, `md`, `lg` |
| `Variant` | `variant` | `primary`, `secondary`, `outline`, `ghost` |
| `State` | (internal) | `default`, `hover`, `pressed`, `disabled` |
| `HasIcon` | `leftIcon` / `rightIcon` | `true`, `false` |
| `Loading` | `isLoading` | `true`, `false` |

**Example: Button component matrix**
```
Button
  Properties:
    Variant: primary | secondary | outline | ghost
    Size: sm | md | lg
    State: default | hover | pressed | disabled | loading
    HasLeftIcon: true | false
    HasRightIcon: true | false
```

### Auto-Layout Patterns

Auto-layout in Figma maps directly to React Native's Flexbox:

| Figma Auto-Layout | React Native / NativeWind |
|---|---|
| Horizontal | `flex-row` |
| Vertical | `flex-col` |
| Gap: 8 | `gap-2` |
| Padding: 16 | `p-4` |
| Padding: 12h 16v | `px-3 py-4` |
| Fill container | `flex-1` |
| Hug contents | (default, no flex-1) |
| Space between | `justify-between` |
| Center alignment | `items-center justify-center` |

**Best practice**: Always use Auto-Layout. Never use absolute positioning unless absolutely necessary (modals, overlays). This ensures designs translate cleanly to Flexbox code.

### Using Variables for Everything

**No hardcoded values rule:**

Every value in a Figma component should come from a variable:
- Colors: Always reference a semantic color variable, never a hex code
- Spacing/Padding: Always reference a spacing variable (4, 8, 12, 16, 24, 32, 48)
- Border radius: Always reference a radius variable (sm=4, md=8, lg=12, xl=16, full=9999)
- Font sizes: Always reference typography variables
- Shadows: Use shadow styles (not variables yet in Figma, use Styles)

**How to enforce:**
- In Tokens Studio, set up linting rules
- Use Figma's "Variables" scoping to limit what variables apply to what properties
- Review components in the Variables panel to ensure no raw values

### Figma File Structure for a Banking App

```
Figma Project Structure:

  1. Design System Library (separate file, published as library)
     - Foundations
       - Colors (primitives + semantic via Variables)
       - Typography (text styles + Variables)
       - Spacing (Variables)
       - Icons (component instances)
       - Shadows (Styles)
     - Components
       - Button (all variants)
       - Input / TextInput
       - Card (AccountCard, TransactionCard, etc.)
       - Avatar
       - Badge
       - BottomSheet
       - NavigationBar
       - TabBar
       - ChatBubble
       - ActionConfirmation (for agentic banking confirmations)
     - Patterns
       - Form layouts
       - List patterns
       - Empty states
       - Error states
       - Loading skeletons

  2. App Design File (consumes the library)
     - Screens
       - Onboarding
       - Login / Auth
       - Dashboard / Home
       - Account Detail
       - Transactions
       - AI Chat
       - Send Money
       - Settings
```

---

## 6. Design System Documentation

### Tool Comparison for Small Teams

| Tool | Cost | Figma Sync | Code Integration | Effort | Best For |
|---|---|---|---|---|---|
| **Storybook (RN)** | Free | Via plugin | Native | High setup | Developers |
| **zeroheight** | Freemium | Direct sync | Storybook embed | Low setup | Cross-functional teams |
| **Notion** | Free/cheap | Manual embeds | None | Lowest setup | Early-stage teams |
| **Supernova Portal** | Paid | Direct sync | Storybook + code | Medium setup | Mature design systems |

### Recommendation for Small Teams: Storybook + Notion

**Phase 1 (Start here): Notion**
- Create a Notion workspace for the design system
- Document token names, usage guidelines, do's/don'ts
- Embed Figma frames for visual reference
- Minimal setup, everyone already knows Notion
- Limitation: Manual updates, no code preview

**Phase 2 (When you have components): Storybook for React Native**
- Use `@storybook/react-native` with Expo
- Document each component with stories showing all variants
- Add usage guidelines in MDX docs
- Can run alongside the app (same codebase)
- Setup options:
  - Embedded in app (toggle via env var)
  - Separate Storybook web build via `react-native-web`
  - Use `expo-template-storybook` for quick start

**Phase 3 (If team grows): zeroheight**
- Sync Figma components automatically
- Embed Storybook stories
- Single source of truth for designers + developers + PMs
- Custom branding for the documentation site

### Storybook for React Native Setup

```bash
# For new Expo projects
npx create-expo-app --template expo-template-storybook MyApp

# For existing projects
npx storybook@latest init
# Select React Native when prompted
```

**Toggle between app and Storybook:**
```javascript
// App.tsx
import Constants from 'expo-constants';

const StorybookUIRoot = require('./.rnstorybook').default;
const App = require('./src/App').default;

export default Constants.expoConfig?.extra?.storybook ? StorybookUIRoot : App;
```

### Storybook + Figma Integration

**Storybook Connect** (Figma plugin):
- Embeds Storybook stories directly in Figma
- Powered by Chromatic
- Designers see live code components without leaving Figma
- Requires Chromatic account (free tier available)

---

## 7. Real-World Examples

### Shopify Polaris

**Structure:**
- Monorepo: `github.com/shopify/polaris`
- Separate packages: `polaris-react`, `polaris-tokens`, `polaris-icons`
- Token formats: JS (camelCase), JSON (kebab-case), Sass (kebab-case)

**Figma-to-code pipeline:**
- Figma Variables (v12.0.0+) replaced Color Styles
- Code is the source of truth, Figma mirrors it
- Components should not be added to Figma if they don't exist in Polaris React
- CI checks enforce token usage, accessibility, and visual regression

**Key lessons:**
- Keep Figma in sync with code, not the other way around
- Automated tests enforce consistency
- Token governance via designated design system team

### GitHub Primer

**Structure:**
- Token repo: `github.com/primer/primitives`
- Tokens stored in `src/tokens/` directory
- Built with Style Dictionary (`scripts/buildTokens.ts`)
- Code is the source of truth (documented on primer.style)

**Token format:**
- Uses `$extensions` metadata for Figma integration:
  - `collection`: Which Figma collection the token belongs to
  - `mode`: Which mode within the collection
  - `scopes`: Figma scoping (what the token can be applied to)
- Currently only color and size tokens are fully in Variables (goal: all tokens)

**Key lessons:**
- Code-first approach: tokens defined in code, pushed to Figma
- Gradual migration from Styles to Variables
- Strong metadata in tokens for Figma mapping

### Gluestack UI v3 (Directly Relevant)

**Why this matters**: Gluestack UI is in our tech stack (React Native + NativeWind).

**Figma design kit includes:**
- Extended color palette as Figma styles
- Semantic colors as Figma variable collections
- Fixed colors that remain unchanged across modes
- ~23 components with compound component mapping
- Text and Heading foundation components
- Hard and Soft shadow tokens

**Token structure:**
- Theme-based tokens via `config-v3`
- Dark and light mode support via variables
- Colors, typography, shadows, spacing defined as tokens
- Components built with NativeWind (Tailwind CSS)

**Integration approach:**
- Figma kit mirrors the code component library
- Token names in Figma match NativeWind theme configuration
- Components are copy-paste universal (React Native, Next.js, Expo)

### Common Patterns Across All

1. **Three-tier token architecture**: Primitives -> Semantics -> Components
2. **Code as source of truth** (or at minimum, Git as source of truth)
3. **Automated CI/CD** for token transformation
4. **Style Dictionary** as the transformation engine
5. **Figma Variables** for theming (light/dark mode)
6. **Strict naming conventions** that match code

---

## 8. Recommendations for Our Project

### Recommended Stack

| Layer | Tool | Role |
|---|---|---|
| Design | Figma Variables + Gluestack v3 kit | Design source of truth |
| Bridge | Tokens Studio (Free/Pro) | Figma-to-Git sync |
| Storage | GitHub repo (`tokens/` directory) | Versioned token storage |
| Transform | Style Dictionary v4+ + sd-transforms | Token compilation |
| CI/CD | GitHub Actions | Automated builds |
| Output | Tailwind theme + CSS variables | NativeWind consumption |
| Docs | Notion (Phase 1) -> Storybook (Phase 2) | Team documentation |

### Token Architecture

```
Tier 1: Primitives (raw values)
  color.blue.50 through color.blue.900
  color.green.50 through color.green.900
  color.gray.50 through color.gray.900
  spacing.0 = 0
  spacing.1 = 4
  spacing.2 = 8
  spacing.3 = 12
  spacing.4 = 16
  spacing.6 = 24
  spacing.8 = 32
  radius.none = 0
  radius.sm = 4
  radius.md = 8
  radius.lg = 12
  radius.xl = 16
  radius.full = 9999

Tier 2: Semantic (contextual meaning)
  color.bg.primary = {color.white} | dark: {color.gray.900}
  color.bg.surface = {color.gray.50} | dark: {color.gray.800}
  color.bg.brand = {color.blue.600} | dark: {color.blue.500}
  color.text.primary = {color.gray.900} | dark: {color.white}
  color.text.secondary = {color.gray.600} | dark: {color.gray.400}
  color.text.brand = {color.blue.600} | dark: {color.blue.400}
  color.border.default = {color.gray.200} | dark: {color.gray.700}
  color.status.success = {color.green.600}
  color.status.error = {color.red.600}
  color.status.warning = {color.amber.600}
  spacing.card.padding = {spacing.4}
  spacing.section.gap = {spacing.6}
  radius.card = {radius.lg}
  radius.button = {radius.md}
  radius.input = {radius.md}

Tier 3: Component (specific to components)
  button.primary.bg = {color.bg.brand}
  button.primary.text = {color.white}
  button.secondary.bg = {color.bg.surface}
  button.secondary.text = {color.text.brand}
  card.bg = {color.bg.surface}
  card.border = {color.border.default}
  card.radius = {radius.card}
  input.bg = {color.bg.primary}
  input.border = {color.border.default}
  input.radius = {radius.input}
```

### Banking-Specific Tokens

```
  color.money.positive = {color.green.600}    # Money received
  color.money.negative = {color.red.600}       # Money sent
  color.money.pending = {color.amber.500}      # Pending transactions
  color.account.checking = {color.blue.600}
  color.account.savings = {color.green.600}
  color.account.credit = {color.purple.600}
  color.ai.bubble.user = {color.bg.brand}
  color.ai.bubble.assistant = {color.bg.surface}
  color.ai.confirmation.bg = {color.amber.50} | dark: {color.amber.900}
  color.ai.confirmation.border = {color.amber.300} | dark: {color.amber.700}
```

### Practical Setup Steps

**Step 1: Set up Figma**
1. Create a Design System Library file in Figma
2. Install Tokens Studio plugin
3. Create Variable Collections: Primitives, Semantic, Components
4. Add Light and Dark modes to Semantic collection
5. Apply Gluestack v3 design kit as a starting point
6. Customize tokens to match banking app brand

**Step 2: Connect to GitHub**
1. In Tokens Studio, add GitHub as sync provider
2. Create a Personal Access Token with repo scope
3. Point to your monorepo's `tokens/` directory
4. Choose folder storage mode (multi-file) if on Pro plan

**Step 3: Set up Style Dictionary**
1. Install: `npm install style-dictionary @tokens-studio/sd-transforms`
2. Create `sd.config.mjs` with Tailwind + CSS output platforms
3. Add build script to `package.json`: `"build:tokens": "style-dictionary build --config sd.config.mjs"`
4. Test locally: `npm run build:tokens`

**Step 4: Configure NativeWind**
1. Import generated CSS variables in `global.css`
2. Reference tokens in `tailwind.config.js` theme
3. Use token-based classes in components

**Step 5: Set up CI/CD**
1. Create `.github/workflows/build-tokens.yml`
2. Trigger on changes to `tokens/` directory
3. Run Style Dictionary build
4. Commit generated files back to repo

**Step 6: Documentation**
1. Create a Notion page for the design system
2. Document token naming conventions
3. Add component usage guidelines
4. Embed Figma frames for visual reference

---

## Key Takeaways

1. **Figma Variables ARE design tokens** -- they map 1:1 to the concept, with Collections as groups and Modes as themes.

2. **The W3C DTCG spec is now stable** (Oct 2025) -- use it. The `$value`/`$type` JSON format is the industry standard.

3. **Tokens Studio + Style Dictionary is the proven pipeline** -- free/cheap, open-source, well-documented, used by major companies.

4. **Three-tier token architecture** (primitive -> semantic -> component) is universally adopted by mature design systems.

5. **Git is the single source of truth** -- designers push token changes through Git (via Tokens Studio), developers consume via CI/CD.

6. **NativeWind/Tailwind consumes tokens as CSS variables or JS theme objects** -- both approaches work, CSS variables are more future-proof.

7. **Start simple, automate later** -- manual token export is fine for week 1. Automate when the design system stabilizes.

8. **Gluestack v3 already has a Figma kit** -- start there and customize rather than building from scratch.

---

## Sources

- [Figma Variables Guide](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma)
- [Figma Variables Overview (Collections, Modes)](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes)
- [Figma Modes for Variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables)
- [W3C Design Tokens Specification](https://www.w3.org/community/design-tokens/)
- [DTCG Stable Release Announcement (Oct 2025)](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- [Style Dictionary DTCG Support](https://styledictionary.com/info/dtcg/)
- [Style Dictionary Official Site](https://styledictionary.com/)
- [Tokens Studio Documentation](https://docs.tokens.studio/)
- [Tokens Studio W3C DTCG Format](https://docs.tokens.studio/manage-settings/token-format)
- [Tokens Studio GitHub Sync](https://docs.tokens.studio/token-storage/remote/sync-git-github)
- [Tokens Studio + Style Dictionary Integration](https://docs.tokens.studio/transform-tokens/style-dictionary)
- [sd-transforms Package](https://github.com/tokens-studio/sd-transforms)
- [Specify App](https://specifyapp.com/)
- [Supernova.io](https://www.supernova.io)
- [Supernova Portal (Sept 2025)](https://learn.supernova.io/latest/releases/september-2025/introducing-supernova-portal-bq2CR2Jk)
- [NativeWind](https://www.nativewind.dev/)
- [Terrazzo (DTCG-native tool)](https://terrazzo.app/docs/guides/dtcg/)
- [Martin Fowler - Design Token-Based UI Architecture](https://martinfowler.com/articles/design-token-based-ui-architecture.html)
- [Design Token Naming Best Practices (Smashing Magazine)](https://www.smashingmagazine.com/2024/05/naming-best-practices/)
- [Shopify Polaris Tokens](https://github.com/Shopify/polaris-tokens)
- [GitHub Primer Primitives](https://github.com/primer/primitives)
- [Gluestack UI v3 Figma Design Kit](https://www.figma.com/community/file/1577667149474894602/gluestack-ui-v3-0-design-kit)
- [Gluestack UI Figma Kit Docs](https://gluestack.io/ui/docs/home/getting-started/figma-ui-kit)
- [Storybook for React Native](https://github.com/storybookjs/react-native)
- [Storybook + Expo Guide](https://expo.dev/blog/storybook-and-expo)
- [Storybook Design Integrations](https://storybook.js.org/docs/sharing/design-integrations)
- [zeroheight Documentation](https://zeroheight.com/documentation/)
- [zeroheight Storybook Integration](https://zeroheight.com/blog/zeroheight-storybook-integration/)
- [Figma Component Naming (Rootstrap)](https://www.rootstrap.com/blog/mastering-figma-components-best-naming-practices-for-seamless-design-to-development-workflow)
- [Figma Variants Best Practices](https://www.figma.com/best-practices/creating-and-organizing-variants/)
- [Design Tokens: Figma to Code Pipelines (2025)](https://wphtaccess.com/2025/09/13/design-tokens-in-figma-%E2%86%92-code-pipelines/)
- [Design Tokens Ecosystem (DEV Community)](https://dev.to/timges/building-a-design-token-ecosystem-from-source-of-truth-to-automated-distribution-gpg)
- [sd-tailwindcss-transformer](https://github.com/nado1001/style-dictionary-tailwindcss-transformer)
- [Integrating Tokens with Tailwind](https://www.michaelmang.dev/blog/integrating-design-tokens-with-tailwind/)
- [Tokens Studio GitHub Actions Integration](https://documentation.tokens.studio/guides/integrating-with-github-actions)
