<?php
/**
 * Star Force Armory — weapons API (read-only)
 * -------------------------------------------
 * Reads the canon arsenal from the MySQL `weapons` table and returns it as
 * JSON. This is the endpoint the Lore Library browser and the Armory app
 * both read from. CORS is included so the main site can fetch it.
 *
 * INSTALL
 *   1. Upload to armory.starforcebase1198.com as weapons.php
 *      (replace the broken copy — back it up first if you like).
 *   2. Fill in the database credentials below (same DB as weapons-sync.php).
 */

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

// ---------------------------------------------------------------------------
// Hostinger MySQL credentials — fill these in.
// ---------------------------------------------------------------------------
$DB_HOST = "localhost";
$DB_NAME = "u102692168_Star_Force";
$DB_USER = "u102692168_Seven";
$DB_PASS = "CHANGE_ME";
// ---------------------------------------------------------------------------

// GET only.
if (($_SERVER["REQUEST_METHOD"] ?? "GET") !== "GET") {
    http_response_code(405);
    echo json_encode(["success" => false, "error" => "Method not allowed.", "file" => "weapons-read-v2"]);
    exit;
}

try {
    $pdo = new PDO("mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database connection failed. Check credentials in this file.", "file" => "weapons-read-v2"]);
    exit;
}

$rows = $pdo->query(
    "SELECT id, designation, category, builder, registry_number, status, fleet,
            effective_range, rate_of_fire, primary_spec, created_at, updated_at
     FROM weapons
     ORDER BY category, designation"
)->fetchAll();

$out = array_map(static function ($r) {
    return [
        "id" => $r["id"],
        "designation" => $r["designation"],
        "category" => $r["category"],
        "builder" => $r["builder"],
        "registry_number" => $r["registry_number"],
        "status" => $r["status"],
        "fleet" => $r["fleet"],
        "effective_range" => $r["effective_range"],
        "rate_of_fire" => $r["rate_of_fire"],
        "primary_spec" => $r["primary_spec"],
        "created_at" => $r["created_at"],
        "updated_at" => $r["updated_at"],
    ];
}, $rows);

echo json_encode(["success" => true, "records" => $out, "file" => "weapons-read-v2"], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
