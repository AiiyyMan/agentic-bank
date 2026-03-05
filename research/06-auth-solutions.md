# Authentication Solutions for Banking-Grade React Native (Expo) POC

**Date:** 2026-03-03
**Context:** Solo developer building an invite-only banking POC with React Native + Expo

---

## RECOMMENDATION (TL;DR)

**Use Supabase Auth** as the primary authentication provider, layered with a custom app PIN + biometrics via `expo-local-authentication`.

### Why Supabase Auth wins for this POC:

1. **Two birds, one stone:** Supabase Auth comes bundled with a full Postgres database, eliminating the need to integrate and pay for separate auth and database services. For a solo developer, this is a significant reduction in integration surface area.

2. **Banking-grade security primitives:** Row Level Security (RLS) enforces data access at the database level -- not in application code. This is the same model real banks use (policy-based access control at the data layer). No other auth provider in this comparison gives you database-level security enforcement out of the box.

3. **Generous free tier:** 50,000 MAUs + 500 MB Postgres database + 1 GB file storage. More than sufficient for any POC, and the database alone saves you from needing a separate DB provider.

4. **MFA included free:** TOTP-based MFA is enabled on all Supabase projects by default at no extra cost.

5. **Clean React Native/Expo integration:** Well-documented, actively maintained, no native module complications for basic auth flows.

6. **Auth-to-data continuity:** The authenticated user's JWT is automatically available to RLS policies. You write one `auth.uid()` check in a Postgres policy and your entire API is secured. No middleware, no token-forwarding plumbing.

### Recommended auth architecture:

```
Layer 1: Supabase Auth (registration, login, session management, MFA)
         - Email/password registration
         - Optional social login (Google, Apple)
         - TOTP MFA for high-value operations

Layer 2: App PIN (custom, stored hashed in expo-secure-store)
         - Set during onboarding after first login
         - Required to unlock app on return (like Revolut/Monzo)
         - 4-6 digit numeric code

Layer 3: Biometric unlock (expo-local-authentication)
         - Optional, offered after PIN setup
         - Face ID / Touch ID / Fingerprint
         - Unlocks the app instead of PIN (convenience layer)

Layer 4: Transaction PIN (optional, for transfers)
         - Separate from login PIN
         - Required before confirming transactions
         - Can reuse biometric as alternative
```

### Does auth choice influence database choice?

**Yes, decisively.** Choosing Supabase Auth means you get Supabase Postgres. Choosing Firebase Auth nudges you toward Firestore (NoSQL). Choosing Clerk or Auth0 leaves the database decision open but requires separate integration. For a banking app where relational data (accounts, transactions, balances) is the core domain, Postgres is the natural fit -- which makes the Supabase bundle particularly compelling.

---

## 1. Firebase Auth

### React Native / Expo Compatibility

Firebase offers two integration paths for React Native:

- **Firebase JS SDK:** Works with Expo Go (no native build required). As of Expo SDK 53+, requires `firebase@^12.0.0` due to ES module resolution changes. However, there are known compatibility issues with Metro's `package.json:exports` handling as of mid-2025.

- **React Native Firebase (`@react-native-firebase/auth`):** Full native SDK with better performance and more features. Requires a development build (cannot run in Expo Go). Needs config plugins or manual native configuration.

**Bottom line:** Firebase Auth works with Expo, but the JS SDK path has friction, and the native SDK path requires abandoning Expo Go for development builds.

### Features

| Feature | Supported | Notes |
|---------|-----------|-------|
| Email/password | Yes | Core feature |
| Social login (Google, Apple, Facebook) | Yes | Well-supported |
| Phone/SMS | Yes | 10K free/month, then $0.01-0.06/SMS |
| Anonymous auth | Yes | Unique to Firebase; useful for onboarding funnels |
| Magic links | Yes | Via email link sign-in |
| MFA | Yes | Requires upgrade to Identity Platform |
| Passkeys | Limited | Available on Identity Platform |

### Biometric Support

Firebase Auth does **not** provide biometric authentication. You would use `expo-local-authentication` separately as a local unlock mechanism. The biometric check gates access to stored Firebase credentials (e.g., a refresh token in `expo-secure-store`), not to Firebase itself.

### PIN Code Support

No built-in PIN support. You build this yourself as a custom UI layer that gates access to the stored Firebase session.

### Free Tier

- **50,000 MAUs** for email/password and social login (Spark Plan)
- **10,000 SMS verifications/month** free
- Identity Platform upgrade (for MFA, SAML) limits free tier to **3,000 DAUs** on Spark
- Blaze (pay-as-you-go): $0.01-0.06 per SMS beyond free tier; $0.015/MAU for enterprise SSO

### Pros for Banking App

- Massive ecosystem; well-tested at scale
- Anonymous auth is useful for "try before you register" flows
- Phone/SMS auth is polished and production-ready
- Google-backed infrastructure reliability

### Cons for Banking App

- **NoSQL bias:** Firebase nudges you toward Firestore, which is a poor fit for relational banking data (transactions, accounts, balances with foreign keys and joins)
- **MFA requires Identity Platform upgrade** with different pricing and limits
- **No database-level security policies:** Security rules are Firestore-specific, not SQL-based
- **Expo Go friction:** Native SDK requires dev builds; JS SDK has compatibility issues
- **No row-level security for relational data**

### Sources
- [Expo Firebase Guide](https://docs.expo.dev/guides/using-firebase/)
- [React Native Firebase](https://rnfirebase.io/)
- [Firebase Auth Pricing](https://firebase.google.com/pricing)
- [Firebase Auth Limits](https://firebase.google.com/docs/auth/limits)

---

## 2. Clerk

### React Native / Expo SDK

Clerk provides an official Expo SDK (`@clerk/clerk-expo`) that works with Expo Go and development builds. It stores session tokens securely using `expo-secure-store`. The SDK is built on top of the Clerk React SDK, providing access to the same hooks and methods.

**Key limitation:** Clerk's prebuilt UI components (`<SignIn />`, `<SignUp />`, `<UserProfile />`) are **web-only**. For React Native, you must build all auth screens yourself using Clerk's hooks and API (custom flows). This means more work for a solo developer.

### Features

| Feature | Supported | Notes |
|---------|-----------|-------|
| Email/password | Yes | Via custom flow on mobile |
| Social login (20+ providers) | Yes | OAuth handled automatically with deep linking |
| Phone/SMS | Yes | Verification codes |
| Magic links | Yes | |
| Passkeys | Yes | |
| MFA (TOTP + SMS) | Yes | Can be forced for all users (added Feb 2026) |
| Organizations/multi-tenant | Yes | |
| Session management | Yes | Multi-session, device monitoring, revocation |
| Biometric shortcut | Yes | Save password on device, unlock with Face ID |

### Banking-Relevant Features

- **Forced MFA:** As of February 2026, Clerk supports requiring MFA for all users with a single toggle -- critical for banking apps.
- **Session management:** Active device monitoring, session revocation, session fixation protection (token reset on each sign-in/out).
- **Multi-session support:** Users can sign into multiple accounts and switch between them.
- **Webhook events:** Real-time notifications for user events (sign-in, sign-up, session changes).

### Pricing

- **Free tier:** Up to 10,000 MAUs (some sources say 50,000 -- check [clerk.com/pricing](https://clerk.com/pricing) for current numbers)
- **Pro:** $25/month + $0.02 per additional MAU
- **Startup program:** 50,000 MAUs + 100 organizations free (application required)

### Mobile Experience Quality

The mobile experience requires custom-built screens since prebuilt components are web-only. However, Clerk's hooks are well-designed:

```typescript
const { signIn, setActive } = useSignIn();
const { signUp } = useSignUp();
const { isSignedIn, user } = useUser();
```

You get full control over the UI, which is actually a **pro** for banking apps where you want pixel-perfect branded screens. But it is more development work upfront.

### Pros for Banking App

- Excellent session management and security features
- Forced MFA support
- Clean API and hooks for custom flows
- Active development with frequent updates
- Good documentation for Expo

### Cons for Banking App

- **No prebuilt UI for mobile** -- must build all screens yourself
- **No bundled database** -- need separate DB integration
- **Pricing can escalate** at scale ($0.02/MAU adds up)
- **No database-level security** -- auth is decoupled from data layer

### Sources
- [Clerk Expo Quickstart](https://clerk.com/docs/quickstarts/expo)
- [Clerk Expo SDK Reference](https://clerk.com/docs/reference/expo/overview)
- [Clerk Pricing](https://clerk.com/pricing)
- [Clerk MFA Mobile](https://clerk.com/changelog/2026-02-23-force-mfa-mobile)

---

## 3. Auth0

### React Native SDK

Auth0 provides `react-native-auth0` (currently v5.x for Expo 53+). The SDK requires React Native 0.78.0+ and React 19.0.0+. It uses **browser-based authentication** via Auth0 Universal Login -- the user is redirected to an in-app browser (ASWebAuthenticationSession on iOS, Chrome Custom Tabs on Android) to authenticate.

### Features

| Feature | Supported | Notes |
|---------|-----------|-------|
| Email/password | Yes | Via Universal Login |
| Social login | Yes | Extensive provider support |
| Phone/SMS | Yes | |
| MFA | Yes | TOTP, SMS, push notifications, WebAuthn |
| Enterprise SSO (SAML/OIDC) | Yes | |
| Passwordless | Yes | |
| Biometric credential access | Yes | 4 biometric policies for credential protection |
| Custom Token Exchange | Yes | RFC 8693 compliant |

### Banking/Fintech Specific Features

Auth0 stands out for compliance and banking-specific standards:

- **FAPI Certified:** Financial-grade API (FAPI) OpenID Provider certification -- this is the standard the OpenID Foundation created specifically for banking APIs.
- **PSD2 / SCA Compliance:** Strong Customer Authentication and Dynamic Linking for transaction authorization.
- **SOC 2 Type II:** Annual audit covering all 5 Trust Services Criteria.
- **ISO 27001/27017/27018:** Information security management certifications.
- **PCI DSS:** Payment card industry compliance.
- **HIPAA/HITECH:** Healthcare compliance (shows breadth of compliance program).
- **GDPR Ready:** Data privacy compliance.

### Universal Login vs Native

Auth0 uses **Universal Login** (browser-based) by default on mobile. This means:

- **Pro:** Centralized login page, SSO across apps, easier to customize without app updates
- **Con:** Users see a browser context switch ("App wants to use auth0.com to Sign In" on iOS), which feels less native and less polished
- **Con:** The browser redirect UX does not feel like a banking app -- it feels like a web login

Auth0 recommends using Android App Links and Apple Universal Links for callbacks to prevent client impersonation attacks.

### Pricing

- **Free tier (B2C):** Up to 25,000 MAUs
- **Free tier (B2B):** Up to 500 MAUs
- **Essential plan:** Starts at $35/month
- **Professional plan:** Starts at $240/month (includes MFA, RBAC)
- **Enterprise:** Custom pricing

**Important:** MFA, RBAC, and premium support are **not included** in the free tier. For a banking POC that needs MFA, you would need a paid plan.

### Pros for Banking App

- **Best compliance story** of all options (FAPI, PSD2, SOC2, PCI DSS)
- Enterprise-grade security features
- Mature, battle-tested platform (now part of Okta)
- Extensive MFA options including push notifications
- If this were a production banking app heading to market, Auth0 would be the strongest choice

### Cons for Banking App

- **Browser-based login feels un-native** -- the redirect UX is jarring for a banking app
- **MFA requires paid plan** -- essential for banking, but costs money from day 1
- **Overkill for a POC** -- significant configuration overhead
- **No bundled database**
- **Pricing escalates rapidly** for production use
- **Complex setup** for a solo developer

### Sources
- [Auth0 React Native Quickstart](https://auth0.com/docs/quickstart/native/react-native)
- [Auth0 Pricing](https://auth0.com/pricing)
- [Auth0 Compliance](https://auth0.com/docs/secure/data-privacy-and-compliance)
- [react-native-auth0 GitHub](https://github.com/auth0/react-native-auth0)

---

## 4. Supabase Auth

### React Native / Expo Compatibility

Supabase Auth works with React Native via the `@supabase/supabase-js` client library. It is compatible with both Expo Go and development builds. Dependencies:

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

For secure token storage, you can swap AsyncStorage for `expo-secure-store` (recommended for banking apps). The Supabase documentation was updated as recently as March 2026, confirming active maintenance.

### Features

| Feature | Supported | Notes |
|---------|-----------|-------|
| Email/password | Yes | With optional email verification |
| Social login (OAuth) | Yes | Google, Apple, GitHub, etc. |
| Phone/SMS OTP | Yes | |
| Magic links | Yes | |
| MFA (TOTP) | Yes | Free, enabled by default on all projects |
| MFA (Phone) | Yes | SMS/WhatsApp verification codes |
| Anonymous sign-in | Yes | Added in 2024 |
| Row Level Security | Yes | Database-level access control |
| Session management | Yes | Auto-refresh, state change listeners |

### The Database Bonus

This is Supabase's killer differentiator for this use case. When you sign up for Supabase, you get:

- **Postgres database** (500 MB free) with full SQL support
- **Row Level Security (RLS)** that uses the auth JWT directly
- **Auto-generated REST API** from your database schema
- **Realtime subscriptions** for live data updates
- **Edge Functions** (500K invocations/month free) for server-side logic

For a banking app, this means:

```sql
-- Example: Users can only see their own transactions
CREATE POLICY "Users see own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Example: Users can only see their own accounts
CREATE POLICY "Users see own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);
```

This is **one line of SQL** to secure your entire transactions table. No middleware, no API layer, no token validation code. The database enforces it.

### MFA Details

- **TOTP:** Free, enabled by default. Users enroll via QR code, verify with authenticator app.
- **Phone:** SMS or WhatsApp verification as second factor.
- **Authenticator Assurance Levels (AAL):** `aal1` = first factor only; `aal2` = second factor completed. You can write RLS policies that require `aal2` for sensitive operations.
- **Factor limit:** Up to 10 factors per user.

```sql
-- Example: Require MFA for transfer operations
CREATE POLICY "Require MFA for transfers" ON transfers
  FOR INSERT USING (
    auth.jwt()->>'aal' = 'aal2'
  );
```

### Free Tier

| Resource | Limit |
|----------|-------|
| MAUs (Auth) | 50,000 |
| Database storage | 500 MB |
| Database egress | 2 GB |
| File storage | 1 GB |
| Edge Function invocations | 500,000/month |
| Realtime connections | Unlimited |
| API requests | Unlimited |
| Projects | 2 |

**Caveat:** Free tier projects pause after 7 days of inactivity. For a POC you are actively developing, this is not an issue. For a demo you leave idle, you would need to occasionally ping it or upgrade to Pro ($25/month).

### Session & Token Management

```typescript
// Initialize with secure storage
const supabase = createClient(url, anonKey, {
  auth: {
    storage: ExpoSecureStore,  // Not AsyncStorage!
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Required for React Native
  },
});

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  // SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, INITIAL_SESSION
});
```

**Important security note:** `auth.getSession()` reads from local storage and does NOT verify with the server. For trusted user data (e.g., displaying account info), always use `auth.getUser()` which makes a server round-trip.

### Pros for Banking App

- **Auth + Database in one service** -- massive simplification for solo dev
- **RLS is genuinely banking-grade** -- policy-based access control at the data layer
- **MFA is free and enabled by default**
- **Postgres is the right database for banking data** (relational, ACID, joins)
- **AAL-aware RLS** lets you require MFA for specific operations
- **Generous free tier** covers all POC needs
- **Active maintenance** and growing ecosystem
- **Open source** -- you could self-host if needed for compliance

### Cons for Banking App

- **No prebuilt UI components for mobile** -- build your own screens
- **Free tier pauses after 7 days idle**
- **No SOC2/PCI DSS certification** on free tier (no SLAs, no backups)
- **Younger platform** than Firebase or Auth0
- **Phone auth costs money** beyond free SMS credits
- **No FAPI or PSD2 compliance** (unlike Auth0)

### Sources
- [Supabase Auth React Native Quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Supabase Expo Tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Supabase MFA (TOTP)](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [Supabase MFA (Phone)](https://supabase.com/docs/guides/auth/auth-mfa/phone)
- [Supabase Pricing](https://supabase.com/pricing)
- [Expo Supabase Guide](https://docs.expo.dev/guides/using-supabase/)

---

## 5. Banking-Specific Auth Patterns

### App PIN / Passcode (Revolut-style)

Every major neobank (Revolut, Monzo, N26, Nubank, Chime) implements a local app PIN:

- **4-6 digit numeric code** set during onboarding
- **Required every time** the app is opened or returns from background
- **Stored locally** as a hash (never sent to server in plaintext)
- **Lockout after failed attempts** (e.g., 5 attempts, then 30-second cooldown, escalating)
- **Not the same as the server password** -- this is a local convenience/security layer

**Implementation approach:**

```
1. After first successful login (email/password via Supabase Auth)
2. Prompt user to create a 4-digit PIN
3. Hash the PIN with a salt
4. Store the hash in expo-secure-store
5. On subsequent app opens:
   a. Check if valid Supabase session exists (auto-refreshed token)
   b. If yes, show PIN screen (local verification only)
   c. If no (session expired), show full login screen
```

**Available libraries:**
- `@haskkor/react-native-pincode` -- choose/enter/locked modes with lockout
- `react-native-smooth-pincode-input` -- customizable PIN input UI
- `react-native-pin-view` -- another PIN input option
- **Custom build** -- recommended for banking apps where you want full control over the UX

### Biometric Unlock via Expo

`expo-local-authentication` is the standard for biometric auth in Expo:

```typescript
import * as LocalAuthentication from 'expo-local-authentication';

// Check if device supports biometrics
const hasHardware = await LocalAuthentication.hasHardwareAsync();
const isEnrolled = await LocalAuthentication.isEnrolledAsync();
const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
// Returns: [1] = fingerprint, [2] = facial recognition, [3] = iris

// Authenticate
const result = await LocalAuthentication.authenticateAsync({
  promptMessage: 'Unlock Banking App',
  cancelLabel: 'Use PIN instead',
  disableDeviceFallback: false, // Allow device passcode as fallback
});

if (result.success) {
  // Grant access
}
```

**Key considerations:**
- iOS requires `NSFaceIDUsageDescription` in app config (App Store rejection without it)
- Biometrics verify the **person**, not their identity -- they prove "the device owner is present," not "this is John Smith"
- Biometrics should gate access to stored credentials, not replace server authentication
- Always offer PIN as fallback (not all devices have biometric hardware)

**Platform details:**
- **iOS:** Uses Keychain Services (`kSecClassGenericPassword`) via `expo-secure-store`
- **Android:** Uses SharedPreferences encrypted with Android Keystore system

### Session Management for Financial Apps

Banking apps have stricter session requirements than typical apps:

| Pattern | Implementation |
|---------|---------------|
| **Short session timeout** | 5-15 minutes of inactivity triggers re-auth (PIN/biometric) |
| **Background timeout** | App going to background starts a timer; re-auth on return |
| **Absolute session expiry** | Force full re-login every 24-72 hours regardless of activity |
| **Single device sessions** | Optionally revoke sessions on other devices when logging in |
| **Session activity log** | Show user their active sessions and last login times |

With Supabase Auth, you can configure JWT expiry times and use `auth.refreshSession()` to manage token lifecycle. The `onAuthStateChange` listener handles `TOKEN_REFRESHED` events.

### Transaction PIN (Separate from Login)

Real banking apps use a **separate PIN for transactions** (distinct from the app unlock PIN):

- **MPIN (Mobile PIN):** Used specifically for authorizing transfers and payments
- **Set separately** from the login/unlock PIN during account setup
- **Verified server-side** (unlike the app unlock PIN which is local)
- **Can be reset** independently of the login password

**Implementation for POC:**

```
Option A (Simpler): Reuse biometric for transaction auth
  - User taps "Send Money"
  - App prompts Face ID / fingerprint
  - If verified, proceed with transaction
  - This is what Revolut does for most transfers

Option B (More realistic): Separate transaction PIN
  - Store a separate hashed PIN on the server (in user profile)
  - Before executing a transfer API call, require this PIN
  - Verify server-side before processing
  - Offer biometric as an alternative to entering the PIN
```

For a POC, **Option A is recommended** -- it provides credible banking UX with minimal implementation effort. Option B adds realism but requires additional server-side logic.

### How Neobanks Handle Auth UX

**Revolut:**
- Phone number + SMS code for initial registration
- 4-digit passcode set during onboarding
- Biometric unlock (Face ID / fingerprint) as default
- Biometric or passcode for transaction authorization
- "Street Mode" -- context-aware security based on location (trusted vs. public locations)
- Push notifications for real-time transaction alerts

**Monzo:**
- Email magic link for registration
- PIN set during onboarding
- Biometric unlock
- "Friendly" UX with clear language and helpful prompts
- Real-time spending notifications
- Card freeze/unfreeze from app

**N26:**
- Email + password registration
- PIN for card transactions
- Biometric app unlock
- Push-based transaction confirmations

**Common patterns across all neobanks:**
1. Registration is minimal friction (email or phone, not both)
2. PIN is set immediately after first login
3. Biometric is offered as convenient alternative to PIN
4. Day-to-day app access = biometric or PIN (not full password)
5. Full password only needed for initial login on new device
6. Onboarding completes in under 5 minutes
7. Real-time push notifications for all account activity

---

## 6. Comparison Matrix

| Criteria | Firebase Auth | Clerk | Auth0 | Supabase Auth |
|----------|--------------|-------|-------|---------------|
| **Expo Go compatible** | JS SDK only (with issues) | Yes | No (native module) | Yes |
| **Dev build required** | For native SDK | No | Yes | No |
| **Prebuilt mobile UI** | No | No (web only) | Yes (Universal Login) | No |
| **MFA on free tier** | No (requires Identity Platform) | Yes | No (paid plan) | Yes (TOTP free) |
| **Free MAU limit** | 50,000 | 10,000-50,000 | 25,000 (B2C) | 50,000 |
| **Bundled database** | Firestore (NoSQL) | No | No | Postgres (SQL) |
| **Row-level security** | Firestore rules | No | No | Yes (RLS) |
| **Banking compliance** | None specific | None specific | FAPI, PSD2, SOC2, PCI DSS | None specific |
| **Session management** | Basic | Excellent | Excellent | Good |
| **Phone/SMS auth** | Yes (10K free) | Yes | Yes | Yes |
| **Anonymous auth** | Yes | No | No | Yes |
| **Solo dev setup time** | Medium | Low-Medium | High | Low |
| **Right DB for banking** | No (NoSQL) | N/A | N/A | Yes (Postgres) |

---

## 7. Decision Framework

### If building a real, production banking app:
Choose **Auth0**. Its FAPI certification, PSD2/SCA compliance, SOC 2 Type II audit, and PCI DSS make it the only option that satisfies actual financial regulators. The higher cost and complexity are justified for production fintech.

### If building a credible banking POC (this project):
Choose **Supabase Auth**. The auth + database bundle eliminates integration complexity. Free MFA, RLS-based security policies, and Postgres give you a genuinely banking-appropriate architecture. Layer on a custom PIN screen and biometrics for the neobank UX polish.

### If you already know Firebase well:
Firebase Auth is viable but you will fight the NoSQL data model for banking data. Transactions, accounts, and balances are inherently relational. You would also need to pay for Identity Platform to get MFA.

### If you want the best developer experience:
Clerk has the cleanest API and best documentation, but the lack of prebuilt mobile UI and no bundled database means more integration work. It is a strong choice if you already have a database solution picked out.

---

## 8. Implementation Sketch: Supabase Auth + PIN + Biometrics

```
Dependencies:
  @supabase/supabase-js
  expo-secure-store
  expo-local-authentication
  react-native-url-polyfill

Auth Flow:

  FIRST LAUNCH (new user):
    1. Registration screen (email + password)
    2. Email verification (Supabase sends magic link or OTP)
    3. Supabase session created, JWT stored in expo-secure-store
    4. PIN creation screen (4-digit, hashed and stored locally)
    5. Biometric enrollment prompt ("Enable Face ID?")
    6. User lands on home/dashboard

  RETURNING USER (app opened):
    1. Check: is Supabase session valid? (auto-refreshed JWT)
    2. If valid session:
       a. Show biometric prompt (if enrolled)
       b. If biometric fails/cancelled: show PIN screen
       c. If PIN correct: unlock app
    3. If session expired (>72h or revoked):
       a. Show full login screen (email + password)
       b. After login: show PIN screen (verify or re-create)

  TRANSACTION AUTHORIZATION:
    1. User initiates transfer
    2. Show biometric prompt OR PIN entry
    3. If verified: execute Supabase RPC/API call
    4. Supabase RLS verifies auth.uid() + aal level

  SESSION MANAGEMENT:
    - JWT auto-refresh: enabled
    - Background timeout: 5 minutes -> require PIN/biometric
    - Absolute timeout: 72 hours -> require full login
    - Listen to onAuthStateChange for TOKEN_REFRESHED, SIGNED_OUT
```

---

## 9. Risk Notes

1. **Supabase free tier pauses after 7 days idle.** Mitigation: Keep developing on it (POC phase), or upgrade to Pro ($25/month) when demoing.

2. **Supabase has no financial compliance certifications.** For a POC, this is irrelevant. For production, you would need to layer compliance (e.g., self-host Supabase, add WAF, get your own SOC2).

3. **PIN stored locally can be bypassed on rooted/jailbroken devices.** Mitigation: Use `expo-secure-store` which leverages hardware-backed keystores. For a POC, this is acceptable. Production apps add root/jailbreak detection.

4. **No prebuilt auth UI means building 4-6 screens yourself.** These are: sign-up, sign-in, email verification, PIN creation, PIN entry, biometric prompt. For a solo dev, budget 2-3 days for these screens.

5. **Supabase is a younger platform than Firebase/Auth0.** Risk is mitigated by its open-source nature and rapid growth. It is backed by significant VC funding and has a large community.
