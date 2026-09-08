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

## Backlog — smaller wins

- **Ship-name uniqueness check** — see prerequisite above; can ship
  independently.
- **Faction ↔ group cross-links** — ship cards link to their barracks group
  and group pages link back to the faction registry entry (both systems share
  names/accents already).
