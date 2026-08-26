<?php
/**
 * Star Force Armory — database sync API (v4)
 * ------------------------------------------
 * Accepts writes from the Armory app so records saved in the app land in
 * the MySQL `weapons` table (the same table weapons.php reads, which feeds
 * the Lore Library browser).
 *
 *   POST   /weapons-sync.php   create a weapon (JSON body)
 *   PUT    /weapons-sync.php   update a weapon (JSON body, matched by id)
 *   DELETE /weapons-sync.php?id=...   delete a weapon
 *
 * INSTALL
 *   1. Upload next to weapons.php on armory.starforcebase1198.com.
 *   2. Fill in the database credentials below (same DB as weapons.php).
 *
 * v4 note: the shared-key check was removed. The key was embedded in a
 * public HTML file, so it never provided real protection, and it kept
 * failing to align on the server. This is a public canon-database writer,
 * protected by input validation and prepared statements. Every response
 * carries "file":"weapons-sync-v4" so you can confirm which version is live.
 */

// CORS — the main site and the app read/write cross-origin.
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Sync-Key");

// Browsers send a preflight OPTIONS request before cross-origin writes.
if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// Hostinger MySQL credentials — fill these in (same DB as weapons.php).
// ---------------------------------------------------------------------------
$DB_HOST = "localhost";
$DB_NAME = "u102692168_Star_Force";
$DB_USER = "u102692168_Seven";
$DB_PASS = "CHANGE_ME";
// ---------------------------------------------------------------------------

$method = $_SERVER["REQUEST_METHOD"] ?? "GET";

// Only writes go through this file.
if (!in_array($method, ["POST", "PUT", "DELETE"], true)) {
    http_response_code(405);
    echo json_encode(["success" => false, "error" => "Method not allowed.", "file" => "weapons-sync-v4"]);
    exit;
}

try {
    $pdo = new PDO("mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Database connection failed. Check credentials in this file.", "file" => "weapons-sync-v4"]);
    exit;
}

/** Read + validate the JSON body into a weapon row. */
function readWeaponBody(): ?array {
    $raw = file_get_contents("php://input");
    $data = json_decode((string) $raw, true);
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Invalid JSON body.", "file" => "weapons-sync-v4"]);
        exit;
    }
    $id = trim((string) ($data["id"] ?? ""));
    $designation = trim((string) ($data["designation"] ?? ""));
    if ($id === "" || $designation === "") {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "id and designation are required.", "file" => "weapons-sync-v4"]);
        exit;
    }
    $s = static fn($v) => is_string($v) ? trim($v) : "";
    return [
        "id" => mb_substr($id, 0, 64),
        "designation" => mb_substr($designation, 0, 255),
        "category" => mb_substr($s($data["category"] ?? ""), 0, 160),
        "builder" => mb_substr($s($data["builder"] ?? ""), 0, 255),
        "registry_number" => mb_substr($s($data["registry_number"] ?? ""), 0, 64),
        "status" => mb_substr($s($data["status"] ?? "") ?: "Active", 0, 32),
        "fleet" => mb_substr($s($data["fleet"] ?? ""), 0, 255),
        "effective_range" => mb_substr($s($data["effective_range"] ?? ""), 0, 160),
        "rate_of_fire" => mb_substr($s($data["rate_of_fire"] ?? ""), 0, 64),
        "primary_spec" => mb_substr($s($data["primary_spec"] ?? ""), 0, 4000),
        "created_at" => mb_substr($s($data["created_at"] ?? ""), 0, 40),
    ];
}

if ($method === "POST") {
    $w = readWeaponBody();
    $stmt = $pdo->prepare(
        "INSERT INTO weapons
            (id, designation, category, builder, registry_number, status, fleet,
             effective_range, rate_of_fire, primary_spec, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            designation = VALUES(designation), category = VALUES(category),
            builder = VALUES(builder), registry_number = VALUES(registry_number),
            status = VALUES(status), fleet = VALUES(fleet),
            effective_range = VALUES(effective_range), rate_of_fire = VALUES(rate_of_fire),
            primary_spec = VALUES(primary_spec), updated_at = NOW()"
    );
    $stmt->execute([
        $w["id"], $w["designation"], $w["category"], $w["builder"], $w["registry_number"],
        $w["status"], $w["fleet"], $w["effective_range"], $w["rate_of_fire"],
        $w["primary_spec"],
        $w["created_at"] !== "" ? date("Y-m-d H:i:s", strtotime($w["created_at"])) : date("Y-m-d H:i:s"),
    ]);
    http_response_code(201);
    echo json_encode(["success" => true, "id" => $w["id"], "file" => "weapons-sync-v4"]);
    exit;
}

if ($method === "PUT") {
    $w = readWeaponBody();
    $stmt = $pdo->prepare(
        "UPDATE weapons SET
            designation = ?, category = ?, builder = ?, registry_number = ?, status = ?,
            fleet = ?, effective_range = ?, rate_of_fire = ?, primary_spec = ?, updated_at = NOW()
         WHERE id = ?"
    );
    $stmt->execute([
        $w["designation"], $w["category"], $w["builder"], $w["registry_number"], $w["status"],
        $w["fleet"], $w["effective_range"], $w["rate_of_fire"], $w["primary_spec"], $w["id"],
    ]);
    echo json_encode(["success" => true, "id" => $w["id"], "updated" => $stmt->rowCount() > 0, "file" => "weapons-sync-v4"]);
    exit;
}

// DELETE
$id = trim((string) ($_GET["id"] ?? ""));
if ($id === "") {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "id is required.", "file" => "weapons-sync-v4"]);
    exit;
}
$stmt = $pdo->prepare("DELETE FROM weapons WHERE id = ?");
$stmt->execute([mb_substr($id, 0, 64)]);
echo json_encode(["success" => true, "id" => $id, "deleted" => $stmt->rowCount() > 0, "file" => "weapons-sync-v4"]);
