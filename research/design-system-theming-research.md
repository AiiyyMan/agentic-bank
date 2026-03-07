# Design System & White-Label Theming Research

**Date:** 2026-03-06
**Stack:** React Native + Expo + Gluestack UI v3 + NativeWind v4 + TypeScript
**Purpose:** Inform the architecture for a themeable, white-label-ready design system for the Agentic Banking App

---

## Table of Contents

1. [Design Tokens Architecture](#1-design-tokens-architecture)
2. [NativeWind v4 Theming](#2-nativewind-v4-theming)
3. [Gluestack UI v3 Theming](#3-gluestack-ui-v3-theming)
4. [White-Labeling Patterns](#4-white-labeling-patterns-in-react-native)
5. [Design System Tooling](#5-design-system-tooling)
6. [Single Source of Truth Patterns](#6-single-source-of-truth-patterns)
7. [Architecture Patterns Comparison](#7-architecture-patterns-comparison)
8. [Real-World Examples](#8-real-world-examples)
9. [Recommended Architecture](#9-recommended-architecture-for-agentic-banking-app)
10. [Forward Compatibility: NativeWind v5](#10-forward-compatibility-nativewind-v5)

---

## 1. Design Tokens Architecture

### Token Format: CSS Variables (via NativeWind `vars()`)

The recommended format for your stack is **CSS custom properties (CSS variables)**, defined as RGB/HSL channel values in a TypeScript config file, and mapped through `tailwind.config.js`. This is the native approach for both NativeWind v4 and Gluestack UI v3.

**Why CSS variables over JSON or plain TS objects:**

| Format | Pros | Cons |
|--------|------|------|
| JSON tokens | Tool-agnostic, exportable to Figma | Requires build step to convert; no runtime switching |
| Plain TS object | Type-safe, importable | No cascading; must pass through context or props |
| CSS variables (via `vars()`) | Runtime switching, cascading inheritance, works with Tailwind `<alpha-value>`, native to both NativeWind and Gluestack | Slightly more complex initial setup |

### Token Categories

Structure your tokens into these layers:

```
tokens/
  colors/        -- primitive palette (blue-500, gray-100, etc.)
  semantic/      -- functional mapping (primary, background, error, etc.)
  typography/    -- font families, sizes, weights, line heights
  spacing/       -- margin/padding scale
  radii/         -- border radius values
  shadows/       -- elevation/shadow definitions
  motion/        -- animation durations, easings (optional)
```

### Concrete Token Definition Pattern

Define tokens as RGB channel triplets (without the `rgb()` wrapper) to enable Tailwind's opacity modifier syntax (`bg-primary/50` for 50% opacity):

```typescript
// src/theme/tokens.ts
export const tokens = {
  light: {
    // Primitive palette (private -- not used directly in components)
    '--color-blue-500': '59 130 246',
    '--color-blue-600': '37 99 235',
    '--color-green-500': '34 197 94',
    '--color-red-500': '239 68 68',
    '--color-gray-50': '249 250 251',
    '--color-gray-900': '17 24 39',

    // Semantic tokens (public -- used in components)
    '--color-primary': '59 130 246',       // maps to blue-500
    '--color-primary-foreground': '255 255 255',
    '--color-secondary': '100 116 139',
    '--color-background': '255 255 255',
    '--color-foreground': '17 24 39',
    '--color-card': '249 250 251',
    '--color-card-foreground': '17 24 39',
    '--color-border': '229 231 235',
    '--color-input': '229 231 235',
    '--color-muted': '241 245 249',
    '--color-muted-foreground': '100 116 139',
    '--color-destructive': '239 68 68',
    '--color-success': '34 197 94',
    '--color-warning': '245 158 11',
    '--color-info': '59 130 246',

    // Typography
    '--font-family-sans': 'Inter',
    '--font-family-mono': 'JetBrainsMono',

    // Spacing (base unit in px)
    '--spacing-unit': '4',

    // Radii
    '--radius-sm': '6',
    '--radius-md': '8',
    '--radius-lg': '12',
    '--radius-xl': '16',
    '--radius-full': '9999',

    // Shadows (as RGB for shadow color)
    '--shadow-color': '0 0 0',
    '--shadow-opacity': '0.1',
  },
  dark: {
    '--color-primary': '96 165 250',
    '--color-primary-foreground': '17 24 39',
    '--color-secondary': '148 163 184',
    '--color-background': '15 23 42',
    '--color-foreground': '241 245 249',
    '--color-card': '30 41 59',
    '--color-card-foreground': '241 245 249',
    '--color-border': '51 65 85',
    '--color-input': '51 65 85',
    '--color-muted': '30 41 59',
    '--color-muted-foreground': '148 163 184',
    '--color-destructive': '248 113 113',
    '--color-success': '74 222 128',
    '--color-warning': '251 191 36',
    '--color-info': '96 165 250',

    '--shadow-color': '0 0 0',
    '--shadow-opacity': '0.3',
  },
};
```

### Tailwind Config Mapping

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
        },
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--color-card) / <alpha-value>)',
          foreground: 'rgb(var(--color-card-foreground) / <alpha-value>)',
        },
        border: 'rgb(var(--color-border) / <alpha-value>)',
        input: 'rgb(var(--color-input) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--color-muted) / <alpha-value>)',
          foreground: 'rgb(var(--color-muted-foreground) / <alpha-value>)',
        },
        destructive: 'rgb(var(--color-destructive) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      fontFamily: {
        sans: ['var(--font-family-sans)'],
        mono: ['var(--font-family-mono)'],
      },
    },
  },
  plugins: [],
};
```

---

## 2. NativeWind v4 Theming

### Core Mechanism: `vars()` Function

NativeWind v4 introduced CSS custom property support through the `vars()` function. This is the primary mechanism for runtime theming. NativeWind is explicitly "unopinionated on how you implement your theming," giving full flexibility.

### How `vars()` Works

`vars()` takes a dictionary of CSS variables and returns a React Native style object. When applied to a `View`'s `style` prop, all descendant components can reference those variables in their `className`:

```typescript
import { vars } from 'nativewind';

// vars() returns a style object that sets CSS variables
const lightTheme = vars({
  '--color-primary': 'rgb(59 130 246)',
  '--color-background': 'rgb(255 255 255)',
});

// Apply to a container -- all children inherit the variables
<View style={lightTheme}>
  <Text className="text-[--color-primary]">Themed text</Text>
</View>
```

### Runtime Theme Switching with Multiple Brands

This is the key pattern for white-labeling. Define multiple brand themes, each with light/dark variants:

```typescript
import { vars, useColorScheme } from 'nativewind';

const themes = {
  default: {
    light: vars({
      '--color-primary': '59 130 246',
      '--color-background': '255 255 255',
      '--color-foreground': '17 24 39',
    }),
    dark: vars({
      '--color-primary': '96 165 250',
      '--color-background': '15 23 42',
      '--color-foreground': '241 245 249',
    }),
  },
  clientA: {
    light: vars({
      '--color-primary': '34 197 94',    // green brand
      '--color-background': '255 255 255',
      '--color-foreground': '17 24 39',
    }),
    dark: vars({
      '--color-primary': '74 222 128',
      '--color-background': '15 23 42',
      '--color-foreground': '241 245 249',
    }),
  },
  clientB: {
    light: vars({
      '--color-primary': '168 85 247',   // purple brand
      '--color-background': '255 255 255',
      '--color-foreground': '17 24 39',
    }),
    dark: vars({
      '--color-primary': '192 132 252',
      '--color-background': '15 23 42',
      '--color-foreground': '241 245 249',
    }),
  },
};

function ThemeProvider({ brand, children }: { brand: string; children: React.ReactNode }) {
  const { colorScheme } = useColorScheme();
  const themeVars = themes[brand]?.[colorScheme] ?? themes.default[colorScheme];

  return <View style={[{ flex: 1 }, themeVars]}>{children}</View>;
}
```

### CSS Variables in global.css (Alternative Approach)

You can also define base tokens in `global.css` using `:root` and `@media (prefers-color-scheme: dark)`:

```css
/* global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: 59 130 246;
  --color-background: 255 255 255;
  --color-foreground: 17 24 39;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: 96 165 250;
    --color-background: 15 23 42;
    --color-foreground: 241 245 249;
  }
}
```

**Important:** The CSS approach defines the *defaults*; the `vars()` approach can *override* them at runtime for brand switching. Both can coexist.

### Accessing Theme Values in JavaScript

For cases where you need the resolved value (e.g., passing to a third-party chart library or ActivityIndicator):

```typescript
import { useUnstableNativeVariable } from 'nativewind';

function ThemedActivityIndicator() {
  const primaryColor = useUnstableNativeVariable('--color-primary');
  return <ActivityIndicator color={primaryColor} />;
}
```

Note: This API is marked "unstable" -- the name may change but the functionality is stable.

### Platform-Specific Theme Values

NativeWind provides helpers for platform-specific values in `tailwind.config.js`:

```javascript
const { platformSelect, hairlineWidth } = require('nativewind/theme');

module.exports = {
  theme: {
    extend: {
      borderWidth: {
        hairline: hairlineWidth(),
      },
      colors: {
        systemRed: platformSelect({
          ios: 'rgb(255 59 48)',
          android: 'rgb(244 67 54)',
          default: 'rgb(239 68 68)',
        }),
      },
    },
  },
};
```

### Dark Mode Control

NativeWind provides `useColorScheme()` for controlling dark mode:

```typescript
import { useColorScheme } from 'nativewind';

function SettingsScreen() {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();

  return (
    <Button onPress={toggleColorScheme}>
      <ButtonText>Current: {colorScheme}</ButtonText>
    </Button>
  );
}
```

---

## 3. Gluestack UI v3 Theming

### Architecture Overview

Gluestack UI v3 uses a **copy-paste component model** (not installed as a traditional npm dependency for components). Components are added to your project via `npx gluestack-ui@latest add <component>`, giving you full ownership of the code. Theming is handled through:

1. **`GluestackUIProvider`** -- wraps your app, manages color mode
2. **`config.ts`** -- defines CSS variable values for light/dark modes using `vars()`
3. **`tailwind.config.js`** -- maps CSS variables to Tailwind utility classes
4. **`global.css`** -- optional base-level CSS variable definitions

### GluestackUIProvider Setup

```typescript
// app/_layout.tsx
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { config } from '@/components/ui/gluestack-ui-provider/config';

export default function RootLayout() {
  const [colorMode, setColorMode] = useState<'light' | 'dark' | 'system'>('system');

  return (
    <GluestackUIProvider mode={colorMode} config={config}>
      <Stack />
    </GluestackUIProvider>
  );
}
```

The `mode` prop accepts: `'light'`, `'dark'`, or `'system'`.

### config.ts Structure

This is the central file for Gluestack theme tokens. It uses NativeWind's `vars()` function:

```typescript
// components/ui/gluestack-ui-provider/config.ts
import { vars } from 'nativewind';

export const config = {
  light: vars({
    // Primary palette
    '--color-primary-0': '179 179 179',
    '--color-primary-50': '153 153 153',
    '--color-primary-100': '128 128 128',
    '--color-primary-200': '115 115 115',
    '--color-primary-300': '102 102 102',
    '--color-primary-400': '82 82 82',
    '--color-primary-500': '51 51 51',
    '--color-primary-600': '41 41 41',
    '--color-primary-700': '31 31 31',
    '--color-primary-800': '26 26 26',
    '--color-primary-900': '18 18 18',
    '--color-primary-950': '13 13 13',

    // Secondary, Tertiary, Error, Success, Warning, Info...
    // (full palette for each)

    // Background tokens
    '--color-background-0': '255 255 255',
    '--color-background-50': '246 246 246',
    '--color-background-100': '242 242 242',
    '--color-background-200': '237 237 237',
    // ... more shades

    // Typography
    '--color-typography-0': '255 255 255',
    '--color-typography-50': '245 245 245',
    // ... scales to 950
  }),
  dark: vars({
    // Inverted values for dark mode
    '--color-primary-0': '230 230 230',
    '--color-primary-50': '210 210 210',
    // ... (values flip for dark mode)
    '--color-background-0': '18 18 18',
    '--color-background-50': '26 26 26',
    // ...
  }),
};
```

### How Gluestack Components Consume Tokens

Gluestack components use Tailwind classes that reference the CSS variables defined in config.ts. Since components are copy-pasted into your project, you can see and modify these classes directly:

```typescript
// components/ui/button/index.tsx (copy-pasted into your project)
import { tva } from '@gluestack-ui/nativewind-utils';

const buttonStyle = tva({
  base: 'rounded-lg px-4 py-2 items-center justify-center',
  variants: {
    action: {
      primary: 'bg-primary-500',
      secondary: 'bg-secondary-500',
      positive: 'bg-success-500',
      negative: 'bg-error-500',
    },
    variant: {
      solid: '',
      outline: 'bg-transparent border border-outline-300',
      link: 'bg-transparent',
    },
  },
});
```

### Customizing Gluestack Tokens for White-Labeling

To override for a specific brand, you only need to modify `config.ts`:

```typescript
// For Brand A (green fintech)
export const brandAConfig = {
  light: vars({
    '--color-primary-500': '34 197 94',     // green
    '--color-primary-600': '22 163 74',
    '--color-primary-700': '21 128 61',
    // ... keep other tokens or override as needed
  }),
  dark: vars({
    '--color-primary-500': '74 222 128',
    '--color-primary-600': '34 197 94',
    // ...
  }),
};
```

### TVA (Tailwind Variant Authority)

Gluestack v3 uses TVA for component variants, which extends Tailwind Variants with:
- `parentVariant` -- style based on parent component's variant
- `parentCompoundVariant` -- compound variants from parent
- Custom `twMergeConfig` for non-standard class groups

```typescript
import { tva, VariantProps } from '@gluestack-ui/nativewind-utils';

const cardStyle = tva({
  base: 'rounded-lg p-4 bg-card border border-border',
  variants: {
    variant: {
      elevated: 'shadow-md',
      outlined: 'border-2',
      ghost: 'border-0 bg-transparent',
    },
    size: {
      sm: 'p-2',
      md: 'p-4',
      lg: 'p-6',
    },
  },
  defaultVariants: {
    variant: 'elevated',
    size: 'md',
  },
});

type CardProps = VariantProps<typeof cardStyle>;
```

---

## 4. White-Labeling Patterns in React Native

### Pattern Comparison

| Pattern | Runtime? | Complexity | Best For |
|---------|----------|------------|----------|
| **Theme Provider + CSS vars** | Yes | Low-Medium | POC/demo, runtime brand switching |
| **Config-driven (JSON/TS)** | Yes | Medium | Multi-tenant SaaS, API-driven branding |
| **Build-time variants (Expo)** | No | Medium-High | Production apps with separate app store listings |
| **Plugin/override model** | Yes | High | Large-scale white-label platforms |

### Recommended for POC: Theme Provider + CSS Variables

For demoing to multiple potential clients, **runtime theme switching is essential**. This lets you:
- Switch brands in a settings screen during demos
- Avoid separate builds for each client
- Show the same app with different branding instantly

### Implementation: Multi-Brand Theme System

```typescript
// src/theme/brands.ts
import { vars } from 'nativewind';

export interface BrandConfig {
  id: string;
  name: string;
  logo: any;                    // require() for local, { uri: string } for remote
  splashImage?: any;
  tokens: {
    light: ReturnType<typeof vars>;
    dark: ReturnType<typeof vars>;
  };
  features?: {
    enableLoans: boolean;
    enableInternationalPayments: boolean;
    enableBiometrics: boolean;
  };
}

const defaultTokens = {
  '--color-primary': '59 130 246',
  '--color-primary-foreground': '255 255 255',
  '--color-background': '255 255 255',
  '--color-foreground': '17 24 39',
  '--color-card': '249 250 251',
  '--color-card-foreground': '17 24 39',
  '--color-border': '229 231 235',
  '--color-destructive': '239 68 68',
  '--color-success': '34 197 94',
  '--color-warning': '245 158 11',
};

export const brands: Record<string, BrandConfig> = {
  default: {
    id: 'default',
    name: 'Agentic Bank',
    logo: require('@/assets/logos/default.png'),
    tokens: {
      light: vars(defaultTokens),
      dark: vars({
        ...defaultTokens,
        '--color-primary': '96 165 250',
        '--color-background': '15 23 42',
        '--color-foreground': '241 245 249',
        '--color-card': '30 41 59',
        '--color-card-foreground': '241 245 249',
        '--color-border': '51 65 85',
      }),
    },
    features: {
      enableLoans: true,
      enableInternationalPayments: true,
      enableBiometrics: true,
    },
  },
  greenBank: {
    id: 'greenBank',
    name: 'GreenBank',
    logo: require('@/assets/logos/greenbank.png'),
    tokens: {
      light: vars({
        ...defaultTokens,
        '--color-primary': '34 197 94',
        '--color-primary-foreground': '255 255 255',
      }),
      dark: vars({
        ...defaultTokens,
        '--color-primary': '74 222 128',
        '--color-primary-foreground': '17 24 39',
        '--color-background': '15 23 42',
        '--color-foreground': '241 245 249',
      }),
    },
  },
};
```

### Brand Context Provider

```typescript
// src/theme/BrandProvider.tsx
import React, { createContext, useContext, useState, useMemo } from 'react';
import { View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { BrandConfig, brands } from './brands';

interface BrandContextValue {
  brand: BrandConfig;
  setBrand: (brandId: string) => void;
  availableBrands: string[];
}

const BrandContext = createContext<BrandContextValue | null>(null);

export function BrandProvider({
  initialBrand = 'default',
  children,
}: {
  initialBrand?: string;
  children: React.ReactNode;
}) {
  const [brandId, setBrandId] = useState(initialBrand);
  const { colorScheme } = useColorScheme();

  const brand = brands[brandId] ?? brands.default;
  const themeVars = brand.tokens[colorScheme ?? 'light'];

  const value = useMemo(
    () => ({
      brand,
      setBrand: setBrandId,
      availableBrands: Object.keys(brands),
    }),
    [brand],
  );

  return (
    <BrandContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVars]}>{children}</View>
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error('useBrand must be used within BrandProvider');
  return ctx;
}
```

### Build-Time Variants (for Production)

For production apps where each client gets their own app store listing, use Expo's `app.config.js` with EAS build profiles:

```javascript
// app.config.js
const BRAND = process.env.APP_BRAND || 'default';

const brandConfigs = {
  default: {
    name: 'Agentic Bank',
    slug: 'agentic-bank',
    ios: { bundleIdentifier: 'com.agenticbank.app' },
    android: { package: 'com.agenticbank.app' },
    icon: './assets/brands/default/icon.png',
    splash: { image: './assets/brands/default/splash.png' },
  },
  greenBank: {
    name: 'GreenBank',
    slug: 'greenbank',
    ios: { bundleIdentifier: 'com.greenbank.app' },
    android: { package: 'com.greenbank.app' },
    icon: './assets/brands/greenbank/icon.png',
    splash: { image: './assets/brands/greenbank/splash.png' },
  },
};

const brand = brandConfigs[BRAND] || brandConfigs.default;

export default {
  ...brand,
  // shared config
  sdkVersion: '53.0.0',
  scheme: brand.slug,
  extra: { brandId: BRAND },
};
```

```json
// eas.json
{
  "build": {
    "production-default": {
      "env": { "APP_BRAND": "default" }
    },
    "production-greenbank": {
      "env": { "APP_BRAND": "greenBank" }
    }
  }
}
```

### Hybrid Approach (Recommended for Your Use Case)

**POC phase:** Use runtime theme switching via `BrandProvider` + `vars()` for demos.
**Production phase:** Combine with build-time variants for app store assets (icons, splash screens, bundle IDs) while keeping runtime tokens for the in-app theme.

---

## 5. Design System Tooling

### Storybook for React Native: Production-Ready in 2025-2026

Storybook 9 (released 2025) has the best React Native support to date. Storybook 10 is in development with further improvements. The React Native Storybook ecosystem is now mature enough for production use.

### Setup with Expo

```bash
# Quick start with template
npx create-expo-app --template expo-template-storybook AwesomeStorybook

# Or add to existing project
npm create storybook@latest
# Select "React Native" when prompted
```

### Metro Configuration

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const withStorybook = require('@storybook/react-native/metro/withStorybook');

let config = getDefaultConfig(__dirname);
config = withNativeWind(config, { input: './global.css' });
config = withStorybook(config, {
  enabled: process.env.STORYBOOK_ENABLED === 'true',
  configPath: './.rnstorybook',
});

module.exports = config;
```

### Expo Router Integration

```typescript
// app/storybook.tsx
export { default } from '../.rnstorybook';

// app/_layout.tsx
<Stack.Protected guard={__DEV__}>
  <Stack.Screen name="storybook" options={{ headerShown: false }} />
</Stack.Protected>
```

### Story Configuration

```typescript
// .rnstorybook/main.ts
import type { StorybookConfig } from '@storybook/react-native';

const config: StorybookConfig = {
  stories: [
    '../components/**/*.stories.@(ts|tsx)',
    '../src/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-controls',
    '@storybook/addon-actions',
  ],
};

export default config;
```

### Theme Decorator for Storybook

This is critical for Storybook + Gluestack + NativeWind integration:

```typescript
// .rnstorybook/preview.tsx
import React from 'react';
import { View } from 'react-native';
import type { Preview } from '@storybook/react-native';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { BrandProvider } from '@/src/theme/BrandProvider';
import '../global.css';

const preview: Preview = {
  decorators: [
    (Story) => (
      <GluestackUIProvider mode="light">
        <BrandProvider initialBrand="default">
          <View style={{ flex: 1, padding: 16 }}>
            <Story />
          </View>
        </BrandProvider>
      </GluestackUIProvider>
    ),
  ],
  parameters: {
    controls: { expanded: true },
  },
};

export default preview;
```

### Example Component Story

```typescript
// components/ui/BankCard/BankCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-native';
import { BankCard } from './BankCard';

const meta: Meta<typeof BankCard> = {
  title: 'Banking/BankCard',
  component: BankCard,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'premium', 'business'],
    },
    balance: { control: 'number' },
    currency: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof BankCard>;

export const Default: Story = {
  args: {
    variant: 'default',
    balance: 12500.0,
    currency: 'GBP',
    cardNumber: '**** **** **** 4242',
    holderName: 'JOHN DOE',
  },
};

export const Premium: Story = {
  args: {
    ...Default.args,
    variant: 'premium',
  },
};
```

### Distribution Options

1. **On-device (development):** Stories run in your Expo app at a `/storybook` route
2. **TestFlight/Play Store internal:** Build a separate Storybook binary via EAS
3. **Web deployment:** Since Storybook RN is compatible with React Native Web, you can export and deploy to a URL for stakeholders to browse

```json
// package.json scripts
{
  "storybook": "STORYBOOK_ENABLED=true expo start",
  "storybook:web": "STORYBOOK_ENABLED=true expo start --web"
}
```

### Unit Testing from Stories

```typescript
import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react-native';
import * as stories from './BankCard.stories';

const { Default, Premium } = composeStories(stories);

test('renders card balance', () => {
  render(<Default />);
  expect(screen.getByText('12,500.00')).toBeTruthy();
});
```

### Alternatives to Storybook

| Tool | Status | Notes |
|------|--------|-------|
| **Storybook 9/10** | Recommended | Best RN support, Expo integration, web deployment |
| **Expo Storybook template** | Recommended | Quick start, pre-configured |
| **Dripsy playground** | Niche | Only for Dripsy-based designs |
| **Custom Expo route** | Fallback | Manual component gallery, no controls/docs |
| **Chromatic** | Complementary | Visual regression testing for Storybook |

---

## 6. Single Source of Truth Patterns

### The Goal

One config change (e.g., `--color-primary` from blue to green) must propagate to:
- All buttons, cards, headers, navigation
- Chat interface cards (ConfirmationCard, BalanceCard, etc.)
- Status bar color
- Tab bar/bottom navigation tint
- ActivityIndicator colors
- Charts (Victory Native XL)
- Splash screen (build-time only)
- App icon (build-time only)

### Layer Architecture

```
┌─────────────────────────────────────────────────┐
│  Brand Config (brands.ts)                        │
│  - brand name, logo, feature flags               │
│  - token overrides per brand                     │
├─────────────────────────────────────────────────┤
│  Token Definitions (config.ts / tokens.ts)       │
│  - CSS variables via vars()                      │
│  - light + dark variants                         │
├─────────────────────────────────────────────────┤
│  Tailwind Mapping (tailwind.config.js)           │
│  - Maps CSS vars to utility classes              │
│  - bg-primary, text-foreground, etc.             │
├─────────────────────────────────────────────────┤
│  Component Layer (Gluestack + custom)            │
│  - Uses Tailwind classes only                    │
│  - Never hardcodes color values                  │
│  - Uses TVA for variants                         │
├─────────────────────────────────────────────────┤
│  Screen Layer                                    │
│  - Composes themed components                    │
│  - Status bar/nav bar read from theme context    │
└─────────────────────────────────────────────────┘
```

### Handling Non-CSS Areas

#### Status Bar

```typescript
// components/ThemedStatusBar.tsx
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';

export function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}
```

#### Navigation/Header Colors

```typescript
// Use useUnstableNativeVariable to get resolved color for headers
import { useUnstableNativeVariable } from 'nativewind';

function useHeaderTheme() {
  const bg = useUnstableNativeVariable('--color-background');
  const fg = useUnstableNativeVariable('--color-foreground');
  const border = useUnstableNativeVariable('--color-border');

  return {
    headerStyle: { backgroundColor: `rgb(${bg})` },
    headerTintColor: `rgb(${fg})`,
    headerShadowVisible: false,
    headerBorderColor: `rgb(${border})`,
  };
}

// In _layout.tsx
const headerTheme = useHeaderTheme();
<Stack.Screen name="index" options={{ ...headerTheme, title: brand.name }} />
```

#### Charts (Victory Native XL)

```typescript
import { useUnstableNativeVariable } from 'nativewind';

function SpendingChart({ data }) {
  const primary = useUnstableNativeVariable('--color-primary');
  const success = useUnstableNativeVariable('--color-success');
  const warning = useUnstableNativeVariable('--color-warning');

  return (
    <CartesianChart data={data}>
      <Bar
        color={`rgb(${primary})`}
        // ...
      />
    </CartesianChart>
  );
}
```

#### Brand Logo / Assets

```typescript
import { useBrand } from '@/src/theme/BrandProvider';

function AppHeader() {
  const { brand } = useBrand();

  return (
    <View className="flex-row items-center px-4 py-2 bg-background">
      <Image source={brand.logo} className="w-8 h-8" resizeMode="contain" />
      <Text className="text-foreground font-semibold ml-2">{brand.name}</Text>
    </View>
  );
}
```

#### Splash Screen (Build-Time Only)

Splash screens are native assets and cannot be changed at runtime. For production white-labeling, use Expo build variants:

```
assets/
  brands/
    default/
      icon.png
      splash.png
      adaptive-icon.png
    greenBank/
      icon.png
      splash.png
      adaptive-icon.png
```

For POC demos, you can create an "animated splash" screen in React that loads after the native splash and shows the brand-specific logo:

```typescript
// app/splash.tsx
import { useBrand } from '@/src/theme/BrandProvider';
import Animated, { FadeIn } from 'react-native-reanimated';

export function BrandedSplash({ onReady }: { onReady: () => void }) {
  const { brand } = useBrand();

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Animated.Image
        entering={FadeIn.duration(500)}
        source={brand.logo}
        className="w-32 h-32"
        resizeMode="contain"
      />
      <Text className="text-primary text-2xl font-bold mt-4">{brand.name}</Text>
    </View>
  );
}
```

### The Rule: Never Hardcode

Every component must reference semantic tokens, never literal values:

```typescript
// BAD - hardcoded color
<View style={{ backgroundColor: '#3B82F6' }}>
<Text className="text-blue-500">

// GOOD - semantic token
<View className="bg-primary">
<Text className="text-primary">

// BAD - hardcoded in third-party integration
<ActivityIndicator color="#3B82F6" />

// GOOD - resolved from theme
const primary = useUnstableNativeVariable('--color-primary');
<ActivityIndicator color={`rgb(${primary})`} />
```

---

## 7. Architecture Patterns Comparison

### Pattern A: CSS Variable-Based (via NativeWind `vars()`)

**How it works:** Define token values as CSS variables; apply via `vars()` on a root View; all children inherit and use them through Tailwind classes.

```
Pros:
+ Runtime switching (instant brand/mode changes)
+ CSS cascade inheritance (no prop drilling)
+ Works with Tailwind alpha modifiers (bg-primary/50)
+ Minimal re-renders (only variable context re-evaluates)
+ Consistent with web Tailwind CSS patterns
+ Native to both NativeWind and Gluestack

Cons:
- Values must be RGB/HSL channel triplets for alpha support
- useUnstableNativeVariable API may change
- Debugging CSS variables in React Native is harder than inspecting a JS object
- Not available for native-layer elements (splash screen, native alerts)
```

### Pattern B: React Context Provider (Traditional)

**How it works:** Define a theme object in TypeScript; provide via React Context; consume via `useTheme()` hook; pass values to style props.

```
Pros:
+ Full TypeScript autocomplete and type safety
+ Easy to debug (it's just a JS object)
+ Works everywhere, including third-party components
+ Can include non-style data (logos, feature flags, strings)

Cons:
- Re-renders entire subtree when theme changes (unless memoized carefully)
- Must pass theme values through style props, not className
- Does not integrate with Tailwind/NativeWind className system
- Requires ThemeProvider wrapper and useTheme hook in every themed component
```

### Pattern C: Build-Time Configuration

**How it works:** Environment variables at build time select a brand config; Expo `app.config.js` and EAS profiles produce different binaries.

```
Pros:
+ Different app icons, splash screens, bundle IDs per client
+ No runtime overhead
+ Clean separation in app stores
+ Can include/exclude features at build time

Cons:
- No runtime switching (separate builds required)
- Slow iteration (rebuild to test a different brand)
- Cannot demo multiple brands in one app
```

### Recommended: Hybrid A + C

**For your Agentic Banking App, combine Pattern A (runtime) with Pattern C (build-time):**

- **Pattern A** for all in-app theming (colors, typography, spacing, component variants)
- **Pattern C** for native assets only (app icon, splash screen, bundle ID)
- **BrandProvider context** for non-CSS data (logo image, brand name, feature flags)

This gives you:
- Instant brand switching during demos (Pattern A)
- Proper app store listings per client in production (Pattern C)
- Feature flags and branding data accessible everywhere (BrandProvider)

### How Gluestack + NativeWind Work Together

The integration is seamless because Gluestack v3 was built on top of NativeWind:

```
GluestackUIProvider (manages mode: light/dark/system)
  └── Applies config.ts values via vars() to root View
      └── All Gluestack components use Tailwind classes
          └── Tailwind classes reference CSS variables
              └── CSS variables are resolved from vars() on nearest ancestor

BrandProvider (manages brand selection)
  └── Applies brand-specific vars() overrides on a View
      └── Overrides cascade to all children
          └── Same Tailwind classes resolve to different colors per brand
```

The key insight: **Gluestack's config.ts and your BrandProvider both use the same `vars()` mechanism.** You can either:
1. Modify Gluestack's `config.ts` directly to include brand variants, or
2. Layer your `BrandProvider` inside `GluestackUIProvider` so your brand vars override the defaults

Option 2 is cleaner because it keeps Gluestack's defaults intact and adds your overrides on top.

---

## 8. Real-World Examples

### Shopify (Restyle / Polaris)

Shopify developed the **Restyle** library (open-source) for their React Native apps (Shop, Shopify POS). Key architectural principles:

- **Centralized theme object** as single source of truth with spacing (t-shirt sizes: XS, S, M, L, XL), colors (two layers: primitive palette + semantic mapping), and typography (named variants like "Header", "Body")
- **React Context** for theme distribution (not CSS variables, as they predate NativeWind)
- **Box and Text** components that accept theme-aware props (e.g., `<Box padding="m" backgroundColor="cardBackground">`)
- **Responsive breakpoints** for phone vs tablet layouts
- **TypeScript enforcement** restricts props to only accept valid theme values

Note: Shopify has since moved toward Polaris Web Components for their extension ecosystem, but Restyle patterns remain relevant for native apps.

### Multi-Tenant Banking Platforms

White-label banking platforms (SDK.finance, DashDevs Fintech Core, Velmie, Mambu) typically follow:

- **Modular architecture:** Core banking features as composable modules
- **Configuration-driven branding:** Colors, fonts, logos loaded from a config file or API
- **Feature toggling:** Each client can enable/disable specific banking features
- **Separate app store listings:** Each client gets their own branded binary
- **Shared core, divergent UI shell:** Business logic is shared; the UI layer is the primary customization point

### Unit (Fintech-as-a-Service)

Unit provides a white-label React Native app for embedded banking. Their approach:

- Pre-built screens for accounts, cards, payments, lending
- Configuration object for branding (colors, fonts, logos)
- Component-level customization hooks
- API-driven feature availability

### Common Pattern Across All Examples

Every production white-label system follows this hierarchy:

```
1. Brand configuration (static or API-loaded)
2. Theme token resolution (map brand config to design tokens)
3. Provider injection (make tokens available to component tree)
4. Component consumption (components use semantic tokens, never raw values)
5. Build-time assets (icons, splash screens) per brand variant
```

---

## 9. Recommended Architecture for Agentic Banking App

### File Structure

```
apps/mobile/
  src/
    theme/
      tokens.ts              # Base design token definitions (all CSS vars)
      brands.ts              # Per-brand token overrides + metadata
      BrandProvider.tsx       # React context for brand switching
      useThemeColor.ts        # Hook to get resolved colors for JS usage
      index.ts               # Re-exports
    components/
      ui/
        gluestack-ui-provider/
          config.ts           # Gluestack token config (uses tokens.ts)
          index.tsx            # GluestackUIProvider component
        button/
        card/
        text/
        ...
      banking/
        BankCard/
          BankCard.tsx
          BankCard.stories.tsx
        TransactionItem/
        BalanceDisplay/
        ...
      chat/
        ConfirmationCard/
        BalanceCard/
        ...
    app/
      _layout.tsx             # Root layout with providers
      (tabs)/
        index.tsx             # Dashboard
        chat.tsx              # Chat
        ...
      storybook.tsx           # Storybook route (dev only)
  assets/
    brands/
      default/
        logo.png
        icon.png
        splash.png
      greenBank/
        logo.png
        icon.png
        splash.png
  tailwind.config.js
  global.css
  app.config.js               # Dynamic Expo config (reads APP_BRAND env var)
  .rnstorybook/
    main.ts
    preview.tsx                # Storybook with theme decorator
```

### Provider Stack

```typescript
// app/_layout.tsx
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { BrandProvider } from '@/src/theme/BrandProvider';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';

export default function RootLayout() {
  return (
    <GluestackUIProvider mode="system">
      <BrandProvider initialBrand={Constants.expoConfig?.extra?.brandId ?? 'default'}>
        <ThemedStatusBar />
        <Stack screenOptions={useHeaderTheme()} />
      </BrandProvider>
    </GluestackUIProvider>
  );
}
```

### Token Flow

```
brands.ts (brand-specific overrides)
    │
    ▼
BrandProvider.tsx (applies vars() to root View)
    │
    ▼
config.ts (Gluestack defaults, can be overridden by brand vars)
    │
    ▼
tailwind.config.js (maps CSS vars to Tailwind utilities)
    │
    ▼
Components (use className="bg-primary text-foreground" etc.)
    │
    ▼
useUnstableNativeVariable() (for JS-only contexts: charts, native APIs)
```

### Utility Hook

```typescript
// src/theme/useThemeColor.ts
import { useUnstableNativeVariable } from 'nativewind';

/**
 * Returns a resolved RGB color string for use in JS contexts
 * (charts, ActivityIndicator, StatusBar, etc.)
 */
export function useThemeColor(
  variable: `--color-${string}`,
  format: 'rgb' | 'channels' = 'rgb'
): string {
  const channels = useUnstableNativeVariable(variable);
  if (format === 'channels') return channels;
  return `rgb(${channels})`;
}

// Usage:
const primaryColor = useThemeColor('--color-primary');
// => "rgb(59 130 246)"
```

### Quick Brand Switcher (for Demo Mode)

```typescript
// components/dev/BrandSwitcher.tsx
import { useBrand } from '@/src/theme/BrandProvider';
import { Button, ButtonText } from '@/components/ui/button';

export function BrandSwitcher() {
  const { brand, setBrand, availableBrands } = useBrand();

  if (!__DEV__) return null;

  return (
    <View className="flex-row gap-2 p-4 bg-muted">
      {availableBrands.map((id) => (
        <Button
          key={id}
          variant={id === brand.id ? 'solid' : 'outline'}
          size="sm"
          onPress={() => setBrand(id)}
        >
          <ButtonText>{id}</ButtonText>
        </Button>
      ))}
    </View>
  );
}
```

---

## 10. Forward Compatibility: NativeWind v5

NativeWind v5 is currently in preview and brings significant changes. Planning for it now avoids a painful migration later.

### Key Changes from v4 to v5

| Area | v4 | v5 |
|------|----|----|
| **Tailwind version** | v3 | v4.1+ |
| **Configuration** | `tailwind.config.js` (JS) | `@theme` in CSS (CSS-first) |
| **CSS directives** | `@tailwind base/components/utilities` | `@import "tailwindcss/theme.css"` etc. |
| **Babel setup** | Custom preset + nativewind/babel | Standard babel-preset-expo only |
| **Metro setup** | `withNativeWind(config, { input })` | `withNativewind(config)` (no input) |
| **PostCSS** | Not required | Required (`@tailwindcss/postcss`) |
| **Platform functions** | `platformSelect()` in JS config | CSS media queries (`@media ios`) |
| **Theme functions** | `nativewind/theme` export | CSS functions in `@theme` blocks |
| **React Native version** | 0.74+ | 0.81+ |

### What This Means for Your Architecture

The `vars()` function and CSS variable approach will continue working in v5. The main change is *where* you define your base theme (CSS `@theme` block instead of `tailwind.config.js`). Your runtime brand switching via `vars()` and BrandProvider will remain unaffected.

### v5 Theme Definition (CSS-first)

```css
/* global.css (v5) */
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";
@import "nativewind/theme";

@theme {
  --color-primary: rgb(var(--color-primary-channels));
  --color-background: rgb(var(--color-background-channels));
  --color-foreground: rgb(var(--color-foreground-channels));
  --color-error: platformColor(systemRed, red);
  --spacing-hairline: hairlineWidth();
}

:root {
  --color-primary-channels: 59 130 246;
  --color-background-channels: 255 255 255;
  --color-foreground-channels: 17 24 39;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary-channels: 96 165 250;
    --color-background-channels: 15 23 42;
    --color-foreground-channels: 241 245 249;
  }
}
```

### Migration Strategy

1. **Build on v4 now** (stable, well-documented, Gluestack v3 supports it)
2. **Use the CSS variable pattern** (survives the migration)
3. **Keep `tailwind.config.js` theme extensions minimal** (easier to port to `@theme` later)
4. **Avoid `nativewind/theme` JS exports** (removed in v5; use CSS functions instead)
5. **When RN 0.81 + Expo SDK 54+ ship:** run `npx nativewind migrate` and update global.css

---

## Sources

- [NativeWind Themes Guide](https://www.nativewind.dev/docs/guides/themes)
- [NativeWind v4 Announcement](https://www.nativewind.dev/blog/announcement-nativewind-v4)
- [NativeWind vars() API](https://www.nativewind.dev/docs/api/vars)
- [NativeWind v5 Migration Guide](https://www.nativewind.dev/v5/guides/migrate-from-v4)
- [NativeWind v5 Overview](https://www.nativewind.dev/v5)
- [NativeWind with Design Tokens and Dark Mode](https://willcodefor.beer/posts/rntw)
- [NativeWind v4 Multiple Themes Example](https://github.com/Saraivinha1703/nativewind-v4-multiple-themes)
- [Gluestack v3 Release Blog](https://gluestack.io/blogs/gluestack-v3-release)
- [Gluestack UI Customizing Theme](https://gluestack.io/ui/docs/home/theme-configuration/customizing-theme)
- [Gluestack UI Default Tokens](https://gluestack.io/ui/docs/home/theme-configuration/default-tokens)
- [Gluestack UI Dark Mode](https://gluestack.io/ui/docs/home/theme-configuration/dark-mode)
- [Gluestack UI NativeWind Utils](https://gluestack.io/ui/docs/home/getting-started/gluestack-ui-nativewind-utils)
- [Gluestack UI GitHub Repository](https://github.com/gluestack/gluestack-ui)
- [Storybook 9 + Expo Blog Post](https://expo.dev/blog/storybook-and-expo)
- [Storybook React Native GitHub](https://github.com/storybookjs/react-native)
- [Shopify: 5 Ways to Improve RN Styling](https://shopify.engineering/5-ways-to-improve-your-react-native-styling-workflow)
- [Shopify: Five Years of React Native](https://shopify.engineering/five-years-of-react-native-at-shopify)
- [Designing a Scalable White-Label System (Jia Song)](https://jia-song.medium.com/designing-a-scalable-white-label-mobile-app-system-with-react-native-27edef75c457)
- [Multi-Brand White-Label Architecture (TechTrends)](https://medium.com/techtrends-digest/building-scalable-multi-brand-mobile-apps-a-modern-white-label-architecture-approach-f0258ab08ad4)
- [Expo Build Variants](https://docs.expo.dev/build-reference/variants/)
- [Expo App Config](https://docs.expo.dev/versions/latest/config/app/)
- [Design Tokens with Tailwind v4 2026 (Mavik Labs)](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026)
