STAR FORCE NIGHTHAWK VEHICLE DATABASE
======================================

Files:
- index.html: public vehicle browser and submission form
- api.php: copy from the project file nighthawk-api.php
- config.php: copy from config.example.php and fill in Hostinger values

Installation:
1. Upload this folder's index.html to the Nighthawk subdomain public_html.
2. Upload nighthawk-api.php as api.php.
3. Upload config.example.php as config.php.
4. Edit config.php with the existing MySQL database name, user, and password.
5. Confirm the database table is named vehicles.
6. Open https://nighthawk.starforcebase1198.com/.

The browser reads only rows whose review_status is approved.
New submissions are written with review_status submitted and remain hidden
until an operator reviews them. The operator review endpoint is available at
api.php?action=pending and api.php?action=review, protected by the operator
bridge key in config.php.

Do not put database passwords in index.html or share config.php publicly.
No table is created, cleared, or reseeded by this package.
