# Fleet Registry archive migration

The Fleet Registry is `https://fleetregistry.starforcebase1198.com` and uses the existing MySQL database `u102692168_Star_Force`.

## Existing tables preserved

- `vessels` is read-only to this migration and remains unchanged.
- `vessel_variants` is read-only to this migration and remains unchanged.
- The foreign key uses the existing `vessels.id` primary key.
- No database is created, dropped, truncated, or reset.

## Deployment

1. Back up the existing database.
2. Upload `fleetregistry-api.php` as an endpoint within the Fleet Registry application.
3. Configure the existing database host, user, and password in the deployment-only config file. Do not place it in the public source archive.
4. Point the Fleet Registry frontend at the endpoint.
5. The endpoint creates the three tables with `CREATE TABLE IF NOT EXISTS` on each startup.
6. Any optional seed importer must use `INSERT ... WHERE NOT EXISTS` / unique keys. It must never update or delete existing records.

## Tables

- `service_histories(vessel_id, event_date, event_type, title, details, location, source_reference)`
- `armament_sheets(vessel_id, title, primary_armament, secondary_armament, defensive_systems, ammunition_notes, classification)`
- `black_box_files(vessel_id, file_code, title, incident_date, classification, summary, payload)`

All three tables use foreign keys with `ON UPDATE CASCADE` and `ON DELETE RESTRICT`. A vessel cannot be deleted while archive records reference it.

## Access rules

- Public users can read service histories and armament sheets.
- Black-box files are returned only after an authenticated operator session is established.
- Create, update, and delete operations require the existing Fleet Registry operator login and CSRF token.
- The API uses prepared statements and validates vessel IDs against `vessels` before writes.

## Safe reassignment

Use the operator-only `action=reassign` endpoint with `from_vessel_id` and `to_vessel_id`. It verifies that both IDs exist, updates all three archive tables inside one transaction, and rolls back all changes if any update fails. It does not change either vessel row or any vessel variant.

## Important limitation

This repository can provide the migration/API package and main-site card design, but it cannot upload files to Hostinger or alter the live Fleet Registry deployment. After deploying the endpoint and frontend bundle, verify:

- `GET action=vessels` returns the existing vessel IDs.
- `GET action=archives&vessel_id=<id>` returns service and armament records.
- The same request while signed out does not return `black_box_files`.
- Operator CRUD works with CSRF.
- Reassignment moves linked rows and leaves `vessels` and `vessel_variants` unchanged.
