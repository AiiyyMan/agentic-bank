# UI Kit & Component Library Research for Agentic Banking App

**Date:** 2026-03-03
**Focus:** React Native UI kits for a digital banking app with both traditional banking screens AND a chat/conversational agentic interface.

---

## RECOMMENDATION (TL;DR)

**Recommended stack for a solo builder building a POC fast:**

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Design Reference** | UI8: **Finora** ($-range, 100+ screens) or **tmrw.bank** (99+ screens) | Use as Figma design reference, not direct code. Covered by UI8 subscription. |
| **Component Library** | **Gluestack UI v3** + **NativeWind v4** | Unbundled (copy-paste components), Expo-native, Tailwind-based, accessible. Enterprise-grade without vendor lock-in. NativeBase successor. |
| **Chat UI** | **react-native-gifted-chat** (customized) | Free, extensible via `renderCustomView`, proven at scale. Build custom message types (tool confirmations, rich cards) on top. |
| **AI Chat Protocol** | **Vercel AI SDK** `useChat` + custom message renderers | Handles streaming, tool calls, structured responses. Pair with gifted-chat for rendering. |
| **Charts** | **Victory Native XL** | Skia-powered, performant, Expo-compatible. Line/bar/pie for spending analytics. |
| **Styling** | **NativeWind v4** (Tailwind CSS for RN) | Rapid prototyping, consistent with web Tailwind knowledge. |

**Strategy: Buy a UI8 Figma kit as design reference + build with open-source component libraries.** Do NOT try to use a Figma kit's code directly -- they are design assets, not production code. The CodeCanyon React Native templates (like BankuX or Finova) are closer to usable code but often have poor architecture and outdated dependencies. Better to use them as screen-by-screen reference and build clean.

**Estimated setup time:** 2-3 days for base component library + styling + chat skeleton.

---

## 1. UI8 Banking/Fintech Kits

UI8 kits are **Figma-only design assets** (no React Native code). They are valuable as design reference and screen inspiration, especially with a UI8 subscription that reduces/eliminates per-kit costs.

### Top Picks

#### Finora Fintech App UI Kit
- **URL:** https://ui8.net/uzenic/products/finora-fintech-app-ui-asset
- **Screens:** 100+ unique screens, light AND dark mode
- **Format:** Figma
- **Categories:** Onboarding, authentication, dashboard, transactions, budgeting & goals, cards & wallet, payment with scanner, send money, convert, and more
- **Quality:** Pixel-perfect, auto layout, global style guide & typography
- **Best for:** Comprehensive coverage of banking flows
- **Chat screens:** Not explicitly mentioned -- would need to supplement

#### tmrw.bank - Smart Banking UI Kit
- **URL:** https://ui8.net/tmrw/products/tmrw-smart-banking-ui-kit
- **Screens:** 99+ unique screens
- **Format:** Figma
- **Platforms:** iOS and Android designs
- **Focus:** Banking, wallet management, budget planning
- **From:** tmrw design studio (also makes Firstech kit)
- **Quality:** Clean, detailed, professional aesthetic

#### Werolla - Mobile Banking UI Kit
- **URL:** https://ui8.net/rifat-sarkar/products/werolla-mobile-app-ui-kit-for-wallet-finance--banking-app
- **Screens:** 92 UI screens (46 per theme, dark + light)
- **Format:** Figma
- **Focus:** Digital wallet, money management, income/expense tracking
- **Note:** Also has a Flutter implementation on CodeCanyon (separate purchase)

#### Firstech - Fintech App UI Kit
- **URL:** https://ui8.net/tmrw/products/firstech---fintech-app-ui-kit
- **Screens:** 30+ modern screens
- **Format:** Figma
- **From:** tmrw design studio
- **Note:** Smaller kit, good if you want minimal starting point

### Other Notable UI8 Kits

| Kit | Screens | Notes |
|-----|---------|-------|
| Twinkle FinTech Mobile App UI KIT | 60+ | General fintech/transactions |
| Cashly Fintech UI Kit | Unknown | Clean fintech aesthetic |
| Finix - Fintech Mobile App | Unknown | Mobile-first fintech |
| Bankoo - Banking Mobile App | 45 | Clean, modern |
| FastMobile - Banking app | Unknown | Banking focus |
| MoBank - Banking App | Unknown | Banking focus |

### AI Chat UI Kits on UI8 (for chat interface reference)

These are separate from banking kits but useful for the conversational interface:

| Kit | URL | Notes |
|-----|-----|-------|
| **Aurenix - AI Chat App UI Kit** | https://ui8.net/wrteam-design/products/aurenix--ai-chat-app-ui-kit | 34+ screens, dark mode, AI chat focused |
| ChattyAI - AI Chatbot App UI Kit | https://ui8.net/munirsr/products/chattyai | AI chatbot screens |
| Chatify - AI Chatbot App UI Kit | https://ui8.net/munirsr/products/chatify---ai-chatbot-app-ui-kit | AI chatbot screens |
| ChatCore - AI Chat BOT App UI KIT | https://ui8.net/heloxone/products/chatcore---ai-chat-bot-app-ui-kit | Chatbot UI |
| Brainwave - AI UI Kit | https://ui8.net/ui8/products/brainwave-ai-ui-design-kit | Broader AI UI |

**Recommendation:** Get **Finora** (banking screens) + **Aurenix** (AI chat screens) from UI8 as Figma design references. Together they cover both halves of the app.

---

## 2. Open-Source React Native UI Libraries

### Comparison Matrix

| Library | Expo Support | Styling | Accessibility | Customization | Maintenance | Best For |
|---------|-------------|---------|---------------|---------------|-------------|----------|
| **Gluestack UI v3** | Full | NativeWind/Tailwind | Excellent (react-native-aria) | Copy-paste components | Active (NativeBase successor) | Enterprise fintech |
| **Tamagui** | Full | Optimizing compiler | Good | Theme system | Active | Performance-critical |
| **React Native Paper** | Full | Material Design | Good | Limited to MD spec | Active | Material Design apps |
| **NativeBase** | Legacy | Custom | Good | Theme system | **Deprecated** | Nothing (migrate to Gluestack) |

### Detailed Assessment

#### Gluestack UI v3 (RECOMMENDED)

- **Why for fintech:** Unbundled architecture means you copy components into your project and own them completely. No vendor lock-in. Enterprise-grade accessibility with focus trapping, screen reader support (VoiceOver, TalkBack).
- **Styling:** NativeWind (Tailwind CSS) integration via utility classes. Familiar if you know Tailwind.
- **Architecture:** "Source-to-destination" -- only import what you use, minimal bundle size.
- **Expo:** Full compatibility with Expo SDK 52/53 and New Architecture (Fabric + TurboModules).
- **Key advantage for solo builder:** Copy-paste approach means you understand every line of code. No magic. Easy to customize for banking brand colors and typography.
- **Community:** Successor to NativeBase (which had a large community). Backed by a funded company.

#### Tamagui

- **Why for fintech:** Optimizing compiler generates atomic CSS at build time, flattening the component tree. 60 FPS performance even on complex dashboards.
- **Downside:** Significantly more complex setup. The compiler and architecture require dedicated effort. Potentially overkill for a POC where development speed matters more than runtime micro-optimization.
- **Expo:** Full compatibility.
- **Best for:** Teams with existing Tamagui experience, or apps where animation/transition performance is the top priority.

#### React Native Paper

- **Why NOT for fintech:** Locks you into Material Design aesthetic. Banking apps typically want a custom, premium feel -- not Google's design language. Limited customization beyond MD spec.
- **When to use:** If you explicitly want a Material Design banking app (rare).

#### NativeBase

- **Status:** Deprecated. Migrate to Gluestack UI v3.

### Verdict

**Gluestack UI v3 + NativeWind v4** is the best choice for a solo builder creating a fintech POC:
- Fastest to productive UI (Tailwind utility classes)
- Full control over components (copy-paste, not black box)
- Excellent accessibility out of the box (regulatory requirement for fintech)
- Active maintenance trajectory

---

## 3. Chat UI Components for React Native

This is the most critical decision for the "agentic" half of the app. The chat interface needs to support:
- Standard text messages (user <-> AI agent)
- **Tool call confirmations** ("I'm about to transfer $500 to John. Confirm?")
- **Rich cards** (account summary cards, transaction receipts, mini-charts)
- **Structured responses** (tables, lists, formatted data)
- **Streaming** (token-by-token response rendering)
- **Action buttons** within messages (Approve / Decline / Edit)

### Options Evaluated

#### react-native-gifted-chat (RECOMMENDED for base)
- **GitHub:** https://github.com/FaridSafi/react-native-gifted-chat
- **Status:** Most popular RN chat UI. Still maintained as of 2026 but has some Expo SDK 52/53 compatibility issues to watch.
- **Key extensibility points:**
  - `renderCustomView` -- render arbitrary React components inside message bubbles
  - `isCustomViewBottom` -- control positioning of custom content
  - `renderMessageAudio` -- custom audio rendering
  - `onPressMessage` / `onLongPressMessage` -- interaction handlers
  - Custom message types via `renderMessage` override
- **Agentic capabilities:** You would build custom message components for tool confirmations, rich cards, and action buttons using `renderCustomView` and `renderMessage`. The library provides the chat scaffold (message list, input, timestamps, avatars); you provide the custom bubble content.
- **Concern:** Some users report compatibility issues with FlashList dependency in Expo SDK 51+. May need version pinning or patches.

#### Stream Chat React Native
- **URL:** https://getstream.io/chat/docs/sdk/react/
- **Pros:** Enterprise-grade, built-in AI agent support via Stream Chat AI SDK. Handles streaming, markdown, code blocks, tables. Type-safe.
- **Cons:** Requires Stream backend service (paid). Adds significant dependency. Overkill for a POC where you control the backend.
- **AI Features:** AgentPlatform enum, tool call execution loops, partial message updates for streaming UI.
- **Verdict:** Consider for production, but too heavy for POC phase.

#### CometChat React Native
- **URL:** https://www.cometchat.com/react-native-chat-ui-kit
- **Pros:** Pre-built components and UI elements. Good documentation.
- **Cons:** Paid service dependency. Not designed for agentic AI chat patterns.

#### assistant-ui
- **URL:** https://www.assistant-ui.com/
- **Focus:** React (web) library for AI chat interfaces. The most popular UI library for building AI chat on web.
- **React Native support:** None confirmed. Web-only as of March 2026.
- **Relevance:** Study its patterns (tool confirmations, generative UI, reasoning displays) and replicate in React Native.

#### Build from Scratch with Gluestack
- **Approach:** Use FlatList + Gluestack UI components to build a chat interface from scratch.
- **Pros:** Total control, no dependency issues, matches your component library.
- **Cons:** Significant effort for basics (keyboard avoidance, scroll-to-bottom, input management, typing indicators).
- **Verdict:** Not recommended for POC. Use gifted-chat as base and customize.

### Recommended Chat Architecture

```
Layer 1: Vercel AI SDK (useChat hook)
  - Handles streaming, tool calls, message state
  - Provides onToolCall callbacks for confirmation flow

Layer 2: react-native-gifted-chat (scaffolding)
  - Message list rendering, input bar, scroll behavior
  - Keyboard handling, avatars, timestamps

Layer 3: Custom message renderers (your code)
  - ToolConfirmationCard: "Transfer $500?" [Approve] [Decline]
  - AccountSummaryCard: Balance, recent transactions mini-list
  - TransactionReceiptCard: Formatted receipt after completion
  - ChartCard: Spending breakdown (Victory Native)
  - ThinkingIndicator: Animated dots during agent processing
  - ErrorCard: "Something went wrong" with retry button
```

---

## 4. Banking-Specific UI Patterns & Components

### Transaction Lists

- **Pattern:** `FlatList` with virtualization (critical for performance with 100s of transactions)
- **Key optimizations:**
  - `getItemLayout` for fixed-height rows (avoids per-item measurement)
  - `removeClippedSubviews={true}` on Android for memory savings
  - Avoid inline functions in `renderItem`
  - `SectionList` for date-grouped transactions (Today, Yesterday, This Week, etc.)
  - `ItemSeparatorComponent` for clean dividers
- **Design pattern:** Each transaction row shows: icon/category, merchant name, date/time, amount (green for credit, red for debit), running balance (optional)

### Balance Display / Account Cards

- **Pattern:** Horizontal `FlatList` or `ScrollView` with snap for multiple accounts
- **Components needed:**
  - Large balance text with currency formatting
  - Account type label (Checking, Savings, Credit)
  - Last 4 digits of account number
  - Quick action buttons (Send, Request, Pay)
- **Implementation:** Gluestack UI `Card` component + custom styling

### Payment Flow Screens

- **Typical flow:** Select recipient -> Enter amount -> Review -> Confirm (biometric/PIN) -> Success
- **Components needed:**
  - Contact picker / search
  - Amount input with currency formatting (large centered number)
  - Review summary card
  - Biometric prompt integration (`expo-local-authentication`)
  - Success animation (Lottie or Reanimated)

### Charts & Graphs (Spending Analytics)

#### Victory Native XL (RECOMMENDED)
- **GitHub:** https://github.com/FormidableLabs/victory-native-xl
- **Powered by:** D3 + Skia + Reanimated
- **Chart types:** Line, bar, pie, area -- all needed for spending analytics
- **Expo compatibility:** Works with Expo, requires `@shopify/react-native-skia` and `react-native-reanimated` as peer dependencies
- **Concern:** Compatibility issue between victory-native v41 and `@shopify/react-native-skia` v2 (needed for Expo SDK 53). Monitor the GitHub issue tracker for resolution.
- **Use cases:**
  - Monthly spending trend (line chart)
  - Category breakdown (pie/donut chart)
  - Income vs expenses (grouped bar chart)
  - Account balance over time (area chart)

#### Alternatives

| Library | Pros | Cons |
|---------|------|------|
| react-native-chart-kit | Simple API, lightweight | Less customizable, older |
| react-native-echarts | Full ECharts power | WebView-based, heavier |
| react-native-svg-charts | SVG-based, flexible | Less maintained |
| react-native-wagmi-charts | Designed for financial data | Focused on stock/crypto candles |

### Loan/Credit Display Components

- **Credit score gauge:** Build with react-native-svg (arc/gauge visualization) or Victory Native pie chart. Pattern: colored arc from red (300) to green (850) with needle indicator.
- **Loan progress bar:** Linear progress component from Gluestack UI + labels for principal paid / remaining.
- **EMI calculator:** Custom component with sliders (loan amount, tenure, interest rate) and computed monthly payment display.
- **Amortization table:** SectionList with monthly breakdown rows.

### Additional Useful Libraries

| Library | Purpose |
|---------|---------|
| `react-native-reanimated` | Smooth animations for transitions, card flips, pull-to-refresh |
| `expo-local-authentication` | Biometric auth (Face ID, fingerprint) for transaction confirmation |
| `react-native-svg` | Custom graphics, gauges, illustrations |
| `lottie-react-native` | Pre-built animations (success checkmarks, loading states) |
| `react-native-masked-text` | Currency input formatting, card number masking |
| `expo-haptics` | Tactile feedback on confirmations |

---

## 5. CodeCanyon React Native Banking Templates (Alternative to UI8)

These are **actual React Native code** (not just Figma designs), which makes them tempting but risky.

### Top Coded Templates

#### BankuX - Banking React Native Expo App UI Kit
- **URL:** https://codecanyon.net/item/bankux-banking-react-native-expo-app-ui-kit/56625378
- **Screens:** 79+ professionally designed
- **Stack:** React Native Expo + NativeWind
- **Features:** Multi-step auth, OTP verification, transaction history, money insights, QR payments, dark/light mode, chart visualizations
- **Pros:** NativeWind-based (aligns with Gluestack recommendation), substantial screen count
- **Cons:** UI-only template (no backend), code quality unknown, may use outdated Expo SDK

#### Finova - Finance, Banking & Online Payment
- **URL:** https://codecanyon.net/item/finova-finance-banking-online-payment-react-native-expo-app-ui-kit/56905577
- **Screens:** 400+ user screens (claimed)
- **Stack:** React Native Expo
- **Features:** 2 premium app templates, onboarding, auth flows, account setup, contacts, banks/cards, payment methods, subscriptions
- **Pros:** Massive screen library
- **Cons:** 400 screens likely means lots of repetitive variants. Code quality concerns at this volume.

#### Bankify - Banking, Crypto & Expense
- **URL:** https://codecanyon.net/item/bankify-banking-crypto-expense-app-template-react-native/60230007
- **Stack:** React Native Expo & CLI
- **Features:** 2-in-1 template covering banking + crypto + expense tracking

#### Minance - Finance & Bank Management
- **URL:** https://codecanyon.net/item/minance-finance-bank-management-react-native-expo-app-ui-kit/57926599
- **Screens:** 87 user screens
- **Stack:** React Native Expo

### CodeCanyon Template Verdict

**Not recommended as primary approach.** Reasons:
1. Code quality is inconsistent (often spaghetti, no TypeScript, poor state management)
2. Dependency versions are usually outdated within months of purchase
3. Architecture decisions baked in are hard to undo
4. None include agentic chat UI -- you'd still need to build that separately
5. License restrictions may complicate commercial use

**Acceptable use:** Buy one (BankuX at ~$29 is low risk) as a **screen-by-screen code reference** alongside the Figma kits. Extract specific patterns (e.g., how they laid out a transaction detail screen) rather than using the template as a starting point.

---

## 6. Recommended Approach: Detailed Build Plan

### Phase 1: Foundation (Day 1-2)

```
expo init agentic-bank --template expo-template-blank-typescript
```

Install core stack:
- Gluestack UI v3 (copy components into project)
- NativeWind v4 (Tailwind styling)
- Expo Router (file-based navigation)
- react-native-reanimated
- react-native-svg

### Phase 2: Design System (Day 2-3)

Using Finora (UI8) as Figma reference:
- Define color tokens (primary, success, danger, neutral scales)
- Typography scale (headings, body, captions, amounts)
- Spacing/sizing tokens
- Component variants (cards, buttons, inputs, badges)
- Dark mode support from day one

### Phase 3: Banking Screens (Day 3-7)

Build core screens using Gluestack components + NativeWind:
1. Dashboard / Home (balance cards, quick actions, recent transactions)
2. Transaction list (SectionList, date grouping, search/filter)
3. Transaction detail
4. Send money flow (recipient -> amount -> review -> confirm -> success)
5. Account overview / settings
6. Spending analytics (Victory Native XL charts)

### Phase 4: Chat Interface (Day 7-10)

Using Aurenix (UI8) as Figma reference for chat aesthetics:
1. Install react-native-gifted-chat
2. Build custom message renderers:
   - `ToolConfirmationMessage` (action buttons)
   - `AccountCardMessage` (embedded balance/account info)
   - `TransactionCardMessage` (receipt display)
   - `ChartMessage` (embedded mini-chart)
   - `ThinkingMessage` (streaming indicator)
3. Integrate Vercel AI SDK `useChat` for agent communication
4. Wire tool call confirmations to banking actions

### Phase 5: Polish (Day 10-12)

- Animations and transitions (Reanimated)
- Haptic feedback (expo-haptics)
- Biometric auth gates (expo-local-authentication)
- Loading states and error handling
- Responsive adjustments

### Total estimated POC time: 10-12 days for a solo builder

---

## 7. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| victory-native-xl Skia v2 incompatibility with Expo SDK 53 | Charts broken on latest Expo | Pin to Expo SDK 52 or use react-native-chart-kit as fallback |
| react-native-gifted-chat compatibility issues with Expo 52+ | Chat UI broken | Fork and patch, or fall back to custom FlatList-based chat |
| Gluestack UI v3 learning curve | Slower initial development | Spend Day 1 on Gluestack tutorials; copy-paste approach means less magic to debug |
| NativeWind v4 -> v5 migration | Breaking changes mid-project | Pin NativeWind v4; migrate to v5 post-POC |
| UI8 kit design not matching component library capabilities | Design-code gap | Treat Figma as inspiration, not pixel-perfect spec. Adapt to what Gluestack provides. |

---

## Sources

### UI8 Kits
- [Finora Fintech App UI Kit](https://ui8.net/uzenic/products/finora-fintech-app-ui-asset)
- [tmrw.bank Smart Banking UI Kit](https://ui8.net/tmrw/products/tmrw-smart-banking-ui-kit)
- [Werolla Mobile Banking UI Kit](https://ui8.net/rifat-sarkar/products/werolla-mobile-app-ui-kit-for-wallet-finance--banking-app)
- [Firstech Fintech App UI Kit](https://ui8.net/tmrw/products/firstech---fintech-app-ui-kit)
- [Aurenix AI Chat App UI Kit](https://ui8.net/wrteam-design/products/aurenix--ai-chat-app-ui-kit)
- [Twinkle FinTech Mobile App UI KIT](https://ui8.net/twinkle-creative-digital-agency/products/banking-mobile-app-ui-kit)

### Component Libraries
- [Gluestack UI](https://gluestack.io/)
- [Tamagui](https://tamagui.dev/)
- [React Native Paper](https://reactnativepaper.com/)
- [NativeWind](https://www.nativewind.dev/)
- [LogRocket: 10 Best React Native UI Libraries 2026](https://blog.logrocket.com/best-react-native-ui-component-libraries/)
- [Kellton: 15 Best RN UI Libraries 2026](https://www.kellton.com/kellton-tech-blog/15-best-react-native-ui-libraries-dominating-mobile-app-development)

### Chat UI
- [react-native-gifted-chat](https://github.com/FaridSafi/react-native-gifted-chat)
- [Stream Chat React Native](https://getstream.io/chat/docs/sdk/react/)
- [assistant-ui](https://www.assistant-ui.com/)
- [CometChat React Native](https://www.cometchat.com/react-native-chat-ui-kit)
- [Build AI Assistant with React Native (Stream)](https://getstream.io/blog/react-native-assistant/)

### Charts
- [Victory Native XL](https://github.com/FormidableLabs/victory-native-xl)
- [OpenReplay: Top 9 RN Chart Libraries 2025](https://blog.openreplay.com/react-native-chart-libraries-2025/)
- [LogRocket: Top 10 RN Chart Libraries 2025](https://blog.logrocket.com/top-react-native-chart-libraries/)

### CodeCanyon Templates
- [BankuX - Banking RN Expo App](https://codecanyon.net/item/bankux-banking-react-native-expo-app-ui-kit/56625378)
- [Finova - Finance Banking RN Expo](https://codecanyon.net/item/finova-finance-banking-online-payment-react-native-expo-app-ui-kit/56905577)
- [Bankify - Banking Crypto Expense](https://codecanyon.net/item/bankify-banking-crypto-expense-app-template-react-native/60230007)
- [Finance UI Kit - CodeCanyon](https://codecanyon.net/item/finance-ui-kit-20-screens-for-react-native-cli-expo/62114625)

### AI/Agentic UI Patterns
- [Vercel AI SDK](https://ai-sdk.dev/)
- [shadcn AI Components](https://www.shadcn.io/ai)
- [Callstack: RN Best Practices for AI Agents](https://www.callstack.com/blog/announcing-react-native-best-practices-for-ai-agents)
- [Stream Chat AI SDK](https://getstream.io/chat/docs/sdk/react/guides/ai-integrations/stream-chat-ai-sdk/)
