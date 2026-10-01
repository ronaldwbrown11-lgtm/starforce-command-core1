# Capped Star Force Progression System

> **Star Force Base 1198 · Fleet Personnel Doctrine — Document SF-1198/PROG rev. A**
> Embeddable markdown. Render it in-app, on the docs site, or paste it into
> the Cadet Manual / FAQ surfaces as-is.

---

## 1 · System Overview

Every pilot who registers at Star Force Base 1198 enters the fleet as a **Tier 7
Ensign**. From there, advancement runs on two engines:

1. **The Induction Checklist** — Ensign → Lieutenant, awarded the moment your
   six introductory steps are verified at 100%.
2. **The XP Ladder** — Lieutenant → Lieutenant Commander → Commander →
   Captain (Fleet), unlocked by total XP milestones.

At the top sits the **flag officer tier**: **Rear Admiral**, a seat on the High
Command capped at **ten active seats**. Captains who reach 35,000 total XP join
the **Rear Admiral Queue** with *Rear Admiral Eligible* status and wait for an
open seat. Seats are awarded strictly by total XP, and officers who go idle for
45 consecutive days lose their seat to the next qualified Captain.

### Quick Start (new pilots)

1. **Complete Pilot Orientation** — callsign and fleet affiliation. You are
   stamped **Tier 7 Ensign**.
2. **Open the [High Command dashboard](/high-command)** — your induction
   checklist lives there.
3. **Finish the six induction steps** — profile, starship, fleet group, a
   story reaction, a field report, and your first badge. All six verified →
   **auto-promoted to Lieutenant**, where XP tracking begins.
4. **Earn XP** — daily activity (20–30, capped at 50/day), weekly operations,
   approved lore, published stories, and featured pins.
5. **Climb to 23,000 XP → Captain (Fleet)**, bank Prestige XP past 35,000, and
   **wait your turn** on the Admiral Queue.

**Rule zero: XP is never lost.** No promotion, queue wait, or seat change ever
reduces your total.

---

## 2 · Complete XP & Rank Progression Table

| Tier | Rank | Total XP required | Delta | Notes |
|------|---------------------|-------------------|-------|-------|
| 7 | **Ensign** | 0 | — | Entry rank on registration. Promoted by **100% onboarding checklist** — XP alone cannot move an Ensign. |
| 8 | **Lieutenant** | 1,500 | +1,500 | Checklist promotion unlocks XP tracking; reaching 1,500 XP is the next gate. |
| 9 | **Lieutenant Commander** | 4,000 | +2,500 | Runs a department. |
| 10 | **Commander** | 9,000 | +5,000 | Runs a deck. |
| 11 | **Captain (Fleet)** | 23,000 | +14,000 | Commands a ship. Excess XP above **35,000** is held as **Prestige XP** while waiting on the Rear Admiral Queue. |
| 13 | **Rear Admiral** | 35,000 | +12,000 | **FLAG OFFICER — hard cap of 10 active seats.** *(Tier 12 is intentionally unused.)* |

### XP earning rates

| Activity | XP range | Gate |
|------------------------------|----------------|----------------------------------------------|
| Daily activity & engagement | **20–30** | **Hard cap: 50 XP/day** (UTC window) |
| Weekly operations & missions | 100–150 | — |
| Lore & encyclopedia submissions | 150–250 | Requires review/approval |
| Published stories / canon submissions | 300–500 | Requires publication |
| Featured bridge story pin | 750 | Milestone award |

*Paid membership tiers multiply every award (1.25×–3×) and XP Surge boosts
double it — the daily engagement cap still applies after multipliers.*

### Rear Admiral seat rules

- **Hard cap:** maximum **10 active seats**, ever.
- **Award:** if active seats < 10, the **highest total-XP** eligible Captain
  (≥35,000) on the waitlist is promoted automatically by the daily queue
  evaluation.
- **Waitlist:** when all 10 seats are full, qualified Captains stay at
  Captain (Fleet) with **Rear Admiral Eligible** status. Position = total XP.
- **Inactivity decay:** 45 consecutive days with **zero platform XP** →
  seat revoked → **Inactive Flag Officer** status → the top-ranked eligible
  Captain takes the open seat. Earning XP again returns you to the waitlist.
- **Prestige XP:** everything a waiting Captain earns above 35,000 is banked
  and shown separately; it still counts toward waitlist ranking.

---

## 3 · FAQ

### How do I rank up from Ensign?
Complete the induction checklist at **100%**: set up your profile, assign a
starship, join a fleet group, react to a story, file a field report, and earn
your first badge. Every step is verified server-side against your real
activity — when the sixth step lands you are **automatically promoted to
Lieutenant**, and numerical XP tracking begins. Track it live on
`/high-command`.

### What happens when I hit 35,000 XP at Captain rank?
You are placed on the **Rear Admiral Queue** with *Rear Admiral Eligible*
status. All XP above 35,000 is held as **Prestige XP** — visible, retained,
and counted toward your waitlist ranking — while you wait for an open seat.
Nothing is deducted; your displayed total keeps climbing.

### How are the 10 Rear Admiral seats awarded?
The cap is absolute: **ten active Rear Admiral seats**. A daily evaluation of
the queue checks for open seats (through inactivity revocations or growth) and
promotes the **highest-total-XP** eligible Captain at 35,000+ XP. If all ten
seats are occupied, qualified Captains simply remain at Captain (Fleet) with
*Rear Admiral Eligible* status and keep their place in line.

### What happens if a Rear Admiral becomes inactive?
After **45 consecutive days with zero XP**, inactivity decay triggers: the
seat is revoked, the officer is shifted to **Inactive Flag Officer** status,
and the top-ranked eligible Captain is promoted into the vacancy immediately.
A revoked flag officer keeps all their XP and rejoins the waitlist as soon as
they earn XP again.

### Do I lose my XP if I am waiting for an Admiral seat?
**No.** XP is monotonic in the Star Force economy — it never decreases.
Waiting Captains keep every point, bank excess above 35,000 as Prestige XP,
and are ranked on the waitlist by their full total.

---

## Appendix A · Technical Architecture & Data Model (Deliverable A)

### A.1 Data model

Implementation lives in Convex (`src/convex/schema.ts`), typed by
`src/lib/ranks.ts` as the canonical ladder. Equivalent relational/JSON shape:

```jsonc
{
  "users": {
    "_id": "users:...",
    "displayName": "Vega Seven",
    "xp": 24310,                 // total XP (never decreases)
    "rankKey": "captain",        // system-managed ladder key
    "rank": "Captain (Fleet)",   // display string, synced on promotion
    "lastXpAt": 1770000000000,   // last XP grant — inactivity clock
    "prestigeXp": 120310 - 35000 // excess above 35,000 (mirror)
  },

  "ranks": [                     // rank catalog (seeded from RANK_LADDER)
    { "key": "ensign",  "tier": 7,  "label": "Ensign",             "minXp": 0,     "order": 0, "flagOfficer": false },
    { "key": "lieutenant", "tier": 8, "label": "Lieutenant",       "minXp": 1500,  "order": 1, "flagOfficer": false },
    { "key": "lieutenant_commander", "tier": 9,  "minXp": 4000,    "order": 2 },
    { "key": "commander", "tier": 10, "minXp": 9000,               "order": 3 },
    { "key": "captain", "tier": 11, "minXp": 23000,                "order": 4 },
    { "key": "rear_admiral", "tier": 13, "minXp": 35000,           "order": 5,
      "flagOfficer": true, "maxActiveSeats": 10 }
  ],

  "xpLedger": [                 // "UserXP" — one row per grant
    { "userId": "users:...", "amount": 25, "source": "daily_activity",
      "category": "daily", "day": "2026-10-01", "createdAt": 1770000000000 }
  ],

  "onboardingTasks": [          // "OnboardingTasks" — audit trail
    { "userId": "users:...", "taskKey": "profile",
      "label": "Set up your pilot profile",
      "completedAt": 1770000000000 }
  ],

  "admiralQueue": [             // "AdmiralQueue" — waitlist + seat registry
    { "userId": "users:...", "status": "waiting",   // waiting | active | inactive_flag_officer
      "totalXp": 36500, "joinedAt": 1770000000000,
      "seatGrantedAt": null, "seatRevokedAt": null, "lastXpAt": 1770000000000 }
  ]
}
```

### A.2 Backend endpoints

| Spec endpoint | Convex mapping | Kind |
|---|---|---|
| `POST /api/onboarding/complete` | `progression.onboardingComplete` | public mutation (client + internal) |
| `POST /api/xp/add` | `internal.progression.addXp` | internal mutation (server-to-server) |
| `POST /api/admiral-queue/evaluate` | `internal.progression.evaluateAdmiralQueue` | internal mutation, registered as a **daily cron** (`cronJobs.ts`, 05:30 UTC) |

Supporting reads: `progression.myProgress`, `progression.council`,
`progression.ranksCatalog`, `social.rankProgress`.

#### Pseudocode — `onboarding/complete`

```
handler(taskKey):
  require authenticated user
  step ← lookup taskKey in ONBOARDING_STEPS            # profile/ship/group/react/report/badge
  done ← deriveChecklist(user)                         # REAL activity, never stored flags
  if not done[step]: reject "step not complete"
  insert onboardingTasks row (idempotent per user+task)
  if all steps done and user.rankKey in {ensign, null}:
      promote → rankKey = "lieutenant", rank = "Lieutenant"
      notify + activity feed + audit log
  return { completedCount, allDone, promoted, rankKey }
```

#### Pseudocode — `xp/add`

```
handler(userId, amount, source, category):
  category ← valid category else "other"
  amount   ← clamp(amount, XP_RATES[category].min, XP_RATES[category].max)
  granted  ← round(amount × tierMultiplier(user) × surge)
  if category == "daily":
      usedToday ← SUM(xpLedger.amount WHERE userId AND day = UTC today)
      granted   ← min(granted, 50 − usedToday)         # hard 50 XP/day cap
      if granted ≤ 0: return { granted: 0, capped: true }
  xp_total ← user.xp + granted
  patch user { xp: xp_total, lastXpAt: now,
               prestigeXp: max(0, xp_total − 35000) }
  insert xpLedger row
  evaluate ladder → patch rankKey/rank up to Captain (Fleet)
      # Ensign→Lieutenant is checklist-gated, handled ONLY by onboarding/complete;
      # Rear Admiral is granted ONLY by the queue evaluator — never by XP alone.
  if xp_total ≥ 35000 and no queue row: insert admiralQueue { status: "waiting" }
  return { granted, totalXp, rankKey, capped }
```

#### Pseudocode — `admiral-queue/evaluate` (cron, daily)

```
handler():
  seed ranks catalog if empty
  activeCount ← count(admiralQueue where status = "active")

  # 1 · inactivity decay (45 consecutive days with zero XP)
  for row in admiralQueue where status = "active":
      lastXp ← user.lastXpAt ?? row.seatGrantedAt ?? row.joinedAt
      if now − lastXp > 45 days:
          row.status ← "inactive_flag_officer"; row.seatRevokedAt ← now
          user.rankKey ← "captain"                      # back to Captain (Fleet)
          notify user; audit log; activeCount −−

  # 2 · reactivate flag officers who earned XP again
  for row where status = "inactive_flag_officer":
      if user.lastXpAt > row.seatRevokedAt: row.status ← "waiting"

  # 3 · seat assignment — HARD CAP 10
  open ← 10 − activeCount
  candidates ← rows where status = "waiting" AND user.xp ≥ 35000
  sort candidates by user.xp DESC
  for top `open` candidates:
      row.status ← "active"; row.seatGrantedAt ← now
      user.rankKey ← "rear_admiral"; notify + audit

  # 4 · rank healing: promote Ens whose checklist hit 100%, stamp legacy accounts
  for user where rankKey missing or rankKey == "ensign":
      evaluateMember(user)
```

### A.3 Frontend surfaces (Deliverable B)

`src/pages/HighCommand.tsx` → route **`/high-command`**:

- **Rank badge & XP progress bar** — tier chip, current rank, progress toward
  the next rank (checklist-based for Ensigns), Prestige XP and queue-status
  pills, and today's engagement-XP meter against the 50/day cap.
- **Ensign induction checklist widget** — six derived steps with
  server-verified *Mark complete* actions; 100% triggers the promotion toast.
- **High Command Council Table** — the ≤10 active Rear Admirals (with open
  seat placeholders), plus the top 5 Captains on the promotion waitlist.
- **Progression ladder + XP rate tables** and the **FAQ**.

### A.4 Rank presentation & operator controls

- **Rank renders beside the member's name** on their profile (`/u/:id`) and
  on the High Command badge/ladder — with the operator-managed insignia image
  when one has been uploaded.
- **Members can no longer choose or edit ranks.** The rank field was removed
  from the dossier editor and from `users:updateProfile` server-side; rank
  changes only come from the progression engine (checklist/XP) or an
  operator's manual assignment.
- **Rank Ladder console** (`/operator/ranks`, capability `operator` /
  `senior_operator`):
  - upload / replace / remove an **insignia image per rank** — including
    ranks you **create** for future commissions (label, tier, min XP, blurb,
    image at creation);
  - rename any rank (label override stored in the `ranks` table, applied
    everywhere via `resolveDisplayRank`);
  - **manual promotion**: search a member → pick any rank → apply. Seat rules
    still hold — promoting to Rear Admiral consumes one of the 10 seats and
    the hard cap is enforced; demoting an admiral releases the seat back to
    the waitlist.
- Canonical ladder thresholds (1,500 / 4,000 / 9,000 / 23,000 / 35,000) are
  doctrine enforced by `src/lib/ranks.ts` and are not editable; custom ranks
  are manual-assignment only — the XP evaluator never awards them.

### A.5 Where the code lives

| Concern | File |
|---|---|
| Ladder, rates, derivation helpers | `src/lib/ranks.ts` |
| Schema (`ranks`, `xpLedger`, `onboardingTasks`, `admiralQueue`, user fields) | `src/convex/schema.ts` |
| XP pipeline: ledger, daily cap, promotions, Prestige XP | `src/convex/economy.ts` (`applyXpGain`) |
| Endpoints + dashboard queries | `src/convex/progression.ts` |
| Daily queue cron | `src/convex/cronJobs.ts` |
| Daily engagement XP + lazy evaluation | `src/convex/engagement.ts` (`touchStreak`) |
| Dashboard UI | `src/pages/HighCommand.tsx` |
| Operator Rank Ladder console (images, creation, manual promotion) | `src/convex/rankAdmin.ts`, `src/pages/operator/Ranks.tsx` |
| Display-rank resolution (profile name, insignia) | `resolveDisplayRank` in `src/convex/progression.ts` |
