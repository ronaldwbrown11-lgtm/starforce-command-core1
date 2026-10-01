# SIGNAL DECODER FIELD MANUAL

**Star Force Base 1198 — Lore Library (Restricted)**

| | |
| --- | --- |
| **Classification** | RESTRICTED — operators & cleared signals personnel only |
| **Manual ref** | LP-9 / SIG-DEC-01 |
| **Revision** | 1.0 |
| **Author** | Inka Tess (Outer Belt) |
| **Scope** | Decoding the nine-minute repeating signal patterns logged by the listening-post network |

> **Handling notice.** This manual describes intercept *methods*. Actual
> intercepts, raw logs, and waveform captures stay inside restricted channels.
> Share the method freely; never share the capture.

---

## 0. Quick reference

- The **nine-minute signal** is a pattern that repeats every **540 seconds**
  across at least a dozen listening posts. First recorded **2241**. Origin
  **unidentified**.
- A post's **report cadence** (every 9 hours) and the signal's **cycle
  length** (9 minutes) are different things. Do not conflate them in logs.
- Every capture is indexed in the **Signal Intelligence Database** by
  **origin** and **cycle** before any decoding attempt is filed.
- New analysts solve most practice intercepts with the five ciphers in §3.
  If a decode fails three passes, escalate (§6) — do not improvise on raw
  intercepts.

---

## 1. Purpose and scope

This manual is the operator-side procedure for reading, decoding, and filing
the repeating signal patterns logged by the **listening-post network** — the
scattered ring of unattended posts that sweep the Terran Reach, the Outer
Belt, and the Darkspire Expanse and roll their logs up to a shared database.

It covers:

1. What counts as a signal versus background traffic (§2)
2. How to capture and index a clean log (§3 pre-decode protocol)
3. The five standard decode methods (§4)
4. What is known about the nine-minute cycle itself (§5)
5. Reporting, escalation, and rewards (§6)
6. Classification rules for what you may share (§7)

It does **not** cover post hardware maintenance (senior-operator badge
required for physical access) or campaign operations for the current Signal
Vault season — see the Vault's phase timeline for that.

---

## 2. Signal taxonomy

Every post logs roughly **thirty signals a night**. Most of it is noise.

| Class | Name | Description | Action |
| --- | --- | --- | --- |
| **C-0** | Background hum | Steady carrier noise, thermal hiss, planetary bleed | Log only; no decode |
| **C-1** | Transient | One-off burst, no repeat within the observation window | Log; mark `transient` |
| **C-2** | Repeating pattern | Recurs on a measurable cycle; candidate for decode | **Index + decode (§4)** |
| **C-3** | Nine-minute echo | C-2 whose cycle lands on 540 s ± 2 s | **Priority decode + escalate** |

Of ~30 signals a night, roughly **a dozen** across the network resolve to
C-2 or higher. A pattern only earns C-3 when at least **two posts** report
the same cycle in the same window — single-post 540 s hits are logged as
C-2 pending corroboration.

### Naming

`ORIGIN-CYCLE-SEQ` — e.g. `COR4-540-017` = Corridor 4 origin, 540-second
cycle, 17th capture. Use the same key everywhere: database row, field
report, and Vault submission.

---

## 3. Capture and indexing protocol

1. **Normalize time to UTC.** Posts drift; the network's rollup assumes UTC.
2. **Window the capture.** Minimum three full cycles (≥ 27 minutes) before
   any decode attempt. Two cycles is a coincidence, not a pattern.
3. **Index first, decode second.** File the row in the **Signal
   Intelligence Database** (origin, cycle, capture window, post ID) before
   touching the ciphertext. A decode filed before indexing is a rumor.
4. **Keep the raw.** Store the untouched capture alongside every worked
   decode. Re-derivation is part of the review.
5. **Corroboration check.** Query the database for matching cycles at other
   posts in the same window. Note the count in the log — it decides your
   class (§2) and your escalation path (§6).

### Log template

```
Key:        ORIGIN-CYCLE-SEQ
Post:       <post id>            Window (UTC): <start> → <end>
Cycles:     n × ____ s           Class: C-__ (corroborated by __ posts)
Method:     <caesar/atbash/a1z26/reversed/keyboard/unknown>  Shift/dir: ____
Plaintext:  ____________________
Raw ref:    <database row id>
Notes:      ____________________
```

---

## 4. Decode methods

The network's intercepts rotate through five encodings. The intercept's own
**hint line names the method** — and for Caesar, names the shift. Never
guess a method on a restricted capture without the hint.

### 4.1 Caesar shift

Every letter moves `n` places through the alphabet; the hint states `n`.
**Worked example (shift 9 — the house shift):**

```
Ciphertext:  LHLUN LXWCRWDNB
Decode:      +9 per letter (W→F wraps to the front of the alphabet)
Plaintext:   CYCLE CONTINUES
```

### 4.2 Atbash

A↔Z, B↔Y, C↔X … mirror the alphabet. No shift value to carry.

```
Ciphertext:  HRTMZO
Decode:      Atbash mirror
Plaintext:   SIGNAL
```

### 4.3 A1Z26

Letters as numbers, 1–26, usually hyphen-separated.

```
Ciphertext:  14-9-14-5
Decode:      A1Z26
Plaintext:   NINE
```

### 4.4 Reversed text

The hint says "read it backwards." Reverse the whole string; then apply any
secondary method the hint names.

```
Ciphertext:  noitcyc eht
Decode:      reverse
Plaintext:   the cycle
```

### 4.5 Keyboard shift

Each letter replaced by its neighbour **on the keyboard row**, direction
stated in the hint. Left-shift example:

```
Ciphertext:  KUARWB            (each key one position LEFT)
Decode:      keyboard shift, one position right
Plaintext:   LISTEN
```

### Failure rule

Three failed passes on the same capture → stop, file the raw row, escalate
per §6. Do **not** chain methods on a restricted capture; chained encodings
outside the five standard methods are not canon and will be rejected at
review.

---

## 5. The nine-minute cycle — what is known

- **First recorded 2241.** The pattern repeats every nine minutes across at
  least a dozen listening posts. **Origin remains unidentified.**
- The cycle is **540 seconds ± 2 s** at every post where it has been
  measured — no dispersion measured to date.
- **Corridor 4 echo.** *Vanguard Sovereign* logged a repeating echo in
  Corridor 4 matching the 9-minute cycle reported by the network. Signal
  origin unidentified. **No hostile action detected.** Corroborated
  captures like this are the strongest C-3 evidence we hold.
- **Cadence vs. cycle.** Posts roll their databases up **every nine hours**;
  the signal itself cycles **every nine minutes** — roughly 600 repetitions
  between rollups. Analysts who mix the two produce false C-3s.
- **Standing posture.** No name has been assigned to the source. Until the
  origin is resolved, intercepts are logged as `unidentified` — not as a
  faction, vessel, or phenomenon.

### Observation record (template)

| Window (UTC) | Posts reporting | Cycles seen | Class | Notes |
| --- | --- | --- | --- | --- |
| ____ → ____ | ____ / 12+ | ____ × 540 s | C-__ | ____ |

---

## 6. Reporting and escalation

| Situation | Path |
| --- | --- |
| C-0 / C-1 | Log only. No report needed. |
| C-2, uncorroborated | Index in the Signal Intelligence Database; decode per §4; attach to the log. |
| C-3 or corroborated C-2 | Index + decode **and** file a field report; notify the **Listening Post Ops** group (private, intel channel). |
| Decode succeeds but plaintext references fleet movement, or a hint is missing on a restricted capture | Escalate to operators immediately — do not post in public channels. |

Filing a field report on an accepted signal earns **XP and Star Credits**
under the standard activity rates. Repeated, well-formed C-3 filings are
how the fleet notices a signals analyst — quality of indexing beats volume
of guesses.

---

## 7. Classification rules

- **RESTRICTED (this manual):** decode methods, cycle tables, escalation
  paths. May be discussed with cleared personnel; the file itself stays in
  the Lore Library behind its classification tag.
- **RESTRICTED (intercepts):** raw captures, waveforms, plaintext of C-3
  decodes. Restricted channels only — never the public forums, never
  screenshots in open chats.
- **OPEN:** the *existence* of the nine-minute signal (already public lore),
  method tutorials from §4 with made-up practice ciphertext, and anything
  explicitly marked open in the Lore Library.

When in doubt: **describe the method, not the intercept.**

---

## 8. Appendix A — Glossary

| Term | Meaning |
| --- | --- |
| **Listening post** | Unattended logging node of the network; quarterly maintenance rotation, senior-operator badge for physical access. |
| **Cycle** | Measured repeat interval of a pattern, in seconds. |
| **Cadence** | How often a post rolls logs up to the shared database (9 hours). |
| **C-0 … C-3** | Signal classes (§2). |
| **Corroborated** | Same cycle reported by ≥ 2 posts in the same window. |
| **Rollup** | The 9-hour database sync. |
| **Nine-minute signal** | The 540 s repeating pattern, first recorded 2241, origin unidentified. |
| **Vault** | The Signal Vault — where live season signals are published and solved. |

## 9. Appendix B — Cross-references

- **Lore:** *The Nine-Minute Signal* (restricted event entry),
  *The Listening Post Network* (artifact entry), *Darkspire Notes* (Field
  Notes series — thirty signals a night, a dozen repeating).
- **Database:** Signal Intelligence Database — rolling archive of captures,
  indexed by origin and cycle.
- **Transmissions:** *Lore Deep Dive: The Listening Post Network*.
- **Operations:** Signal Vault — current season's phase timeline and live
  signals. Listening Post Ops group — private intel channel for C-3 flow.
- **Fleet record:** *Vanguard Sovereign* Corridor 4 echo report.

---

*Signal Decoder Field Manual — LP-9 / SIG-DEC-01, rev 1.0. Compiled by
Inka Tess for the Star Force Base 1198 Lore Library. Classification:
RESTRICTED.*
