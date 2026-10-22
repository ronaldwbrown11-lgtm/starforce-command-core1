<?php
/**
 * Star Force Armory — shared MySQL credentials
 * --------------------------------------------
 * weapons.php and weapons-sync.php both `require` this file from the same
 * folder. Upload it ONCE and fill in the password below; after that you can
 * overwrite either endpoint with a new version and the credentials survive.
 *
 * Set 'pass' to the password for the MySQL user `u102692168_Seven` on
 * `u102692168_Star_Force` (Hostinger -> Databases). The same password works
 * for fleetregistry-api.php / records.php on this hosting account, so it can
 * be copied from any of those files.
 *
 * KEEP THE SINGLE QUOTES. Inside single quotes a `$` in the password stays
 * literal; inside double quotes PHP treats `$word` as a variable and the
 * password silently becomes wrong. The only characters needing an escape are
 * a backslash (\\), which single quotes eat, and an apostrophe ('), which
 * must be written \'.
 *
 * CHECK IT BEFORE YOU TOUCH ANYTHING ELSE:
 *   https://armory.starforcebase1198.com/armory-config.php?check=1
 *   -> {"success":true,"database":"connected","file":"armory-config-v1"}
 * That proves the password is right without overwriting a working endpoint.
 * The password itself is never printed.
 */

$__armoryConfig = [
    'host' => 'localhost',
    'name' => 'u102692168_Star_Force',
    'user' => 'u102692168_Seven',
    'pass' => 'PASTE_PASSWORD_HERE',
];

// Self-check, only when this file is requested directly (the endpoints define
// ARMORY_CONFIG_INCLUDE before requiring it, so ?check=1 on an endpoint can
// never interrupt a real API response).
if (!defined("ARMORY_CONFIG_INCLUDE") && isset($_GET["check"])) {
    header("Content-Type: application/json; charset=utf-8");
    header("Cache-Control: no-store");
    $pass = (string) $__armoryConfig["pass"];
    if (in_array($pass, ["", "CHANGE_ME", "PASTE_PASSWORD_HERE"], true)) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => "Password not filled in. Edit the \"pass\" line in this file, save, upload, reload this URL.",
            "file" => "armory-config-v1",
        ]);
        exit;
    }
    $host = (string) $__armoryConfig["host"];
    $name = (string) $__armoryConfig["name"];
    $user = (string) $__armoryConfig["user"];
    try {
        new PDO(
            "mysql:host=" . $host . ";dbname=" . $name . ";charset=utf8mb4",
            $user,
            $pass,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        echo json_encode([
            "success" => true,
            "database" => "connected",
            "host" => $host,
            "db" => $name,
            "user" => $user,
            "file" => "armory-config-v1",
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "error" => "MySQL rejected these credentials. Copy the exact password used by fleetregistry-api.php / records.php.",
            "file" => "armory-config-v1",
        ]);
    }
    exit;
}

return $__armoryConfig;
