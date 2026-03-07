# Journey Map: Payments

> Covers: Send money (domestic), beneficiary management, standing orders, direct debits, international transfers (Wise)

---

## 1. User Stories

### Domestic Payments
1. **As Alex, I want to** say "Send £50 to James for dinner" and have it happen in one confirmation tap, **so that** paying someone is as easy as texting them.
2. **As Alex, I want to** the AI to resolve "James" to my saved beneficiary James Mitchell, **so that** I don't have to type full names or account numbers.
3. **As Alex, I want to** see a confirmation card with all payment details (recipient, amount, reference, balance after) before the money moves, **so that** I can verify everything is correct.
4. **As Alex, I want to** receive an instant push notification when a payment is sent or received, **so that** I know immediately when money moves.

### Beneficiary Management
5. **As Alex, I want to** say "Add James as a payee" and provide his sort code and account number through conversation, **so that** future payments are faster.
6. **As Alex, I want to** the AI to suggest adding someone as a beneficiary after I've paid them multiple times, **so that** I don't have to remember to do it myself.
7. **As Alex, I want to** see my recent and frequent payees at the top of any payment flow, **so that** I can pay regulars quickly.

### Standing Orders
8. **As Alex, I want to** say "Set up a standing order of £200 to my landlord on the 1st of every month," **so that** I never miss rent.
9. **As Alex, I want to** see all my standing orders with next payment dates, **so that** I can plan my finances.
10. **As Alex, I want to** edit or cancel a standing order through chat, **so that** I can adjust without navigating settings.

### International Transfers
11. **As Alex, I want to** say "Send 200 euros to Maria in Spain" and have the AI guide me through the process, **so that** I don't need a separate app for international transfers.
12. **As Alex, I want to** see the exchange rate, fee, and delivery time before confirming an international transfer, **so that** I know exactly what I'm paying.
13. **As Alex, I want to** track the status of my international transfer (sent, processing, delivered), **so that** I know when the money arrives.

### Payment History
14. **As Alex, I want to** say "Show me payments to James" and see a list of all past payments to that person, **so that** I can track what I've sent.
15. **As Alex, I want to** ask "How much have I paid James this month?" and get a total, **so that** I can keep track of shared expenses.
16. **As Alex, I want to** tap on any past payment to see full details (amount, date, recipient, reference, status), **so that** I can verify or reference a specific payment.
17. **As Alex, I want to** ask "What was my last payment?" and get an instant answer, **so that** I can quickly confirm recent activity.

### Edge Cases
18. **As Alex, I want to** be warned if a payment would bring my balance below a safety threshold, **so that** I don't accidentally overdraw.
19. **As Alex, I want to** be told if I try to pay someone who isn't in my beneficiaries, and be offered to add them, **so that** the flow doesn't dead-end.

---

## 2. Journey Flow

### Send Domestic Payment (Chat Path -- Primary)

```
Alex: "Send £50 to James for dinner"
  -> AI resolves "James" to saved beneficiary James Mitchell
  -> AI calls send_payment tool
  -> [Confirmation Card:
       Send Money
       To: James Mitchell
       Account: ****7892 | 12-34-56
       Amount: £50.00
       Reference: Dinner
       From: Main Account
       Balance after: £1,180.00
       [Cancel] [Confirm]]
  -> Alex taps Confirm
  -> AI: "Done! £50.00 sent to James Mitchell."
     [Success Card: Payment complete | £50.00 to James Mitchell | Ref: Dinner]

Total: 1 message + 1 confirmation tap
```

### Send Payment -- Ambiguous Beneficiary

```
Alex: "Send £30 to Sarah"
  -> AI finds two Sarahs: Sarah Williams and Sarah Chen
  -> AI: "I found two Sarahs in your payees. Which one?"
     [Quick Replies: "Sarah Williams" | "Sarah Chen"]
  -> Alex taps "Sarah Williams"
  -> [Confirmation Card: Send £30.00 to Sarah Williams...]

Total: 1 message + 1 disambiguation tap + 1 confirmation tap
```

### Send Payment -- No Beneficiary Found

```
Alex: "Send £25 to Bob"
  -> AI searches beneficiaries, no match
  -> AI: "I couldn't find a payee called Bob. Would you like to add them?
         I'll need their sort code and account number."
     [Quick Replies: "Add Bob as payee" | "Cancel"]
  -> Alex: "Yes, sort code 11-22-33, account 12345678"
  -> AI: "Got it. I'll add Bob first, then send the payment."
     [Confirmation Card: Add Bob as beneficiary | SC: 11-22-33 | Acc: ****5678]
  -> Alex confirms
  -> AI: "Bob added! Now let me prepare that payment."
     [Confirmation Card: Send £25.00 to Bob | Ref: none]
  -> Alex confirms
  -> AI: "Done! £25.00 sent to Bob."

Total: 2-3 messages + 2 confirmation taps (chained actions)
```

### Send Payment -- Insufficient Funds

```
Alex: "Send £5,000 to Sarah"
  -> AI checks balance: £1,230
  -> AI: "Your balance is £1,230, which isn't enough for a £5,000 transfer.
         Would you like to send a different amount?"
     [Quick Replies: "Send £1,000 instead" | "Cancel"]
```

### Add Beneficiary (Chat Path)

```
Alex: "Add a new payee"
  -> AI: "Sure! What's their name?"
  -> Alex: "Maria Garcia"
  -> AI: "And their sort code?"
  -> Alex: "40-50-60"
  -> AI: "And the account number?"
  -> Alex: "87654321"
  -> [Confirmation Card:
       Add Beneficiary
       Name: Maria Garcia
       Sort Code: 40-50-60
       Account: ****4321
       [Cancel] [Confirm]]
  -> Alex confirms
  -> AI: "Done! Maria Garcia has been added to your payees."

Total: 4 conversational turns + 1 confirmation tap
```

### Create Standing Order (Chat Path)

```
Alex: "Set up a standing order of £800 to my landlord on the 1st of every month"
  -> AI resolves "landlord" to saved beneficiary (or asks to identify)
  -> AI: "I'll set up a monthly standing order:"
     [Confirmation Card:
       Standing Order
       To: David Landlord
       Amount: £800.00
       Frequency: Monthly on 1st
       First payment: 1 April 2026
       [Cancel] [Confirm]]
  -> Alex confirms
  -> AI: "Your standing order is set up. £800 will go to David Landlord on the 1st of each month.
         Your next payment is 1 April. I'll remind you the day before."

Total: 1 message + 1 confirmation tap
```

### View Standing Orders

```
Alex: "Show my standing orders"
  -> AI calls get_standing_orders tool
  -> AI: "You have 2 active standing orders:"
     [Standing Order Card: Rent | £800/month to David Landlord | Next: 1 Apr]
     [Standing Order Card: Savings | £500/month to Holiday Fund | Next: 28 Mar]
     "Want to edit or cancel any of these?"
```

### International Transfer (Chat Path -- Wise Integration)

```
Alex: "Send 200 euros to Maria in Spain"
  -> AI: "I'll set up an international transfer to Spain. Let me get you a quote."
  -> AI calls get_exchange_quote tool (GBP -> EUR, target amount: €200)
  -> AI: "Here's the exchange rate for your transfer:"
     [Quote Card:
       International Transfer
       Maria receives: €200.00
       You send: £171.43
       Exchange rate: 1 GBP = 1.1667 EUR (mid-market)
       Fee: £0.89
       Total cost: £172.32
       Delivery: 1-2 business days
       Rate valid for: 28 minutes]

  -> If Maria is not an international beneficiary:
     AI: "I don't have Maria's bank details for Spain. I'll need:
          - Full name as on their bank account
          - IBAN number"
     Alex: "Maria Garcia, IBAN ES12 3456 7890 1234 5678 9012"

  -> [Confirmation Card:
       Send International Transfer
       To: Maria Garcia (Spain)
       They receive: €200.00
       You pay: £172.32 (£171.43 + £0.89 fee)
       Rate: 1 GBP = 1.1667 EUR
       Delivery: 1-2 business days
       Balance after: £1,057.68
       [Cancel] [Confirm]]
  -> Alex confirms
  -> AI: "Your transfer is on its way! I'll notify you when Maria receives it."
     [Progress Card: Sent -> Processing -> Delivered | Est. delivery: 7-8 Mar]

Total: 2-4 conversational turns + 1 confirmation tap
```

### View Payment History (by Payee)

```
Alex: "Show me payments to James"
  -> AI calls get_payment_history tool (filtered by beneficiary: James Mitchell)
  -> AI: "Here are your recent payments to James Mitchell:"
     [Payment History Card:
       James Mitchell | 5 payments this month
       ─────────────────────────────
       £50.00  | 5 Mar  | Ref: Dinner
       £30.00  | 28 Feb | Ref: Taxi split
       £75.00  | 22 Feb | Ref: Birthday
       £20.00  | 15 Feb | Ref: Lunch
       £50.00  | 1 Feb  | Ref: Groceries
       ─────────────────────────────
       Total this month: £50.00 | Total last month: £175.00]
     "Tap any payment for full details. Want to send James another payment?"

Total: 1 message + instant response
```

### View Payment Summary (Aggregated)

```
Alex: "How much have I paid James this month?"
  -> AI: "You've sent James Mitchell £50.00 this month (1 payment).
         Last month it was £175.00 across 4 payments."
     [Quick Replies: "Show details" | "Send James money"]
```

### View Last Payment

```
Alex: "What was my last payment?"
  -> AI: "Your most recent payment was £50.00 to James Mitchell on 5 March.
         Reference: Dinner."
     [Payment Detail Card:
       £50.00 to James Mitchell
       Date: 5 Mar 2026, 19:32
       Reference: Dinner
       Status: ✓ Completed
       Balance after: £1,180.00]
```

### Track International Transfer Status

```
Alex: "Where's my transfer to Maria?"
  -> AI checks transfer status via Wise API
  -> AI: "Your transfer to Maria Garcia is being processed."
     [Progress Card:
       ✓ Sent (5 Mar, 14:30)
       → Processing (5 Mar, 14:35)
       ○ Delivered (estimated 7 Mar)]
```

---

## 3. AI Agent Capabilities

### Tools Required

| Tool | Type | Description |
|------|------|-------------|
| `send_payment` | Write | Send domestic GBP payment to a beneficiary |
| `get_payment_history` | Read | List past payments, filterable by payee, date range, or amount |
| `get_beneficiaries` | Read | List all saved payees |
| `add_beneficiary` | Write | Add a new domestic payee |
| `create_standing_order` | Write | Set up a recurring payment |
| `get_standing_orders` | Read | List active standing orders with next dates |
| `edit_standing_order` | Write | Change amount, frequency, or next date |
| `cancel_standing_order` | Write | Cancel a standing order |
| `get_exchange_quote` | Read | Get FX quote for international transfer (Wise) |
| `send_international_payment` | Write | Create and fund an international transfer |
| `get_transfer_status` | Read | Check status of a pending international transfer |
| `add_international_recipient` | Write | Add a recipient for international transfers |

### Example Multi-Turn Conversations

**Conversation 1: Quick payment with adjustment**
```
Alex: "Pay Sarah 50 quid"
AI: [Confirmation Card: Send £50.00 to Sarah Williams...]
Alex: "Wait, make it £75 and add reference 'birthday'"
AI: "Updated:"
    [Confirmation Card: Send £75.00 to Sarah Williams | Ref: Birthday...]
Alex: taps Confirm
AI: "Done! £75 sent to Sarah Williams. Happy birthday to them!"
```

**Conversation 2: Payment followed by balance inquiry**
```
Alex: "Send £200 to James"
AI: [Confirmation Card: Send £200.00 to James Mitchell...]
Alex: "Actually, what's my balance first?"
AI: "Your balance is £1,230. After this £200 payment, you'd have £1,030.
     Still want to send it?"
     [Quick Replies: "Yes, send it" | "Cancel"]
```

**Conversation 3: International transfer with natural language amounts**
```
Alex: "I need to send about 500 dollars to my friend in the US"
AI: "I'll check the exchange rate for GBP to USD."
    [Quote Card: $500 = £395.20 + £1.49 fee | Rate: 1 GBP = 1.2652 USD]
    "Who should I send it to?"
Alex: "Tom Baker"
AI: "I don't have Tom's US bank details. I'll need their:
     - Routing number (9 digits)
     - Account number
     - Account type (checking or savings)"
Alex: "Routing 021000021, account 123456789, checking"
AI: [Confirmation Card: Send $500 to Tom Baker (US) | You pay: £396.69...]
```

### Proactive Suggestions for This Journey

- **Repeated payee:** "You've paid James 3 times this month. Want to add him as a saved beneficiary?"
- **Standing order about to execute:** "Your rent of £800 goes out tomorrow. Your balance is £1,500."
- **Failed payment recovery:** "Your standing order to Gym Membership failed because of insufficient funds. Would you like to retry it now?"
- **FX rate alert:** "The GBP to EUR rate improved by 2% since your last transfer. Good time to send money to Maria?"
- **Payment pattern:** "You usually pay your credit card around the 15th. It's the 14th -- want me to prepare the payment?"

---

## 4. UX Requirements

### Key Screens

> **Chat card specs** (Confirmation Card, Success Card, Quote Card, Progress Card, Payment History Card, Payment Detail Card) are defined in the canonical Card Component Catalogue in `ai-chat.md`. This section covers only drill-down screens and full-screen native UI specific to Payments.

**Beneficiary List (Drill-down from Chat)**
- Recent payees at top (last 5 used)
- All payees alphabetically below
- Search bar for filtering
- Each entry: name, masked account number, sort code
- Tap to select for payment
- Long-press for edit/delete options

**Standing Orders Screen (Drill-down)**
- Active orders list with:
  - Recipient name
  - Amount and frequency (e.g., "£800/month")
  - Next payment date
  - Status indicator (active, paused)
- Tap to edit; swipe to cancel (with confirmation)
- "Create Standing Order" button

### Interaction Patterns

- **Beneficiary resolution:** AI fuzzy-matches names (case-insensitive, handles nicknames if mapped)
- **Amount formatting:** Accept natural formats: "50", "50.00", "£50", "fifty pounds", "50 quid"
- **Sort code formatting:** Accept "123456", "12-34-56", "12 34 56"
- **IBAN validation:** Real-time format checking with country-specific rules
- **Quick replies after payment:** "Send another?" | "Check balance" | "Done"

### Loading / Error / Empty States

- **Loading (payment processing):** "Sending your payment..." with subtle progress animation. Confirm button disabled.
- **Error (payment failed):** "The payment to James couldn't be processed. This might be a temporary issue." + Retry button
- **Error (invalid sort code):** "That sort code doesn't look right -- it should be 6 digits. Can you double-check?"
- **Empty (no beneficiaries):** "You don't have any saved payees yet. Want to add one?"
- **Empty (no standing orders):** "No standing orders set up. You can create one by saying 'Set up a standing order to [name] for [amount] every [frequency]'."

---

## 5. Technical Considerations

### API Capabilities

**Domestic Payments -- Griffin (real integration):**
- Create payment: `POST /v0/bank/accounts/{id}/payments`
- Submit payment: `POST /v0/bank/payments/{id}/submissions`
- Payee management: `POST/GET /v0/bank/legal-persons/{id}/payees`
- Faster Payments (FPS) for real-time domestic transfers

**International Payments -- Wise (new integration for POC):**
- Create quote: `POST /v3/profiles/{profileId}/quotes`
- Create recipient: `POST /v1/accounts`
- Create transfer: `POST /v1/transfers`
- Fund transfer: `POST /v3/profiles/{profileId}/transfers/{transferId}/payments`
- Get transfer status: `GET /v1/transfers/{transferId}`
- Simulate status changes (sandbox only): `GET /v1/simulation/transfers/{transferId}/...`

**Standing Orders & Direct Debits -- Mock:**
- Stored in Supabase `standing_orders` table
- Scheduled execution via Supabase function or API cron
- Generates synthetic transactions at defined intervals

### Real-Time Requirements

- Domestic payments should feel instant (FPS settles in seconds)
- Push notification on payment sent and received within 5 seconds
- International transfer status polling: every 60 seconds while in-app, webhook-driven when backgrounded
- Exchange rate quotes cached for the validity period (typically 28 min for Wise)

### What to Mock vs. Integrate

| Feature | POC Approach | Notes |
|---------|-------------|-------|
| Domestic payments (FPS) | Griffin sandbox (real) | Already integrated |
| Beneficiary management | Griffin sandbox (real) | Already integrated |
| International transfers | Wise sandbox (real) | New integration, ~2-3 days |
| Exchange quotes | Wise sandbox (real) | Real FX rates in sandbox |
| Standing orders | Mock in Supabase | Simulated scheduling |
| Direct debits | Mock in Supabase | Synthetic transactions |
| Confirmation of Payee (CoP) | Mock (name matching) | Real CoP requires Open Banking |
| Payment notifications | Real (via polling/webhook) | Griffin + Wise both support |
