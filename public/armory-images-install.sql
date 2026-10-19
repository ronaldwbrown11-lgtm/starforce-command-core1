-- ============================================================================
--  Star Force Armory — install the `images` column
-- ----------------------------------------------------------------------------
--  What this does: adds ONE nullable column (`images`) to the weapons table
--  that armory.starforcebase1198.com reads. Idempotent-ish: if the column
--  already exists MySQL reports "Duplicate column name" — that is a SUCCESS.
--
--  How to run (phpMyAdmin, 3 clicks):
--    1. hPanel -> Databases -> phpMyAdmin (for u102692168_Star_Force)
--    2. Click the "Import" tab at the top
--    3. Browse -> select this file -> Go
--
--  The statements are fully database-qualified, so it does not matter which
--  database/table is selected in the left tree.
-- ============================================================================

ALTER TABLE `u102692168_Star_Force`.`weapons`
  ADD COLUMN `images` MEDIUMTEXT NULL AFTER `damage_radius`;
