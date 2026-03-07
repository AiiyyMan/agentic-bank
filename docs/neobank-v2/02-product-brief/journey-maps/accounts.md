# Journey Map: Accounts

> Covers: Account overview, balance, account details, statements, **savings pots** (create, manage, auto-save rules)

---

## 1. User Stories

### Account Overview
1. **As Alex, I want to** ask "What's my balance?" and get an instant answer, **so that** I can check my finances without navigating through screens.
2. **As Alex, I want to** see my balance as a rich card with my account name and last 4 digits, **so that** I can verify I'm looking at the right account.
3. **As Alex, I want to** tap a balance card to see my full account details (account number, sort code, recent transactions), **so that** I can drill down when I need more information.
4. **As Alex, I want to** see all my accounts (main + pots) in one view, **so that** I understand my total financial position at a glance.

### Savings Pots
5. **As Alex, I want to** say "Create a holiday fund pot with a £2,000 goal," **so that** I can save toward specific targets without manual setup.
6. **As Alex, I want to** move money to and from pots via chat ("Move £200 to my holiday fund"), **so that** saving feels as easy as sending a message.
7. **As Alex, I want to** see a visual progress bar toward my pot goal, **so that** I feel motivated to keep saving.
8. **As Alex, I want to** have the AI notice my payday transfer pattern and suggest automation, **so that** I save consistently without thinking about it.
9. **As Alex, I want to** lock a pot until a specific date, **so that** I'm not tempted to dip into long-term savings.
10. **As Alex, I want to** see all my pots on a dedicated savings tab with at-a-glance amounts and progress, **so that** I can manage multiple goals visually.

### Edge Cases
11. **As Alex, I want to** be warned before withdrawing from a locked pot, **so that** I make the choice deliberately.
12. **As Alex, I want to** be told if a pot transfer would leave my main account below a safety threshold, **so that** I don't accidentally overdraw.

---

## 2. Journey Flow

### Check Balance (Chat Path -- Primary)

```
Alex opens app -> Chat home screen loads
  -> AI greets with morning summary:
     "Morning Alex! You have £1,230.00 in your Main Account."
     [Balance Card: £1,230.00 | Main Account | ****4521]
  -> Alex can tap the card to drill down to Account Detail screen

Total: 0 taps to see balance (it's the home screen)
Drill-down: 1 tap to Account Detail
```

### Check Balance (Explicit Query)

```
Alex: "What's my balance?"
  -> AI calls check_balance tool
  -> AI responds: "You have £1,230.00 in your Main Account."
     [Balance Card: £1,230.00 | Main Account | ****4521]

Total: 1 message + instant response
```

### View All Accounts

```
Alex: "Show me all my accounts"
  -> AI calls get_accounts tool
  -> AI responds: "Here are your accounts:"
     [Account Card: Main Account | £1,230.00]
     [Account Card: Holiday Fund | £1,600.00 / £2,000 goal | 80%]
     [Account Card: Emergency Fund | £3,000.00 / £5,000 goal | 60%]
     [Account Card: House Deposit | £8,200.00 / £10,000 goal | 82%]
  -> Tap any card to drill down

Total: 1 message + response with tappable cards
```

### Create Savings Pot (Chat Path)

```
Alex: "Create a new savings pot for a holiday"
  -> AI: "I'd love to help! What would you like to call it, and do you have a savings goal in mind?"
  -> Alex: "Call it Holiday Fund, goal is £2,000"
  -> AI: "Got it! Would you like to start it with an initial deposit?"
  -> Alex: "Yes, move £200 from my main account"
  -> AI: "I'll set this up for you:"
     [Confirmation Card:
       Create Pot: Holiday Fund
       Goal: £2,000.00
       Initial deposit: £200.00
       From: Main Account (balance after: £1,030.00)
       [Cancel] [Confirm]]
  -> Alex taps Confirm
  -> AI: "Done! Your Holiday Fund is set up with £200. That's 10% toward your goal!"
     [Pot Card: Holiday Fund | £200.00 / £2,000 | 10% | Progress bar]

Total: 3-4 conversational turns + 1 confirmation tap
```

### Create Savings Pot (Native UI Path -- Savings Tab)

```
Alex taps Savings tab
  -> Sees pot list with + Create Pot button
  -> Taps + Create Pot
  -> Enters: Name, Goal Amount (optional), Initial Deposit (optional)
  -> Reviews and confirms
  -> Pot appears in list with progress bar

Total: 4-5 taps + typing
```

### Move Money to Pot (Chat Path)

```
Alex: "Move £500 to my holiday fund"
  -> AI calls transfer_to_pot tool
  -> [Confirmation Card:
       Transfer to Pot
       To: Holiday Fund
       Amount: £500.00
       From: Main Account (balance after: £730.00)
       [Cancel] [Confirm]]
  -> Alex taps Confirm
  -> AI: "Done! Moved £500 to Holiday Fund. You're now at £700 -- 35% of your goal!"

Total: 1 message + 1 confirmation tap
```

### Withdraw from Pot

```
Alex: "Take £100 from my emergency fund"
  -> AI calls transfer_from_pot tool
  -> [Confirmation Card:
       Withdraw from Pot
       From: Emergency Fund
       Amount: £100.00
       To: Main Account
       [Cancel] [Confirm]]
  -> Alex taps Confirm
  -> AI: "Done! Moved £100 from Emergency Fund to your Main Account. Emergency Fund balance: £2,900."

Total: 1 message + 1 confirmation tap
```

### Withdraw from Locked Pot (Edge Case)

```
Alex: "Take £300 from my house deposit pot"
  -> AI: "Your House Deposit pot is locked until June 2026. Unlocking it early means you won't have this protection anymore. Are you sure?"
     [Action Card:
       Unlock & Withdraw: House Deposit
       Amount: £300.00
       Lock expires: 15 June 2026
       [Keep Locked] [Unlock & Withdraw]]
  -> Deliberate friction: extra confirmation step

Total: 1 message + 2 confirmation steps
```

### Auto-Save Rule Suggestion (Proactive)

```
AI detects: Alex has transferred £500 to Holiday Fund on the 28th (payday) for 3 consecutive months.

AI surfaces insight card on next app open:
  "I've noticed you transfer £500 to your Holiday Fund every payday.
   Want me to do this automatically each month?"
  [Quick Replies: "Yes, automate it" | "No thanks" | "Change amount"]

-> Alex taps "Yes, automate it"
-> [Confirmation Card:
     Auto-Save Rule
     Transfer: £500.00
     From: Main Account
     To: Holiday Fund
     When: Monthly on payday (salary credit detected)
     [Cancel] [Confirm]]
-> Alex taps Confirm
-> AI: "All set! I'll move £500 to Holiday Fund each payday. You'll get a notification when it happens."

Subsequently, on payday:
  Push notification: "Payday auto-save: moved £500 to Holiday Fund. Undo?"
  Chat card: "Your salary of £3,200 arrived. I've automatically moved £500 to Holiday Fund as you requested. Your main balance is £2,700."
```

---

## 3. AI Agent Capabilities

### Tools Required

| Tool | Type | Description |
|------|------|-------------|
| `check_balance` | Read | Get balance for main account |
| `get_accounts` | Read | List all accounts including pots |
| `get_pots` | Read | List all savings pots with goals and progress |
| `create_pot` | Write | Create a new savings pot with name, optional goal |
| `transfer_to_pot` | Write | Move money from main account to a pot |
| `transfer_from_pot` | Write | Move money from a pot to main account |
| `update_pot` | Write | Change pot name, goal, lock status |
| `close_pot` | Write | Close a pot and return balance to main account |
| `create_auto_save_rule` | Write | Set up automated transfers to pots |

### Example Multi-Turn Conversations

**Conversation 1: Quick balance check with savings context**
```
Alex: "How are my savings looking?"
AI: "Here's your savings overview:
     [Pot Card: Holiday Fund | £1,600 / £2,000 | 80%]
     [Pot Card: Emergency Fund | £3,000 / £5,000 | 60%]
     [Pot Card: House Deposit | £8,200 / £10,000 | 82%]

     Your total savings across all pots: £12,800.
     Your Holiday Fund is almost there -- just £400 to go!"
Alex: "Nice! Move £200 to the holiday fund"
AI: [Confirmation Card: Transfer £200 to Holiday Fund...]
```

**Conversation 2: Creating a pot with follow-up adjustments**
```
Alex: "I want to save for a new laptop"
AI: "Great idea! How much does the laptop cost?"
Alex: "About £1,500"
AI: "And what would you like to call the pot? Something like 'New Laptop'?"
Alex: "Yeah, that works. Start with £100"
AI: [Confirmation Card: Create pot "New Laptop", goal £1,500, initial deposit £100]
Alex confirms
AI: "Done! At £100/month, you'd reach your goal by March 2027. Want me to set up a monthly auto-save?"
Alex: "Make it £150 a month"
AI: [Confirmation Card: Auto-save rule: £150/month to New Laptop]
```

**Conversation 3: Safety threshold warning**
```
Alex: "Move £1,000 to my house deposit"
AI: "Moving £1,000 would bring your main account balance to £230.
     You have a phone bill of £45 due on Friday.
     Would you still like to proceed, or transfer a smaller amount?"
     [Quick Replies: "Go ahead" | "Transfer £800 instead" | "Cancel"]
```

### Proactive Suggestions for This Journey

- **Savings milestone:** "Your Emergency Fund just hit £3,000! You're 60% of the way to £5,000."
- **Excess balance detection:** "You have £850 more than your usual balance. Want to put some toward your House Deposit?"
- **Goal projection:** "At your current savings rate, you'll hit your Holiday Fund goal by August!"
- **Under-saving alert:** "You usually save £500/month, but you've only saved £200 so far this month. Want to top up?"

---

## 4. UX Requirements

### Key Screens

> **Chat card specs** (Balance Card, Pot Status Card, Confirmation Card, Success Card) are defined in the canonical Card Component Catalogue in `ai-chat.md`. This section covers only drill-down screens and full-screen native UI specific to Accounts.

**Account Detail Screen (Drill-down)**
- Full balance at top
- Account number and sort code (with copy-to-clipboard)
- Recent transactions (last 5-10, with "See all" link to Activity tab)
- Quick actions: Send, Add Money, Statement
- Account status indicator

**Savings Tab (Full Screen)**
- Total savings header (sum of all pots)
- Pot cards in a vertical list (not carousel -- more than 3 pots expected)
- Each card: name, balance, goal, progress bar, quick actions
- "Create Pot" button (FAB or list item)
- Active auto-save rules shown below pot they apply to

**Auto-Save Rule Configuration**
- Amount input
- Frequency selector (weekly, monthly, on payday)
- Source account (main by default)
- Destination pot
- Start date
- Review + confirm

### Data Display Requirements

- Balances: GBP formatted with commas for thousands, 2 decimal places (e.g., £12,345.67)
- Pot progress: percentage + fraction (e.g., "80% -- £1,600 of £2,000")
- Progress bars: green when on track, amber if behind projected pace
- Account numbers: always masked except on Account Detail screen
- All amounts use tabular (monospaced) numerals for alignment

### Loading / Error / Empty States

- **Loading:** Skeleton cards matching balance card and pot card dimensions
- **Error (API timeout):** "I'm having trouble checking your balance. Want me to try again?" + Retry button. Show last-known balance with timestamp if available.
- **Empty (no pots):** AI proactively suggests: "You don't have any savings pots yet. Want to create one? Most people start with an Emergency Fund."
- **Zero balance:** Display £0.00 normally; AI may contextualise: "Your main account is empty. You have £12,800 across your savings pots."

---

## 5. Technical Considerations

### API Capabilities

**Griffin (real integration):**
- `GET /v0/bank/accounts/{id}` -- account details with balance
- `GET /v0/bank/accounts` -- list all accounts (filter by owner)
- Book transfers between Griffin accounts -- used for pot transfers
- Savings pots modelled as sub-accounts within Griffin

**Mock layer (when `USE_MOCK_BANKING=true`):**
- Pots stored in Supabase `pots` table with user_id, name, goal, balance, locked_until
- Transfers between pots and main account are Supabase transactions
- Auto-save rules stored in `auto_save_rules` table with cron-like schedule

### Real-Time Requirements

- Balance should refresh on app foreground (not stale by more than 30 seconds)
- Pot transfers should reflect immediately in both source and destination
- Auto-save execution should trigger a push notification within seconds

### What to Mock vs. Integrate

| Feature | POC Approach | Notes |
|---------|-------------|-------|
| Account balance | Griffin sandbox (real) | Already integrated |
| Account listing | Griffin sandbox (real) | Already integrated |
| Savings pots | Mock in Supabase or Griffin sub-accounts | Griffin can model pots as separate accounts with book transfers |
| Pot goals & progress | Supabase metadata | Goal amount, name, emoji stored alongside pot account reference |
| Auto-save rules | Mock with scheduled Supabase function | Simulates cron; triggers book transfer |
| Interest on pots | Mock (static rate display) | No real interest calculation needed for POC |
| Account statements | Mock (generate from transaction data) | PDF generation from existing transaction history |
