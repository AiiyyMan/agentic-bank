# Agent Design Instructions -- Agentic Bank

> **Phase 1e, Output 3** | Generated 2026-03-07
> Read this file alongside `CLAUDE.md`. It is the single source of truth for
> visual implementation. You will NOT have Figma access during implementation.

---

## 1. Visual Language Summary

Agentic Bank follows a **clean, airy, modern banking aesthetic** inspired by (but not constrained to) the SwiftBank UI Kit. Our app is **chat-first and agentic** -- the home screen is a conversation, not a dashboard. SwiftBank informs our visual language (colours, typography, spacing, card styling) but our interaction model, card catalogue, and information architecture are our own. Screens use generous white space with a near-white background (#F8FAFC) and raised white (#FFFFFF) card surfaces separated by subtle shadows and thin slate borders. The sky-blue brand colour (#0EA5E9) appears sparingly as an accent -- on primary buttons, active states, and key highlights -- never as a large background fill. Typography is set entirely in Inter, with clear hierarchy enforced through weight and size rather than colour variety. Rounded corners are applied universally (cards at 24px, buttons and inputs at 8px, avatars and pills at full circle). The overall feel is trustworthy, calm, and spacious -- a premium fintech experience that lets content breathe.

---

## 2. Token Architecture (Quick Reference)

The design system uses a strict **three-tier token chain**. Always reference the semantic layer in code; never hard-code hex values.

```
Primitive         Semantic (light)            CSS Variable                    Tailwind class
---------         ----------------            ------------                    --------------
#FFFFFF           color.surface.raised        --color-surface-raised          bg-surface-raised
#F8FAFC           color.background.secondary  --color-background-secondary    bg-background-secondary
#0F172A           color.text.primary          --color-text-primary            text-text-primary
#334155           color.text.secondary        --color-text-secondary          text-text-secondary
#64748B           color.text.tertiary         --color-text-tertiary           text-text-tertiary
#E2E8F0           color.border.default        --color-border-default          border-border-default
#0EA5E9           color.brand.default         --color-brand-default           bg-brand-default
#10B981           color.status.success.default --color-status-success-default  bg-status-success-default
#F43F5E           color.status.error.default  --color-status-error-default    bg-status-error-default
#EAB308           color.status.warning.default --color-status-warning-default  bg-status-warning-default
#3B82F6           color.status.info.default   --color-status-info-default     bg-status-info-default
#059669           money.positive              --color-money-positive          text-money-positive
#0F172A           money.negative              --color-money-negative          text-money-negative
#CA8A04           money.pending               --color-money-pending           text-money-pending
#F0F9FF           ai.bubble.assistant         --color-ai-bubble-assistant     bg-ai-bubble-assistant
#0EA5E9           ai.bubble.user              --color-ai-bubble-user          bg-ai-bubble-user
```

> **Naming rule:** CSS variables in `global.css` use RGB triplets (`--color-brand-50: 14 165 233`).
> Semantic tokens are flattened (NOT nested `var()` refs) because NativeWind cannot resolve nested CSS vars.
> `tailwind.config.js` maps them: `brand: { DEFAULT: "rgb(var(--color-brand-default) / <alpha-value>)" }`.
> Utility classes follow the config nesting: `bg-background-primary`, `text-text-primary`, `bg-brand-default`.
> Both `global.css` (values) and `tailwind.config.js` (mappings) are sources of truth.

### Dark Mode

Dark mode inverts surfaces. Key mappings change:

| Semantic token           | Light         | Dark          |
|--------------------------|---------------|---------------|
| background.primary       | #FFFFFF       | #000000       |
| surface.raised           | #FFFFFF       | #1F2937       |
| text.primary             | #0F172A       | #F8FAFC       |
| text.secondary           | #334155       | #E2E8F0       |
| border.default           | #E2E8F0       | #334155       |
| brand.default            | #0EA5E9       | #38BDF8       |

Use NativeWind's `dark:` prefix for all dark-mode overrides. Every component below lists light-mode classes; add `dark:` variants where the semantic token differs (surfaces, text, borders).

---

## 3. Component Construction Rules

All classes below are NativeWind v4.2 / Tailwind CSS v3.4. Token values are defined as CSS custom properties (RGB triplets) in `global.css` and mapped to utility classes in `tailwind.config.js`. Dark mode uses the `dark:` variant, driven by `@media (prefers-color-scheme: dark)` in `global.css` (automatic system-based switching).

### 3.1 Balance Card

```
Container:   bg-surface-raised rounded-3xl p-6 shadow-sm border border-border-default
             dark:bg-surface-raised dark:border-border-default
Label:       text-text-tertiary text-xs font-extrabold uppercase tracking-widest
Amount (GBP):text-text-primary text-4xl font-bold
Amount (p):  text-text-tertiary text-xl font-medium
Subtext:     text-text-secondary text-sm font-normal
Tap target:  entire card is pressable; navigates to account detail
Icon right:  Phosphor CaretRight, size 20, text-text-tertiary
```

### 3.2 Transaction List Card

```
Container:   bg-surface-raised rounded-2xl shadow-sm border border-border-default
Row:         flex-row items-center px-4 py-3 gap-3
             border-b border-border-default (except last)
Icon circle: w-10 h-10 rounded-full bg-background-secondary items-center justify-center
             (category-specific: brand-subtle for transfers, status-success-subtle for income,
              status-error-subtle for declined, background-secondary for general)
Icon:        Phosphor icon, size 20, colour matches category semantic
Merchant:    text-text-primary text-sm font-medium flex-1
Date/time:   text-text-tertiary text-xs
Amount +ve:  text-money-positive text-sm font-semibold tabular-nums text-right
Amount -ve:  text-money-negative text-sm font-semibold tabular-nums text-right
Pending:     text-money-pending text-sm font-semibold tabular-nums text-right italic
```

### 3.3 Pot Status Card

```
Container:   bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default
Icon:        Phosphor PiggyBank / Target / Vault, size 24, text-brand-default
Title:       text-text-primary text-base font-semibold mt-2
Progress bar:h-2 rounded-full bg-background-tertiary overflow-hidden
  Fill:      h-full rounded-full bg-brand-default (width = percentage)
Amount row:  flex-row justify-between mt-2
  Saved:     text-text-primary text-sm font-semibold tabular-nums
  Target:    text-text-tertiary text-sm tabular-nums
Percentage:  text-brand-text text-xs font-bold
```

### 3.4 Confirmation Card

```
Container:   bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default
Header:      text-text-primary text-lg font-semibold mb-4
Detail row:  flex-row justify-between py-3 border-b border-border-default
  Label:     text-text-secondary text-sm
  Value:     text-text-primary text-sm font-medium text-right
Total row:   flex-row justify-between pt-4 (no border)
  Label:     text-text-primary text-base font-semibold
  Value:     text-text-primary text-xl font-bold tabular-nums
CTA:         Full-width primary button (see button rules), mt-4
```

### 3.5 Success Card

```
Container:   bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default items-center
Icon:        Phosphor CheckCircle weight=fill, size 48, text-status-success-default
Title:       text-text-primary text-lg font-semibold mt-4 text-center
Message:     text-text-secondary text-sm text-center mt-2 leading-relaxed
CTA:         Primary button, mt-6, full width
Secondary:   Ghost button beneath if needed
```

### 3.6 Error Card

```
Container:   bg-status-error-subtle rounded-2xl p-6 border border-status-error-default
Icon:        Phosphor WarningCircle weight=fill, size 48, text-status-error-default
Title:       text-status-error-text text-lg font-semibold mt-4 text-center
Message:     text-text-secondary text-sm text-center mt-2 leading-relaxed
Retry CTA:   Destructive button variant, mt-6, full width
Help link:   Ghost button, text-text-secondary, mt-2
```

### 3.7 Insight Card

```
Container:   bg-brand-subtle rounded-2xl p-5 border border-brand-muted
Icon left:   Phosphor Lightbulb weight=fill, size 24, text-brand-default
Title:       text-text-primary text-sm font-semibold ml-3
Body:        text-text-secondary text-sm mt-2 leading-relaxed
Action link: text-brand-default text-sm font-semibold mt-3
             Phosphor ArrowRight inline, size 16
```

### 3.8 Welcome Card

```
Container:   bg-brand-subtle rounded-2xl p-6 border border-brand-muted
Greeting:    text-text-primary text-xl font-bold
Subtitle:    text-text-secondary text-sm mt-1
Illustration:Optional SVG/Lottie, max-h-40, mt-4, self-center
Quick actions:flex-row gap-3 mt-4 (see Quick Reply Pills)
```

### 3.9 Input Card

```
Container:   bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default
Label:       text-text-secondary text-xs font-extrabold uppercase tracking-widest mb-2
Input field: bg-background-primary rounded-lg px-4 py-3 border border-border-default
             text-text-primary text-sm font-normal
             placeholder: text-text-tertiary
Focus:       border-border-focus (ring-2 ring-brand-default/20 on web; border only on native)
Error:       border-border-error, + text-status-error-text text-xs mt-1
Disabled:    bg-background-secondary text-text-disabled opacity-60
Helper text: text-text-tertiary text-xs mt-1
```

### 3.10 Quick Reply Pills

```
Container:   flex-row flex-wrap gap-2 px-4
Pill:        bg-surface-raised rounded-full px-4 py-2
             border border-border-default
             text-text-primary text-sm font-medium
Pressed:     bg-brand-subtle border-brand-default text-brand-text
Icon (opt):  Phosphor icon, size 16, mr-1, same colour as text
```

### 3.11 Text Bubble -- AI

```
Container:   bg-ai-bubble-assistant rounded-2xl rounded-bl-sm px-4 py-3
             max-w-[85%] self-start
Text:        text-text-primary text-sm leading-relaxed
Timestamp:   text-text-tertiary text-2xs mt-1
Avatar:      w-6 h-6 rounded-full bg-ai-avatar-bg items-center justify-center
             absolute -bottom-1 -left-3
             Icon: Phosphor Robot, size 14, text-ai-avatar-icon
```

### 3.12 Text Bubble -- User

```
Container:   bg-ai-bubble-user rounded-2xl rounded-br-sm px-4 py-3
             max-w-[85%] self-end
Text:        text-text-inverse text-sm leading-relaxed
Timestamp:   text-white/60 text-2xs mt-1
```

### 3.13 Typing Indicator

```
Container:   bg-background-secondary rounded-2xl rounded-bl-sm px-4 py-3
             max-w-[25%] self-start
Dots:        3x w-2 h-2 rounded-full bg-text-tertiary
             animated with staggered opacity pulse (300ms offset each)
```

### 3.14 Spending Breakdown Card

```
Container:   bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default
Title:       text-text-primary text-base font-semibold
Period:      text-text-tertiary text-xs ml-2
Bar chart:   h-40 mt-4 (use a charting lib or custom bars)
  Bar:       rounded-t-md, min-w-[24px], bg-brand-default
  Selected:  bg-brand-active
  Label:     text-text-tertiary text-2xs text-center mt-1
Category rows: flex-row items-center py-2 gap-3 mt-2
  Colour dot:w-3 h-3 rounded-full (category colour)
  Name:      text-text-primary text-sm flex-1
  Amount:    text-text-primary text-sm font-semibold tabular-nums
  Percent:   text-text-tertiary text-xs w-10 text-right
```

### 3.15 Loan Offer Card

```
Container:   bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default
Badge:       bg-brand-subtle text-brand-text rounded-full px-3 py-1 text-xs font-bold
             self-start mb-3
Title:       text-text-primary text-lg font-semibold
Amount:      text-text-primary text-3xl font-bold tabular-nums mt-1
APR row:     flex-row gap-4 mt-3
  Label:     text-text-tertiary text-xs uppercase tracking-widest font-extrabold
  Value:     text-text-primary text-sm font-semibold
Monthly:     Same pattern as APR row
CTA:         Primary button, full width, mt-4
Disclaimer:  text-text-tertiary text-2xs mt-2 text-center leading-relaxed
```

### 3.16 Loan Status Card

```
Container:   bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default
Status badge:
  Active:    bg-status-success-subtle text-status-success-text
  Pending:   bg-status-warning-subtle text-status-warning-text
  Overdue:   bg-status-error-subtle text-status-error-text
  Paid off:  bg-background-secondary text-text-secondary
             All: rounded-full px-3 py-1 text-xs font-bold
Title:       text-text-primary text-base font-semibold mt-3
Remaining:   text-text-primary text-2xl font-bold tabular-nums
Progress:    same as Pot progress bar pattern
Detail rows: Label/Value pairs (same as Confirmation Card rows)
Next payment:bg-background-secondary rounded-lg p-3 mt-3
  Label:     text-text-tertiary text-xs
  Amount:    text-text-primary text-base font-semibold
  Date:      text-text-secondary text-sm
```

### 3.17 Flex Options Card

```
Container:   bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default
Title:       text-text-primary text-base font-semibold mb-3
Option row:  flex-row items-center p-4 rounded-xl border border-border-default mb-2
  Selected:  border-brand-default bg-brand-subtle
Radio:       w-5 h-5 rounded-full border-2 border-border-strong
  Selected:  border-brand-default, inner circle w-3 h-3 bg-brand-default
Label:       text-text-primary text-sm font-medium ml-3 flex-1
Sublabel:    text-text-tertiary text-xs
Value:       text-text-primary text-sm font-semibold text-right tabular-nums
```

### 3.18 Credit Score Card

```
Container:   bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default items-center
Gauge:       w-40 h-40 (semi-circular arc, 180deg)
  Track:     stroke-background-tertiary, stroke-width 8
  Fill:      stroke colour by band:
             Excellent (>800): purple-500 (#A855F7)
             Good (700-799):   brand-default (#0EA5E9)
             Fair (600-699):   warning-default (#EAB308)
             Poor (<600):      status-error-default (#F43F5E)
Score:       text-text-primary text-4xl font-bold text-center (inside gauge)
Band label:  text-xs font-extrabold uppercase tracking-widest mt-2
             colour matches fill band
Out of:      text-text-tertiary text-sm mt-1
Last updated:text-text-tertiary text-2xs mt-3
```

### 3.19 Quote Card (International Transfer)

```
Container:   bg-surface-raised rounded-2xl p-6 shadow-sm border border-border-default
Flag pair:   flex-row items-center gap-2 mb-4
  Flag:      w-8 h-8 rounded-full overflow-hidden (flag image or emoji)
  Arrow:     Phosphor ArrowRight, size 16, text-text-tertiary
Send amount: text-text-primary text-2xl font-bold tabular-nums
Receive:     text-text-secondary text-lg tabular-nums mt-1
Rate row:    bg-background-secondary rounded-lg p-3 mt-3
  Label:     text-text-tertiary text-xs
  Rate:      text-text-primary text-sm font-semibold tabular-nums
Fee row:     Same pattern
  Free:      text-status-success-text font-semibold (when fee = 0)
Delivery:    text-text-secondary text-sm mt-2
  Icon:      Phosphor Clock, size 16, inline
CTA:         Primary button, full width, mt-4
```

### 3.20 Getting Started Checklist

```
Container:   bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default
Title:       text-text-primary text-base font-semibold
Progress:    text-text-tertiary text-xs mt-1 ("2 of 5 complete")
Steps:       mt-3
Step row:    flex-row items-center py-3 border-b border-border-default gap-3
  Done icon: Phosphor CheckCircle weight=fill, size 24, text-status-success-default
  Todo icon: Phosphor Circle weight=regular, size 24, text-border-strong
  Title:     text-text-primary text-sm font-medium (done: line-through text-text-tertiary)
  Chevron:   Phosphor CaretRight, size 16, text-text-tertiary (hidden when done)
```

### 3.21 Account Details Card

```
Container:   bg-surface-raised rounded-2xl p-5 shadow-sm border border-border-default
Header:      flex-row items-center gap-3
  Logo:      w-10 h-10 rounded-full bg-brand-subtle items-center justify-center
             Phosphor Bank, size 20, text-brand-default
  Name:      text-text-primary text-base font-semibold
  Type:      text-text-tertiary text-xs
Detail rows: py-3 border-b border-border-default
  Label:     text-text-tertiary text-xs uppercase tracking-widest font-extrabold
  Value:     text-text-primary text-sm font-mono tabular-nums mt-0.5
  Copy btn:  Phosphor Copy, size 16, text-text-tertiary, absolute right-0
             active:opacity pressed:text-brand-default
Sort code:   formatted as XX-XX-XX with dashes
Account no:  8 digits, spaces optional
IBAN:        grouped in blocks of 4
```

---

## 4. Button System

Four variants. All use `rounded-lg` (8px), `font-semibold`, `text-sm`.

| Variant     | Classes                                                                                     |
|-------------|---------------------------------------------------------------------------------------------|
| Primary     | `bg-brand-default active:bg-brand-active text-text-inverse px-6 py-3 rounded-lg font-semibold text-sm` |
| Secondary   | `bg-background-primary border border-border-strong active:bg-background-secondary text-text-primary px-6 py-3 rounded-lg font-semibold text-sm` |
| Ghost       | `bg-transparent active:bg-background-secondary text-text-primary px-6 py-3 rounded-lg font-semibold text-sm` |
| Destructive | `bg-status-error-default active:bg-status-error-text text-text-inverse px-6 py-3 rounded-lg font-semibold text-sm` |

**Sizes:**

| Size   | Height | Padding            | Font     |
|--------|--------|--------------------|----------|
| sm     | h-9    | px-4 py-2          | text-xs  |
| md     | h-11   | px-6 py-3          | text-sm  |
| lg     | h-14   | px-8 py-4          | text-base|

**Full-width:** Add `w-full` when the button is the sole CTA in a card or bottom area.

**Disabled state:** Add `opacity-50` and remove `active:` modifiers. Do not change colours.

**Icon buttons:** Square, same height as text button, no label. `items-center justify-center aspect-square`.

---

## 5. Layout Patterns

### 5.1 Screen Structure

```
SafeAreaView    bg-background-primary flex-1
  StatusBar     light-content (dark) / dark-content (light)
  Header        h-14 px-4 flex-row items-center justify-between
                border-b border-border-default (optional)
    Back:       Phosphor CaretLeft, size 24, text-text-primary, pl-0
    Title:      text-text-primary text-base font-semibold text-center flex-1
    Right:      icon button or empty spacer w-6
  Content       flex-1 (ScrollView or FlatList)
    Top pad:    pt-4
    Side pad:   px-4
    Bottom pad: pb-8 (above any bottom bar)
  Bottom bar    px-4 pb-6 pt-3 bg-surface-raised border-t border-border-default
                (for sticky CTAs or input bar)
```

### 5.2 Chat Screen Layout

```
FlatList        flex-1 px-4 pt-2
  inverted      (newest messages at bottom)
  Card gap:     mb-3 between messages
  AI bubble:    self-start, max-w-[85%]
  User bubble:  self-end, max-w-[85%]
  Card in chat: self-start, w-full (cards span full width minus px-4)
Input bar:      px-4 pb-6 pt-3 bg-surface-raised border-t border-border-default
  Input:        flex-1 bg-background-secondary rounded-full px-4 py-3 text-sm
  Send btn:     w-10 h-10 rounded-full bg-brand-default items-center justify-center ml-2
                Phosphor PaperPlaneTilt weight=fill, size 20, text-text-inverse
  Mic btn:      same shape, bg-transparent, Phosphor Microphone, text-text-secondary
```

### 5.3 Card Spacing

- Between cards in a scrollable list: `mb-3` (12px)
- Between cards inside a chat flow: `mb-3` (12px)
- Inner card padding: `p-5` (20px) for compact cards, `p-6` (24px) for detail cards
- Card section dividers: `border-b border-border-default` with `py-3` rows

### 5.4 List Items

- Standard row height: `py-3` (12px top/bottom) = ~48px total with content
- Dense row height: `py-2` (8px) = ~40px
- Row horizontal padding: `px-4` (16px)
- Left icon/avatar: `w-10 h-10` with `mr-3`
- Separator: `border-b border-border-default` (inset from left by 52px using `ml-[52px]`)

### 5.5 Form Field Spacing

- Between fields: `mb-4` (16px)
- Label to field: `mb-2` (8px)
- Field to helper/error text: `mt-1` (4px)
- Form section spacing: `mb-6` (24px)
- CTA below form: `mt-6` (24px)

### 5.6 Bottom Sheet

```
Overlay:     bg-overlay/50 (use opacity modifier; --color-overlay stores RGB triplet 0 0 0)
Sheet:       bg-surface-raised rounded-t-3xl
Handle:      w-10 h-1 rounded-full bg-border-default self-center mt-3
Content:     px-4 pt-4 pb-8
Max height:  90% of screen
```

---

## 6. Iconography

### Library

Use **Phosphor Icons** (`phosphor-react-native`). Default weight: `regular`. Use `fill` weight for selected/active states and status icons (CheckCircle, WarningCircle).

### Sizes by Context

| Context               | Size | Tailwind        |
|-----------------------|------|-----------------|
| Tab bar               | 24px | `w-6 h-6`      |
| List item leading     | 20px | `w-5 h-5`      |
| Card leading icon     | 24px | `w-6 h-6`      |
| In-button icon        | 20px | `w-5 h-5`      |
| Inline with text      | 16px | `w-4 h-4`      |
| Status hero (success) | 48px | `w-12 h-12`    |
| Small badge/indicator | 12px | `w-3 h-3`      |
| Header back/close     | 24px | `w-6 h-6`      |

### Colour Rules

- Default: `text-text-secondary`
- Active/selected tab: `text-brand-default`
- Destructive action: `text-status-error-default`
- Success confirmation: `text-status-success-default`
- On primary button: `text-text-inverse`
- Disabled: `text-text-disabled`

---

## 7. Typography Quick Reference

Use Inter for all text. NativeWind class mapping:

| Style              | Classes                                           | Use for                       |
|--------------------|---------------------------------------------------|-------------------------------|
| Page title         | `text-2xl font-bold`                              | Screen headers                |
| Section heading    | `text-lg font-semibold`                           | Card titles, section labels   |
| Card title         | `text-base font-semibold`                         | Compact card headers          |
| Body               | `text-sm font-normal leading-relaxed`             | Paragraphs, descriptions      |
| Body strong        | `text-sm font-semibold`                           | Emphasised body text          |
| Caption            | `text-xs font-normal`                             | Timestamps, helper text       |
| Micro              | `text-[10px] font-normal`                         | Legal, footnotes              |
| Label / overline   | `text-xs font-extrabold uppercase tracking-widest`| Field labels, category labels |
| Large amount       | `text-4xl font-bold tabular-nums`                 | Balance display               |
| Medium amount      | `text-2xl font-bold tabular-nums`                 | Card amounts                  |
| Small amount       | `text-sm font-semibold tabular-nums`              | Transaction amounts           |

**Always use `tabular-nums` for monetary values** -- this ensures digits align in lists.

---

## 8. Monetary Formatting

- Currency symbol: always `GBP` prefix as pound sign
- Thousands separator: comma (1,234.56)
- Pence: always 2 decimal places, never truncate
- Positive amounts (income): prefix with `+`, colour `text-money-positive`
- Negative amounts (spending): no prefix (or `-`), colour `text-money-negative` (= text-primary; debit is normal, not red)
- Pending amounts: colour `text-money-pending`, italic
- Large hero balances: split pounds and pence visually (pounds in text-4xl, pence in text-xl)

---

## 9. State Patterns

### 9.1 Loading -- Skeleton Screens

```
Bone:        bg-background-tertiary rounded-md animate-pulse
Text line:   h-4 w-3/4 rounded-md (vary widths: w-1/2, w-full, w-2/3)
Amount:      h-8 w-32 rounded-md
Avatar:      w-10 h-10 rounded-full
Card:        h-40 w-full rounded-2xl
```

Always show skeletons matching the expected layout. Never show a blank screen or a spinner alone for data-loading states. A spinner (`ActivityIndicator`) is acceptable only for action confirmation (e.g., "Sending payment...").

### 9.2 Empty State

```
Container:   flex-1 items-center justify-center px-8
Illustration:max-w-[200px] max-h-[200px] (SVG or Lottie, muted brand colours)
Title:       text-text-primary text-lg font-semibold text-center mt-6
Message:     text-text-secondary text-sm text-center mt-2 leading-relaxed
CTA:         Primary button, mt-6 (if there is an action to take)
```

### 9.3 Error State

Three tiers:
1. **Inline** -- beneath a form field: `text-status-error-text text-xs mt-1` + `border-border-error` on field
2. **Toast** -- top of screen, auto-dismiss 4s: `bg-status-error-subtle border border-status-error-default rounded-xl mx-4 p-4 flex-row gap-3`
3. **Full card** -- see Error Card (3.6) for unrecoverable errors shown in chat

### 9.4 Success State

- In-chat: Success Card (3.5) appears as an AI bubble
- Full-screen: centred CheckCircle hero + title + message + CTA to go home
- Toast variant: same pattern as error toast but with `bg-status-success-subtle border-status-success-default`

---

## 10. Colour Usage by Banking Domain

| Domain                  | Primary colour           | Semantic token                |
|-------------------------|--------------------------|-------------------------------|
| Money in / income       | Green #10B981            | status-success-default        |
| Money out / spending    | Default text (not red)   | money-negative (= text-primary) |
| Declined / failed       | Rose #F43F5E             | status-error-default          |
| Pending / processing    | Yellow #EAB308           | money-pending                 |
| Info / notifications    | Blue #3B82F6             | status-info-default           |
| AI assistant accent     | Indigo #818CF8           | ai-avatar-icon / ai-avatar-bg |
| Credit score excellent  | Green #10B981            | score-excellent               |
| Brand accent            | Sky blue #0EA5E9         | brand-default                 |

---

## 11. Do / Don't Reference

### DO: Use semantic tokens, not hex values
```tsx
// Good
className="bg-surface-raised text-text-primary"

// Bad
className="bg-white text-[#0F172A]"
```

### DON'T: Fill large areas with brand blue
The brand colour is an accent. Cards, screens, and headers should be white/gray surfaces. Use `bg-brand-default` only for buttons, small highlights, and the user chat bubble.

### DO: Add `tabular-nums` to all monetary values
Without this, digits jump horizontally as amounts change. Every `Text` component displaying money must include `tabular-nums`.

### DON'T: Use red for negative spending amounts
Outgoing transactions use `text-text-primary`. Red (`status-error`) is reserved for errors, declines, and destructive actions only. Positive income uses green.

### DO: Round corners consistently
Cards = `rounded-2xl` (or `rounded-3xl` for hero cards). Buttons and inputs = `rounded-lg`. Pills and badges = `rounded-full`. Never use sharp corners.

### DON'T: Stack cards without spacing
Always maintain `mb-3` (12px) between adjacent cards. Cramped layouts destroy the airy feel.

### DO: Use skeleton screens for loading
Match the skeleton layout to the real content structure. Show 3 skeleton transaction rows when loading transactions, not a centred spinner.

### DON'T: Put multiple primary buttons in one view
Each screen/card gets at most one primary (filled brand) button. Secondary actions use secondary or ghost variants. If two equally weighted actions exist, use two secondary buttons.

### DO: Maintain consistent icon weight
Default to `regular` weight. Switch to `fill` only for active/selected states (tab bar, status heroes). Never mix weights in the same row.

### DON'T: Make text smaller than 10px
The smallest permitted size is `text-[10px]` (micro), used only for legal disclaimers. Body text should never go below `text-xs` (12px). Prefer `text-sm` (14px) as the default reading size.

---

## 12. Animation Guidelines

Keep animations subtle and functional. This is a banking app -- trust is paramount.

| Element           | Animation                                    | Duration |
|-------------------|----------------------------------------------|----------|
| Card enter        | fadeIn + translateY(8 -> 0)                   | 200ms    |
| Card press        | scale(0.98) + opacity(0.9)                   | 100ms    |
| Skeleton shimmer  | opacity pulse (0.4 -> 1.0 -> 0.4)            | 1500ms   |
| Typing dots       | opacity stagger (3 dots, 300ms offset)        | 900ms    |
| Toast enter       | translateY(-100 -> 0) + fadeIn               | 250ms    |
| Toast exit        | translateY(0 -> -100) + fadeOut              | 200ms    |
| Bottom sheet      | translateY(full -> 0) + overlay fadeIn        | 300ms    |
| Tab switch        | crossfade                                     | 150ms    |
| Balance counter   | animated number roll (on first load only)     | 400ms    |

Use `react-native-reanimated` for shared-element transitions and layout animations. Use `Animated` API or `reanimated` for the patterns above. Avoid `LayoutAnimation` on Android (unreliable).

---

## 13. Accessibility Checklist

- Minimum touch target: 44x44px (`min-h-[44px] min-w-[44px]`)
- Colour contrast: all text on its background must meet WCAG AA (4.5:1 for body, 3:1 for large text). The token system is designed to satisfy this in both light and dark modes.
- `accessibilityLabel` on all icon-only buttons
- `accessibilityRole="button"` on all pressable elements
- `accessibilityRole="header"` on screen titles
- Monetary amounts: read as "forty-two pounds and fifty pence", not "42.50"
- Status badges: include status in label ("Payment status: pending")
- Skeleton screens: set `accessibilityLabel="Loading"` and `accessibilityElementsHidden={true}`
- Reduce motion: respect `useReducedMotion()` from reanimated; skip non-essential animations

---

## 14. File / Import Conventions

```tsx
// Icons -- always import individually, never the whole set
import { CaretLeft, CheckCircle, Bank } from 'phosphor-react-native';

// Runtime tokens for JS-only contexts (navigation headers, charts, gauges)
import { useTokens } from '@/theme/tokens';
// const t = useTokens();
// t.brand.default => '#0EA5E9' (light) / '#38BDF8' (dark)
// Prefer Tailwind classes for all standard UI.
```

---

---

## 15. React Native / NativeWind Gotchas

These are known issues specific to NativeWind v4 on React Native. Follow these rules to avoid silent failures.

### 15.1 No Nested CSS Variable References
NativeWind does not resolve nested `var()` references. All semantic tokens in `global.css` MUST be flattened to literal RGB triplets. If you add a new token, write `--color-my-token: 14 165 233;` NOT `--color-my-token: var(--color-brand-50);`.

### 15.2 Shadows
React Native does not support CSS `box-shadow` syntax. Use only Tailwind's built-in shadow utilities (`shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`). NativeWind translates these to RN's `shadowColor`/`shadowOffset`/`shadowRadius`/`elevation` automatically. Do NOT define custom `boxShadow` values.

### 15.3 `tabular-nums` May Not Work
`font-variant-numeric: tabular-nums` is not natively supported in React Native. If numbers do not align in transaction lists, use a monospace font for numeric values or fixed-width formatting. Test this early on both platforms.

### 15.4 `animate-pulse` for Skeletons
NativeWind v4 has limited animation support. If `animate-pulse` does not work for skeleton screens, implement a Reanimated-based opacity loop instead. See section 12 for animation patterns.

### 15.5 Percentage Widths
`max-w-[85%]` on chat bubbles works only if the parent has a defined width. In a `FlatList`, this should work because the list takes full width, but verify early.

### 15.6 Navigation Headers Require JS Colors
`headerStyle`, `headerTintColor`, and `contentStyle` on `<Stack.Screen>` accept only JS color strings, not Tailwind classes. Use the `useTokens()` hook from `@/theme/tokens` for these.

### 15.7 Overlay Opacity
The overlay color uses the same RGB triplet pattern as all other colors. Use `bg-overlay/50` (50% opacity) or `bg-overlay/65` (65% for dark mode feel) -- the opacity modifier replaces the old `rgba()` approach.

### 15.8 Font Loading
Inter is not bundled with React Native. The app loads Inter weights via `@expo-google-fonts/inter` in `_layout.tsx`. The splash screen stays visible until fonts are loaded. If you add new font weights, add them to the `useFonts` call in `_layout.tsx`.

*End of Agent Design Instructions. For token source files, see `tokens/primitives.json`, `tokens/semantic.json`, and `tokens/components.json` in this directory.*
