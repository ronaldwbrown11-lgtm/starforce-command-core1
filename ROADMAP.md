# Product Roadmap — Star Force Base 1198

Working backlog for features that are designed and approved but not yet built.
Each item carries enough spec that a future session can implement it without
re-discovery. Ordered by priority.

---

## Phase 2 — Ship Crews (approved, not built)

**Idea:** Named ships become social via **crew rosters** — structurally separate
from community groups.

**Model:**

- The ship owner (pilot) is the **captain** and invites members to serve aboard
  their named ship.
- Roster lives on the ship card / ship dashboard: crew list with rank/berth
  per member.
- Capped small (suggest ~10 berths per ship); captain-controlled join/leave.
- Not a `groups` row — separate table (e.g. `shipCrew`: shipOwnerId + crewUserId
  + berth/rank + joinedAt) so group moderation tools never touch it.
- Cross-links: Fleet Registry ship cards show crew count; profile ship card
  links to the roster.

**Prerequisite:** Ship-name uniqueness check (cheap win) — two pilots can
currently both name their ship "Vindicator"; add a case-insensitive server-side
uniqueness check with a "that name is already registered to another hull"
nudge. Do this first, it's also standalone.

**Context:** Decided 2026-09-08 while building the affiliation auto-join
(35 ship-affiliation groups seeded from the wizard's step-4 catalog). Ship
*names* (custom hull names) and *classes* (53 canon hulls) were deliberately
excluded from becoming groups — too granular, one-member ghost towns.

**Status (2026-09-08):** Operator chose the original plan — crews stay a
separate roster system, NOT groups. Parked for later implementation; the
reminder card lives on the Operator Dashboard under "On the drawing board"
so it isn't forgotten.

---

## Creator Collaboration (approved, not built)

**Idea:** Creators build together instead of alone — shared drafts on top of
the Creator Hub.

**Model:**

- A draft carries a **collaborator list** (`collabInvites`: draftId + userId +
  role + invitedAt). Only the draft owner can invite or remove people.
- Collaborators with the `editor` role can change the draft body and its lore
  attachments. The **owner stays the single accountable author** — one
  submission, one approval record, so canon review never has two claimants.
- Revision history is append-only per draft, so operators can see who changed
  what before anything enters the review queue.
- Review handoff reuses the existing canon queue and audit log — no new
  moderation surface.

**Status (2026-10-06):** Listed on Operator Console → The Road Ahead under
"Community & collaboration", and on the Operator Dashboard under "On the
drawing board". Not started.

---

## Live Chat (approved, not built)

**Idea:** Real-time comms on the base, moderatable with the tools the console
already has.

**Model:**

- Channels first (`chatChannels`: slug + scope `fleet` | `sector` | `group` +
  tier gate), so rooms map onto structures that already exist rather than a
  new social graph.
- Messages live in a capped `chatMessages` table with a retention window, so
  the table cannot grow without bound.
- Realtime is free: Convex queries give the live subscription — no separate
  socket server or third-party chat provider.
- Moderation routes through the existing `moderationItems` queue and audit
  log; operator delete is a soft delete with the reason recorded.
- Presence is best-effort (heartbeat on a `chatPresence` row), never
  authoritative.

**Status (2026-10-06):** Listed on Operator Console → The Road Ahead under
"Community & collaboration", and on the Operator Dashboard under "On the
drawing board". Not started.

---

## Backlog — smaller wins

- **Ship-name uniqueness check** — see prerequisite above; can ship
  independently.
- **Faction ↔ group cross-links** — ship cards link to their barracks group
  and group pages link back to the faction registry entry (both systems share
  names/accents already).
