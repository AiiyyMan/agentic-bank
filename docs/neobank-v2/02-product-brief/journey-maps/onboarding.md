# Journey Map: Onboarding

> Covers: Sign up, KYC/identity verification (mocked), profile setup, first deposit, first action. Target: < 3 minutes.

---

## 1. User Stories

1. **As Alex, I want to** sign up by having a conversation with the AI, not by filling out a long form, **so that** onboarding feels like meeting a new personal banker.
2. **As Alex, I want to** provide my name, email, and password in natural conversation, **so that** sign-up doesn't feel like a compliance exercise.
3. **As Alex, I want to** complete identity verification quickly (selfie + ID photo), **so that** I'm not stuck waiting days for manual review.
4. **As Alex, I want to** see clear progress through the onboarding steps, **so that** I know how much is left.
5. **As Alex, I want to** be guided to my first meaningful action (check balance, create a pot, or ask a question), **so that** I immediately see the value of the AI-first experience.
6. **As Alex, I want to** start using basic features even if verification is still processing, **so that** I'm not blocked.
7. **As Alex, I want to** the AI to explain why certain information is needed (e.g., address, date of birth), **so that** intrusive questions feel justified.

### Funding the Account
8. **As Alex, I want to** be given clear, copyable bank details immediately after account creation, **so that** I can set up a transfer from my existing bank right away.
9. **As Alex, I want to** be offered multiple ways to fund my account (bank transfer, Open Banking link, salary redirect), **so that** I can choose the easiest option for me.
10. **As Alex, I want to** the AI to proactively detect my first deposit and celebrate it, **so that** I feel the account is "alive" and I'm motivated to keep going.
11. **As Alex, I want to** be guided through redirecting my salary to this account, **so that** I can make this my primary bank without figuring it out myself.
12. **As Alex, I want to** see a "getting started" checklist that includes funding, **so that** I know adding money is an important next step and I can track my progress.

### Edge Cases
13. **As Alex, I want to** resume onboarding if I close the app mid-flow, **so that** I don't have to start over.
14. **As Alex, I want to** be told clearly if my identity verification fails, with guidance on what to do, **so that** I'm not left in limbo.
15. **As Alex, I want to** skip optional steps (like initial deposit) and complete them later, **so that** I can explore the app first.
16. **As Alex, I want to** be reminded to fund my account if I haven't after 24 hours, **so that** I don't forget and abandon the app.

---

## 2. Journey Flow

### Full Onboarding Flow (AI-Guided Conversation)

```
Step 1: Welcome Card (app launch -- first time)
──────────────────────────────────────────
No splash screens, no carousel, no feature tour.
The app opens directly into the chat interface.
The first thing Alex sees is a single visually compelling welcome card:

     [Welcome Card (full-width, branded):
       ┌─────────────────────────────────────┐
       │  [Agentic Bank logo]                │
       │                                     │
       │  Meet your AI personal banker.      │
       │                                     │
       │  • Open your account in 2 minutes   │  <- tappable
       │  • AI that suggests, you decide     │  <- tappable
       │  • FSCS protected up to £85,000     │  <- tappable
       │  • FCA regulated                    │  <- tappable
       │                                     │
       │  ┌─────────────────────────────┐    │
       │  │   Let's open your account   │    │
       │  └─────────────────────────────┘    │
       │                                     │
       │  Tell me more                       │  <- text link
       │  Already have an account? Sign in   │
       └─────────────────────────────────────┘
     ]

Each bullet point is tappable -- tapping opens an info card inline
in the chat (not a modal). The welcome card stays visible above.
The user can explore as many as they like, then tap the CTA when ready.

-> If Alex taps "Open your account in 2 minutes":
   AI: [Info Card: Speed]
       "Most banks take days. We take 2 minutes.

        You'll have a conversation with me -- no long forms, no waiting.
        By the end, you'll have a real UK bank account with a sort code
        and account number, ready to receive money.

        All I'll need is your name, email, date of birth, address,
        and a quick identity check."

       [Quick Replies: "Let's go" | "Tell me about security"]

-> If Alex taps "AI that suggests, you decide":
   AI: [Info Card: Your Control]
       "I'll help you manage your money -- spotting savings opportunities,
        tracking spending, and suggesting when to move money.

        But I never act without your permission. Every transaction,
        every transfer, every change -- you confirm it first.

        Think of me as a smart assistant, not an autopilot."

       [Quick Replies: "Let's go" | "How does AI work here?"]

   -> If Alex taps "How does AI work here?":
      AI: [Info Card: How the AI Works]
          "I use AI to understand what you need and give personalised
           suggestions. For example:

           'You have £400 more than usual -- want to put
            some toward your Holiday Fund?'

           You can say yes, no, or change the amount. I learn
           your preferences over time but never assume.

           Your conversations are private and encrypted.
           We don't sell your data. Ever."

          [Quick Replies: "Let's go" | "Tell me about protection"]

-> If Alex taps "FSCS protected up to £85,000":
   AI: [Info Card: Deposit Protection]
       ┌─────────────────────────────────────┐
       │  [FSCS logo]                        │
       │                                     │
       │  Your money is protected.           │
       │                                     │
       │  Deposits up to £85,000 are covered │
       │  by the Financial Services          │
       │  Compensation Scheme -- the same    │
       │  protection as any high-street bank.│
       │                                     │
       │  If anything ever happened to us,   │
       │  your money is guaranteed by the    │
       │  UK government.                     │
       └─────────────────────────────────────┘

       [Quick Replies: "Let's go" | "What about FCA?"]

-> If Alex taps "FCA regulated":
   AI: [Info Card: Regulation]
       ┌─────────────────────────────────────┐
       │  [FCA logo]                         │
       │                                     │
       │  Regulated by the FCA.              │
       │                                     │
       │  We're authorised and regulated by  │
       │  the Financial Conduct Authority    │
       │  (FRN: XXXXXXX).                   │
       │                                     │
       │  This means we follow strict rules  │
       │  on how we handle your money and    │
       │  your data:                         │
       │                                     │
       │  • Bank-grade encryption (AES-256)  │
       │  • Your data is never sold          │
       │  • We comply with UK data           │
       │    protection law (UK GDPR)         │
       │  • Regular independent audits       │
       └─────────────────────────────────────┘

       [Quick Replies: "Let's go" | "Tell me about FSCS"]

-> If Alex taps "Tell me more":
   AI: "What would you like to know about?"

       [Quick Replies:
         "How is my money protected?"
         "How does the AI work?"
         "What can you help me with?"
         "How long does setup take?"]

   -> If Alex taps "What can you help me with?":
      AI: [Info Card: What I Can Do]
          "Once you're set up, I can help you:

           💰 Check your balance and spending anytime
           💸 Send money to friends and family
           🏦 Create savings pots with goals
           📊 Get personalised spending insights
           🔄 Split purchases into instalments (Flex)
           🌍 Send money abroad at great rates
           📈 Check and understand your credit score

           Just ask me in plain English -- no menus to navigate."

          [Quick Replies: "Let's go" | "How does AI work?"]

-> Alex taps "Let's go" (from any info card) or
   "Let's open your account" (from welcome card):

AI: "Great! Let's get you set up. What's your name?"

     [Text Input with placeholder: "Your full name"]

Alex: "Alex Morgan"

Step 2: Email & Password
──────────────────────────────────────────
AI: "Nice to meet you, Alex! I'll need an email address and a password
     to create your account."

     [Input Card:
       Email: [email field]
       Password: [password field with strength indicator]
       [Continue]]

Alex fills in and taps Continue

Step 3: Date of Birth
──────────────────────────────────────────
AI: "Thanks! When's your birthday? We need this to verify your identity
     -- you must be 18 or over to open an account."

     [Date Picker Card: DD / MM / YYYY]

Alex: selects 15/07/1997

Step 4: Address
──────────────────────────────────────────
AI: "What's your home address? We'll use this for your account
     and any correspondence."

     [Address Input Card:
       Postcode: [text field]
       [Find Address] button
       -> Dropdown: select from matching addresses
       -> Or: Enter manually link]

Alex: enters "SW1A 1AA" -> selects address from dropdown

Step 5: Identity Verification (Mocked for POC)
──────────────────────────────────────────
AI: "Nearly there! For security, we need to verify your identity.
     This takes about 30 seconds."

     [KYC Card:
       Step 1: Photo of your ID (passport or driving licence)
       Step 2: Quick selfie

       [Start Verification]]

     -> In POC: tapping "Start Verification" shows a brief animation
        (2-3 seconds) then returns "Verified" immediately
     -> In production: integrates with ID verification provider

AI: "Identity verified! You're all set, Alex."
     [Success animation: checkmark with confetti-style particles]

Step 6: Account Created
──────────────────────────────────────────
AI: "Your account is ready! Here's what you've got:"

     [Account Card:
       Main Account
       Alex Morgan
       Sort Code: 12-34-56
       Account Number: 12345678
       Balance: £0.00]

Step 7: Fund Your Account
──────────────────────────────────────────
AI: "Now let's get some money in! How would you like to fund your account?"

     [Funding Options Card:
       Option 1: "Bank transfer" (icon: bank)
         "Transfer from your existing bank using your new account details"
       Option 2: "Link another bank" (icon: link)
         "Connect your existing bank and pull money across instantly"
       Option 3: "I'll do this later" (icon: clock)
         "No problem -- you can add money anytime"]

     -> If Alex taps "Bank transfer":
        AI: "Here are your account details -- you'll need these to set up
             a transfer from your other bank:"

             [Account Details Card:
               Name: Alex Morgan
               Sort Code: 12-34-56
               Account Number: 12345678
               Reference: AGENTIC
               [Copy All] [Share]]

             "Most bank transfers arrive within 2 hours (often minutes via
              Faster Payments). I'll let you know as soon as it lands!

              Tip: while you're in your other banking app, you could also
              set up your salary to come here. Want me to help with that later?"

             [Quick Replies: "Yes, remind me" | "Got it, thanks"]

     **Implementation note:** Open Banking link (#78) is P1. For P0, the funding
     screen shows "Bank transfer" details + "I'll do it later" option only.
     Open Banking is added as a third option when #78 ships.

     -> If Alex taps "Link another bank" (Open Banking):
        AI: "I can connect to your existing bank so you can move money
             across instantly. Which bank are you with?"

             [Bank Selector Card:
               Search: [text field]
               Popular: Barclays, HSBC, Lloyds, NatWest, Monzo, Starling
               [See all banks]]

             -> Alex selects Barclays
             -> Redirect to Barclays Open Banking consent screen (mocked in POC)
             -> Returns to app

        AI: "Connected! How much would you like to transfer across?"
             [Amount Input: £ [amount field] | Available: £4,230.00]
             -> Alex enters £500

             [Confirmation Card:
               Transfer: £500.00
               From: Barclays ****7891
               To: Agentic Bank Main Account
               [Cancel] [Confirm]]

             -> Alex taps Confirm
        AI: "Done! £500 is now in your Agentic Bank account."
             [Balance Card: £500.00 | Main Account]
             [Celebration animation: confetti]

     -> If Alex taps "I'll do this later":
        AI: "No rush! When you're ready, just say 'add money' and I'll
             walk you through it. Here are your details in case you want
             to set up a transfer later:"
             [Account Details Card (collapsed/compact):
               Sort Code: 12-34-56 | Acc: 12345678 | [Copy]]

Step 8: Getting Started Checklist
──────────────────────────────────────────
AI: "You're off to a great start! Here's your getting started checklist:"

     [Checklist Card:
       ✅ Create account
       ✅ Verify identity
       ☐ Add money to your account
       ☐ Set up a savings pot
       ☐ Add a payee
       ☐ Explore what I can do]

     "What would you like to do next?"

     [Quick Replies:
       "Create a savings pot"
       "Add a payee"
       "Tell me what you can do"
       "Just explore"]

     -> If Alex taps "Tell me what you can do":
        AI: "I can help you with:
             - Check your balance and transactions
             - Send money to friends and family
             - Create savings pots with goals
             - Flex purchases into instalments
             - Check your credit score
             - Get spending insights and tips
             - Send money abroad

             Try asking me anything -- I'm here to help!"

     -> If Alex taps "Create a savings pot":
        AI transitions directly into the pot creation flow
```

### Onboarding Timing Breakdown

| Step | Time Estimate | Cumulative |
|------|-------------|-----------|
| Welcome + name | 10 seconds | 0:10 |
| Email + password | 30 seconds | 0:40 |
| Date of birth | 10 seconds | 0:50 |
| Address lookup | 20 seconds | 1:10 |
| Identity verification | 30 seconds (mocked) | 1:40 |
| Account creation | 5 seconds | 1:45 |
| Fund your account | 15–60 seconds | 2:00–2:45 |
| Getting started checklist | 10 seconds | 2:10–2:55 |

**Total: ~2–3 minutes** (within the 3-minute target)
- Fastest path: Alex skips funding → 2 minutes
- With bank transfer details copy → 2:15
- With Open Banking pull → 2:45 (includes bank auth redirect)

### Resume After App Close (Edge Case)

```
Alex closes app after Step 4 (address entered)
  -> Progress saved to Supabase
  -> Next app open:

AI: "Welcome back, Alex! You were setting up your account.
     We just need to verify your identity and you'll be good to go."

     [KYC Card: Start Verification]

  -> Resumes from Step 5
```

### First Deposit Detected (Post-Onboarding)

```
Alex's bank transfer arrives (minutes to hours after onboarding):

Push notification: "Your first deposit just landed! 🎉 £500 is now in your account."

On next app open:
AI: "Great news -- your first £500 has arrived! Your Main Account
     balance is now £500.00."
     [Balance Card: £500.00 | Main Account]

     "Now that you have funds, would you like to:"
     [Quick Replies:
       "Create a savings pot"
       "Set up salary redirect"
       "Send money to someone"
       "Just explore"]

     [Checklist update: ✅ Add money to your account]
```

### Salary Redirect Guidance

```
Alex: "Help me move my salary here"
  -> or triggered by "Yes, remind me" from funding step

AI: "I can walk you through redirecting your salary. You'll need to
     give your employer these bank details:"

     [Salary Redirect Card:
       Your new bank details for payroll:
       ─────────────────────────────
       Name: Alex Morgan
       Sort Code: 12-34-56
       Account Number: 12345678
       ─────────────────────────────
       [Copy Details] [Email to Myself]

       Steps:
       1. Log into your employer's HR/payroll portal
       2. Update your bank details to the above
       3. Changes usually take effect next pay cycle

       Common portals: Workday, BambooHR, ADP, Sage
       ]

AI: "Once your salary lands, I'll let you know and we can set up
     automatic savings right away!"
```

### Funding Reminder (No Deposit After 24h)

```
24 hours after sign-up, if balance is still £0:

Push notification: "Your Agentic Bank account is ready -- add money to
                    get the full experience!"

On next app open:
AI: "Welcome back, Alex! Your account is set up but you haven't added
     any money yet. Want to do that now?"

     [Funding Options Card:
       "Bank transfer" | "Link another bank" | "Maybe later"]

     "Adding even a small amount lets you explore all the features --
      savings pots, payments, spending insights, and more."
```

### Verification Failed (Edge Case)

```
In production (not POC):

AI: "I wasn't able to verify your identity from those photos.
     This can happen if:
     - The photo was blurry or had glare
     - The ID was expired
     - The lighting was too dark

     Want to try again? Make sure you're in a well-lit area."

     [Quick Replies: "Try again" | "Use a different ID" | "Contact support"]
```

---

## 3. AI Agent Capabilities

### Tools Required

| Tool | Type | Description |
|------|------|-------------|
| `get_value_prop_info` | Read | Retrieve info card content for a welcome card topic (speed, control, fscs, fca, features) |
| `create_account` | Write | Create new user account (Supabase Auth + profile) |
| `verify_identity` | Write | Submit KYC verification (mocked: instant approval) |
| `get_onboarding_status` | Read | Check where user is in the onboarding flow |
| `complete_onboarding` | Write | Mark onboarding as complete, provision bank account |
| `get_account_details` | Read | Retrieve sort code, account number for sharing/copying |
| `initiate_open_banking_link` | Write | Start Open Banking consent flow to link external bank (mocked in POC) |
| `pull_funds_open_banking` | Write | Pull funds from linked external bank via Open Banking (mocked in POC) |
| `get_onboarding_checklist` | Read | Return getting started checklist with completion status |
| `update_checklist_item` | Write | Mark a checklist item as complete |

### Example Multi-Turn Conversations

**Conversation 1: Streamlined happy path**
```
[Welcome Card: "Meet your AI personal banker..." with CTA]
Alex taps "Let's open your account"
AI: "Great! Let's get you set up. What's your name?"
Alex: "I'm Alex"
AI: "Hi Alex! I'll need your email and a password."
    [Input Card: Email + Password]
Alex: fills in and submits
AI: "When's your birthday?"
    [Date Picker]
Alex: selects date
AI: "And your address? Just type your postcode and I'll look it up."
    [Address Input]
Alex: enters postcode, selects address
AI: "Last step -- quick identity check."
    [KYC Card]
Alex: taps Start Verification
AI: "All verified! Your account is ready. What would you like to do first?"
```

**Conversation 2: Alex explores before signing up ("Tell me more" path)**
```
[Welcome Card displayed]
Alex taps "Tell me more"
AI: "What would you like to know about?"
    [Quick Replies: "How is my money protected?" | "How does the AI work?" |
                    "What can you help me with?" | "How long does setup take?"]
Alex taps "How does the AI work?"
AI: [Info Card: How the AI Works]
    "I use AI to understand what you need and give personalised suggestions..."
    [Quick Replies: "Let's go" | "How is my money protected?"]
Alex taps "How is my money protected?"
AI: [Info Card: FSCS + FCA combined]
    "Your deposits are protected up to £85,000 by the FSCS..."
    [Quick Replies: "Let's go" | "What can you help me with?"]
Alex taps "Let's go"
AI: "Great! Let's get you set up. What's your name?"
    [Text Input]
-> Continues with normal onboarding from Step 2
```

**Conversation 3: Alex asks questions mid-flow**
```
AI: "I'll need your date of birth -- this is required to verify your identity."
Alex: "Why do you need my birthday?"
AI: "Good question! We need it for two reasons:
     1. To verify you're 18 or over (legal requirement)
     2. To match against your ID document during verification

     Your data is encrypted and we'll never share it. Ready?"
    [Date Picker]
```

**Conversation 3: Alex wants to skip ahead**
```
AI: [After account creation] "Would you like to add money to get started?"
Alex: "I'll do that later, just let me look around"
AI: "No problem! Your account is ready whenever you are.
     You can add money by transferring from another bank to these details:"
     [Account Details Card]
     "In the meantime, try asking me anything -- I can show you spending insights,
      help set up savings pots, or explain what I can do."
```

### Proactive Suggestions During Onboarding

- **After account creation:** "Now let's get some money in! How would you like to fund your account?"
- **First deposit detected:** "Your first £X has arrived! Now you can explore savings pots, payments, and more."
- **24h after sign-up (no deposit):** Push notification: "Your account is ready -- add money to unlock the full experience!"
- **48h after sign-up (no deposit):** "Adding even £10 lets you try out all the features. Want to set up a quick transfer?"
- **After first deposit:** "Now that you have funds, most people set up a savings pot next. Want to create one?"
- **Salary detected (large credit, monthly pattern):** "Looks like your salary just landed! Want to set up automatic savings?"
- **First week nudges:** One gentle prompt per day introducing a different feature
- **Checklist completion:** "You've completed your getting started checklist! You're all set to make the most of Agentic Bank."

---

## 4. UX Requirements

### Key Screens / Components

> **Chat card specs** (Welcome Card, Value Prop Info Cards, Input Card, Date Picker Card, Address Input Card, KYC Card, Account Details Card, Funding Options Card, Bank Selector Card, Salary Redirect Card, Checklist Card, Progress Indicator, Confirmation Card, Success Card) are defined in the canonical Card Component Catalogue in `ai-chat.md`. This section covers only interaction patterns and states specific to Onboarding.

### Interaction Patterns

- **Auto-focus:** Each input card auto-focuses the first field
- **Keyboard management:** Keyboard opens automatically for text inputs; dismisses on submit
- **Validation:** Real-time inline validation; prevent submission of invalid data
- **Progress saving:** Each completed step is persisted; app can resume from any step
- **Skip pattern:** Optional steps (like initial deposit) have a "Skip" option

### Loading / Error / Empty States

- **Loading (account creation):** "Setting up your account..." with brand animation (1-2 seconds)
- **Loading (verification):** "Verifying your identity..." with step animation (2-3 seconds for mock)
- **Error (email already exists):** "This email is already registered. Want to sign in instead?" + [Sign In] button
- **Error (weak password):** "Your password needs to be stronger. Try adding numbers, symbols, or making it longer."
- **Error (address not found):** "I couldn't find that postcode. Want to enter your address manually?"
- **Error (verification failed):** Clear guidance on what went wrong + retry option

---

## 5. Technical Considerations

### API Capabilities

**Supabase Auth (real integration):**
- `supabase.auth.signUp({ email, password })` -- create user
- `supabase.auth.signInWithPassword({ email, password })` -- sign in
- Session management with JWT tokens
- Password strength validation client-side

**Griffin Onboarding (real sandbox):**
- Create legal person: `POST /v0/bank/legal-persons`
- Create verification: `POST /v0/bank/verifications`
- Reliance verification for KYC (simplified for sandbox)
- Open bank account: `POST /v0/bank/accounts`

**Profile Management (Supabase):**
- Store user profile in `profiles` table: name, DOB, address, onboarding status
- Link Griffin legal person URL and account URL to profile
- Track onboarding step for resume capability

### Onboarding State Machine

```
STARTED -> NAME_COLLECTED -> EMAIL_REGISTERED -> DOB_COLLECTED
  -> ADDRESS_COLLECTED -> VERIFICATION_PENDING -> VERIFICATION_COMPLETE
  -> ACCOUNT_PROVISIONED -> FUNDING_PROMPTED -> ONBOARDING_COMPLETE
```

Each state transition is persisted. The onboarding flow can resume from any state.

Note: `FUNDING_PROMPTED` means the user has been shown funding options. They may skip funding and still reach `ONBOARDING_COMPLETE`. The getting started checklist tracks whether funding actually happened separately.

### Getting Started Checklist

Stored in Supabase `onboarding_checklist` table (or as JSONB on the `profiles` table):

```
{
  "create_account": true,
  "verify_identity": true,
  "add_money": false,        // set true on first deposit
  "create_pot": false,        // set true on first pot creation
  "add_payee": false,         // set true on first payee added
  "explore_features": false   // set true after 3+ AI interactions
}
```

The AI references this checklist to prioritise suggestions and celebrate milestones.

### What to Mock vs. Integrate

| Feature | POC Approach | Notes |
|---------|-------------|-------|
| User registration | Supabase Auth (real) | Already integrated |
| Profile storage | Supabase DB (real) | Already integrated |
| KYC/ID verification | Mock (instant approval) | Skip real ID check; show the UX |
| Bank account creation | Griffin sandbox (real) or mock | Depends on USE_MOCK_BANKING flag |
| Address lookup | Mock (static list for demo postcodes) | Real postcode API is P2 |
| Biometric setup (Face ID) | Expo LocalAuthentication (real) | Works on device |
| Progress persistence | Supabase DB (real) | Store onboarding_step in profile |
| Open Banking link | Mock (instant consent + static balance) | Real Open Banking is P2; show the UX |
| Open Banking pull payment | Mock (instant transfer) | Demonstrates the flow without real bank integration |
| First deposit detection | Supabase real-time subscription or polling | Detect balance change from £0 → £X |
| Salary redirect | Copy/share details only (no automation) | User manually updates with employer |
| Onboarding checklist | Supabase DB (real) | JSONB on profiles or separate table |

### Security Considerations (POC Scope)

- Passwords hashed by Supabase Auth (bcrypt)
- JWT session tokens with 1-hour expiry + refresh token
- No real PII stored (demo data only)
- KYC is mocked -- no real identity documents processed
- HTTPS enforced on all API calls
- Rate limiting on auth endpoints (Supabase built-in)

### Real-Time Requirements

- Account creation should complete in <3 seconds
- Verification mock should feel realistic (2-3 second artificial delay)
- Profile creation should be atomic (no partial state visible to user)
- Session token should be issued immediately after account creation (no re-login needed)
