# Frontend Engineering Guide

> For all developers building Agentic Bank mobile UI.
> Read this before writing any component code.

---

## Stack

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| Framework | React Native | 0.83.2 | Via Expo SDK 55 |
| Styling | NativeWind | 4.2.2 (stable) | Tailwind classes on RN views |
| Tailwind | Tailwind CSS | 3.4.17 | Processed by NativeWind at build time |
| Navigation | Expo Router | 55.x | File-based routing |
| Icons | Phosphor React Native | 2.x | Always import individually |
| Fonts | Inter | via @expo-google-fonts | Loaded in `_layout.tsx` |
| State | Zustand | 5.x | |
| Animations | Reanimated | 4.x | For shared transitions + custom anims |

---

## Design Token System

### Architecture

```
Primitive (global.css :root)     Semantic (global.css :root)        Tailwind class
--color-brand-50: 14 165 233    --color-brand-default: 14 165 233  bg-brand-default
```

Three tiers: **primitive** (raw palette values), **semantic** (purpose-driven), **component** (in docs only).

### The Golden Rules

1. **Never hard-code hex/rgb values in components.** Use `className="bg-surface-raised text-text-primary"`.
2. **Semantic tokens are flattened.** Every semantic var in `global.css` contains a literal RGB triplet, NOT a `var()` reference to a primitive. NativeWind cannot resolve nested CSS variables.
3. **Adding a new token?** Add the RGB triplet to BOTH `:root` (light) AND `@media (prefers-color-scheme: dark) { :root { } }` (dark) in `global.css`, then add the mapping in `tailwind.config.js`.
4. **JS-only contexts** (navigation headers, chart fills, ActivityIndicator): use `useTokens()` from `@/theme/tokens`. Never hard-code colors in JS either.

### Dark Mode

- Driven by system preference via `@media (prefers-color-scheme: dark)` in `global.css`
- NativeWind's `dark:` prefix works automatically
- `app.json` has `userInterfaceStyle: "automatic"`
- StatusBar uses `style="auto"` to adapt

### Color Naming

Utility classes combine Tailwind prefix + config key:
- `bg-background-primary` = background utility + `background.primary` color
- `text-text-primary` = text utility + `text.primary` color (yes, `text-` appears twice)
- `border-border-default` = border utility + `border.DEFAULT` color

This is intentional -- the semantic layer (`background`, `text`, `border`) is distinct from the Tailwind utility prefix.

---

## Component Development

### File Structure

```
components/
  cards/
    BalanceCard.tsx
    ConfirmationCard.tsx
    ...
  ui/
    Button.tsx
    Input.tsx
    Badge.tsx
    ...
  chat/
    ChatBubble.tsx
    TypingIndicator.tsx
    CardRenderer.tsx
    ...
```

### Component Template

```tsx
import { View, Text, Pressable } from "react-native";
import { CheckCircle } from "phosphor-react-native";
import { useTokens } from "@/theme/tokens";

interface SuccessCardProps {
  title: string;
  message: string;
  onAction: () => void;
}

export function SuccessCard({ title, message, onAction }: SuccessCardProps) {
  const t = useTokens();

  return (
    <View className="bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default items-center">
      <CheckCircle size={48} color={t.status.success.default} weight="fill" />
      <Text className="text-text-primary text-lg font-semibold mt-4 text-center">
        {title}
      </Text>
      <Text className="text-text-secondary text-sm text-center mt-2 leading-relaxed">
        {message}
      </Text>
      <Pressable
        className="bg-brand-default active:bg-brand-active w-full rounded-lg px-6 py-3 mt-6 items-center"
        onPress={onAction}
      >
        <Text className="text-text-inverse text-sm font-semibold">Done</Text>
      </Pressable>
    </View>
  );
}
```

### Key Patterns

- **All styling via `className`** -- no `StyleSheet.create`, no inline `style` objects for visual properties.
- **`useTokens()` only for JS contexts** -- Phosphor icon `color` prop, navigation `headerStyle`, chart libraries.
- **Pressable over TouchableOpacity** -- use `active:` modifier for press states.
- **Never use `<TouchableOpacity>`** -- NativeWind's `active:` prefix on `<Pressable>` handles press feedback.

---

## React Native Gotchas

### Things That Don't Work in NativeWind v4

| Feature | Status | Workaround |
|---------|--------|------------|
| Custom `boxShadow` CSS syntax | Does not work | Use built-in `shadow-sm` through `shadow-2xl` |
| Nested `var()` in CSS | Does not resolve | Flatten to literal RGB triplets |
| `font-variant-numeric: tabular-nums` | May not work | Test early; fallback to monospace for numbers |
| `animate-pulse` | Limited support | Implement with Reanimated opacity loop if broken |
| `ring-*` utilities | Partial support | Use `border` for focus states on native |
| CSS gradients | Not supported | Use `expo-linear-gradient` |
| `backdrop-blur` | Not supported | Use solid overlay colors |

### Things That DO Work

- `rounded-*` including per-corner (`rounded-bl-sm`)
- `max-w-[85%]` (percentage widths, if parent has defined width)
- `tracking-*` (letter spacing)
- `uppercase`, `lowercase`, `capitalize`
- `opacity-*` and color opacity modifiers (`bg-brand/50`)
- `dark:` prefix for dark mode variants
- `flex-row`, `flex-col`, all flexbox utilities

### Shadows in React Native

NativeWind translates Tailwind's default shadow utilities to platform-native shadows:
- **iOS**: `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`
- **Android**: `elevation`

Use `shadow-sm` for cards, `shadow` for raised elements. Do NOT define custom `boxShadow` values.

### Navigation Headers

```tsx
import { useTokens } from "@/theme/tokens";

const t = useTokens();

<Stack.Screen
  options={{
    headerStyle: { backgroundColor: t.surface.raised },
    headerTintColor: t.text.primary,
    headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
  }}
/>
```

Navigation APIs accept only JS color strings. Always use `useTokens()`.

---

## Typography

All text uses Inter. Weight mapping:

| Tailwind class | Inter variant | Weight |
|---------------|---------------|--------|
| `font-normal` | Inter_400Regular | 400 |
| `font-medium` | Inter_500Medium | 500 |
| `font-semibold` | Inter_600SemiBold | 600 |
| `font-bold` | Inter_700Bold | 700 |
| `font-extrabold` | Inter_800ExtraBold | 800 |

If you need a new weight, add it to `useFonts()` in `app/_layout.tsx`.

---

## Monetary Values

```tsx
// Always use tabular-nums + money-* tokens
<Text className="text-money-positive text-sm font-semibold tabular-nums">
  +£1,234.56
</Text>
<Text className="text-money-negative text-sm font-semibold tabular-nums">
  £42.50
</Text>
<Text className="text-money-pending text-sm font-semibold tabular-nums italic">
  £15.00
</Text>
```

- Positive (income): `text-money-positive` + `+` prefix
- Negative (spending): `text-money-negative` (= text primary, NOT red)
- Pending: `text-money-pending` + `italic`
- Always 2 decimal places, comma thousands separator
- Red is reserved for errors and declines, never for normal spending

---

## Icons

```tsx
import { ArrowRight } from "phosphor-react-native";
import { useTokens } from "@/theme/tokens";

const t = useTokens();
<ArrowRight size={20} color={t.text.secondary} weight="regular" />
```

- Import individually (tree-shaking)
- Default weight: `regular`
- Use `fill` weight only for active/selected states
- Size by context: 16px inline, 20px in buttons/lists, 24px in cards/tabs, 48px for status heroes

---

## Animations

Use `react-native-reanimated` for all animations. Avoid `LayoutAnimation` on Android.

```tsx
// Skeleton pulse (if animate-pulse doesn't work in NativeWind)
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const opacity = useSharedValue(0.4);

useEffect(() => {
  opacity.value = withRepeat(withTiming(1, { duration: 750 }), -1, true);
}, []);

const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
```

Keep animations subtle. This is a banking app -- trust over delight.

---

## Testing

Run components in isolation before integrating into flows. For card development, prefer building against mock data rather than navigating through the full app.

---

## PR Checklist

Before submitting any component PR:

- [ ] Zero hard-coded hex/rgb values (search for `#` and `rgb(` in your diff)
- [ ] All colors use semantic tokens, not primitives (use `text-text-primary` not `text-gray-90`)
- [ ] `tabular-nums` on all monetary `<Text>` components
- [ ] `accessibilityLabel` on all icon-only buttons
- [ ] Minimum 44x44px touch targets on all pressables
- [ ] Dark mode tested (toggle system preference)
- [ ] Both iOS and Android verified (shadows render differently)
- [ ] No `StyleSheet.create` for visual styling (use `className`)
- [ ] Phosphor icons imported individually, not `import * from`
