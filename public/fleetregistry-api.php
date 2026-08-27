<?php
declare(strict_types=1);

// ============================================
// EDIT YOUR DATABASE INFO BELOW
// ============================================
$db_host = 'localhost';
$db_name = 'u102692168_Star_Force';
$db_user = 'u102692168_Seven';
$db_pass = 'PASTE_YOUR_PASSWORD_HERE';
// ============================================

session_name('fleet_registry_session');
session_set_cookie_params(['httponly' => true, 'secure' => true, 'samesite' => 'Lax']);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://fleetregistry.starforcebase1198.com');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function fr_out(mixed $value, int $status = 200): never { http_response_code($status); echo json_encode($value, JSON_UNESCAPED_SLASHES); exit; }
function fr_body(): array { $d = json_decode(file_get_contents('php://input'), true); return is_array($d) ? $d : []; }
function fr_text(array $a, string $k, int $max = 100000): ?string { return array_key_exists($k, $a) && $a[$k] !== null ? mb_substr(trim((string)$a[$k]), 0, $max) : null; }
function fr_operator(): void { if (empty($_SESSION['fleet_operator'])) fr_out(['error' => 'Operator authentication required'], 401); }
function fr_csrf(): void { $e = (string)($_SESSION['fleet_csrf'] ?? ''); $a = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''); if ($e === '' || !hash_equals($e, $a)) fr_out(['error' => 'Invalid security token'], 403); }

try {
  $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

  // Detect the actual vessels primary key column name
  $cols = $pdo->query("SHOW COLUMNS FROM vessels")->fetchAll(PDO::FETCH_COLUMN);
  $pk = in_array('id', $cols) ? 'id' : (in_array('_id', $cols) ? '_id' : null);
  if (!$pk) fr_out(['error' => 'Cannot determine vessels primary key'], 500);

  // Create archive tables with a plain vessel_ref column (no foreign key constraint)
  // This avoids schema mismatches with the existing vessels table
  $pdo->exec("CREATE TABLE IF NOT EXISTS service_histories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    vessel_ref VARCHAR(120) NOT NULL,
    event_date DATE NULL,
    event_type VARCHAR(80) NOT NULL DEFAULT 'service',
    title VARCHAR(255) NOT NULL,
    details TEXT NULL,
    location VARCHAR(255) NULL,
    source_reference VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    KEY idx_service_vessel(vessel_ref)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

  $pdo->exec("CREATE TABLE IF NOT EXISTS armament_sheets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    vessel_ref VARCHAR(120) NOT NULL,
    title VARCHAR(255) NOT NULL,
    primary_armament TEXT NULL,
    secondary_armament TEXT NULL,
    defensive_systems TEXT NULL,
    ammunition_notes TEXT NULL,
    classification VARCHAR(80) NOT NULL DEFAULT 'standard',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    UNIQUE KEY uq_armament_vessel_title(vessel_ref, title),
    KEY idx_armament_vessel(vessel_ref)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

  $pdo->exec("CREATE TABLE IF NOT EXISTS black_box_files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    vessel_ref VARCHAR(120) NOT NULL,
    file_code VARCHAR(120) NOT NULL,
    title VARCHAR(255) NOT NULL,
    incident_date DATE NULL,
    classification VARCHAR(80) NOT NULL DEFAULT 'operator-only',
    summary TEXT NULL,
    payload MEDIUMTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id),
    UNIQUE KEY uq_black_box_vessel_code(vessel_ref, file_code),
    KEY idx_black_box_vessel(vessel_ref)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

} catch (Throwable $e) { fr_out(['error' => 'Database connection failed: ' . $e->getMessage()], 500); }

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? 'list');

// Public session check
if ($action === 'session' && $method === 'GET') fr_out(['loggedIn' => !empty($_SESSION['fleet_operator']), 'csrf' => $_SESSION['fleet_csrf'] ?? null]);

// Operator login
if ($action === 'login' && $method === 'POST') {
  $input = fr_body(); $username = fr_text($input, 'username', 120) ?? ''; $password = (string)($input['password'] ?? '');
  $stmt = $pdo->prepare('SELECT id, username, password_hash FROM fleet_operators WHERE username = ? LIMIT 1'); $stmt->execute([$username]); $op = $stmt->fetch();
  if (!$op || !password_verify($password, (string)$op['password_hash'])) fr_out(['error' => 'Invalid operator credentials'], 401);
  session_regenerate_id(true); $_SESSION['fleet_operator'] = (int)$op['id']; $_SESSION['fleet_csrf'] = bin2hex(random_bytes(24));
  fr_out(['loggedIn' => true, 'csrf' => $_SESSION['fleet_csrf']]);
}

// Operator logout
if ($action === 'logout' && $method === 'POST') { session_destroy(); fr_out(['loggedIn' => false]); }

// List vessels (public) — uses the detected primary key
if ($action === 'vessels' && $method === 'GET') {
  $stmt = $pdo->query("SELECT `$pk`, designation, registry_number, name, ship_class, status FROM vessels ORDER BY designation");
  fr_out(['records' => $stmt->fetchAll()]);
}

// Read archives (service + armament public, black-box operator-only)
if ($action === 'archives' && $method === 'GET') {
  $vesselRef = fr_text($_GET, 'vessel_ref', 120); $isOp = !empty($_SESSION['fleet_operator']);
  $where = $vesselRef ? ' WHERE vessel_ref = :vref' : ''; $params = $vesselRef ? [':vref' => $vesselRef] : [];
  $svc = $pdo->prepare('SELECT * FROM service_histories' . $where . ' ORDER BY event_date DESC, id DESC'); $svc->execute($params);
  $arm = $pdo->prepare('SELECT * FROM armament_sheets' . $where . ' ORDER BY id DESC'); $arm->execute($params);
  $result = ['service_histories' => $svc->fetchAll(), 'armament_sheets' => $arm->fetchAll()];
  if ($isOp) { $bb = $pdo->prepare('SELECT * FROM black_box_files' . $where . ' ORDER BY incident_date DESC, id DESC'); $bb->execute($params); $result['black_box_files'] = $bb->fetchAll(); }
  fr_out($result);
}

// Everything below requires operator login + CSRF
fr_operator(); fr_csrf();

// Create or update archive record
if ($action === 'archive' && in_array($method, ['POST', 'PUT'], true)) {
  $input = fr_body(); $type = (string)($input['type'] ?? ''); $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT); $vesselRef = fr_text($input, 'vessel_ref', 120);
  if (!$vesselRef || !in_array($type, ['service_histories', 'armament_sheets', 'black_box_files'], true)) fr_out(['error' => 'Invalid archive record'], 422);
  if ($type === 'black_box_files') fr_operator();
  $check = $pdo->prepare("SELECT `$pk` FROM vessels WHERE `$pk` = ?"); $check->execute([$vesselRef]); if (!$check->fetchColumn()) fr_out(['error' => 'Vessel not found'], 422);
  $fields = [
    'service_histories' => ['event_date','event_type','title','details','location','source_reference'],
    'armament_sheets' => ['title','primary_armament','secondary_armament','defensive_systems','ammunition_notes','classification'],
    'black_box_files' => ['file_code','title','incident_date','classification','summary','payload'],
  ][$type];
  $values = ['vessel_ref' => $vesselRef];
  foreach ($fields as $f) $values[$f] = fr_text($input, $f, in_array($f, ['details','primary_armament','secondary_armament','defensive_systems','ammunition_notes','summary','payload'], true) ? 10000000 : 255);
  if (!$values['title']) fr_out(['error' => 'Title is required'], 422);
  if ($type === 'black_box_files' && !$values['file_code']) fr_out(['error' => 'File code is required'], 422);
  if ($id) { $set = implode(', ', array_map(fn($k) => "`$k` = :$k", array_keys($values))); $values['id'] = $id; $stmt = $pdo->prepare("UPDATE `$type` SET $set WHERE id = :id"); }
  else { $cols = implode(',', array_map(fn($k) => "`$k`", array_keys($values))); $marks = implode(',', array_map(fn($k) => ":$k", array_keys($values))); $stmt = $pdo->prepare("INSERT INTO `$type` ($cols) VALUES ($marks)"); }
  $params = []; foreach ($values as $k => $v) $params[':' . $k] = $v; $stmt->execute($params);
  fr_out(['success' => true, 'id' => $id ?: (int)$pdo->lastInsertId()], $id ? 200 : 201);
}

// Delete archive record
if ($action === 'archive' && $method === 'DELETE') {
  $type = (string)($_GET['type'] ?? ''); $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
  if (!in_array($type, ['service_histories','armament_sheets','black_box_files'], true) || !$id) fr_out(['error' => 'Invalid delete'], 422);
  if ($type === 'black_box_files') fr_operator();
  $stmt = $pdo->prepare("DELETE FROM `$type` WHERE id = ?"); $stmt->execute([$id]);
  fr_out(['success' => true]);
}

// Reassign all archive records from one vessel to another
if ($action === 'reassign' && $method === 'POST') {
  $input = fr_body(); $from = fr_text($input, 'from_vessel_ref', 120); $to = fr_text($input, 'to_vessel_ref', 120);
  if (!$from || !$to || $from === $to) fr_out(['error' => 'Two different vessel references required'], 422);
  $pdo->beginTransaction();
  try {
    $check = $pdo->prepare("SELECT `$pk` FROM vessels WHERE `$pk` IN (?, ?)"); $check->execute([$from, $to]);
    if ($check->rowCount() !== 2) throw new RuntimeException('Both vessel references must exist');
    foreach (['service_histories','armament_sheets','black_box_files'] as $tbl) {
      $stmt = $pdo->prepare("UPDATE `$tbl` SET vessel_ref = ? WHERE vessel_ref = ?"); $stmt->execute([$to, $from]);
    }
    $pdo->commit(); fr_out(['success' => true]);
  } catch (Throwable $e) { $pdo->rollBack(); fr_out(['error' => 'Reassignment rolled back'], 409); }
}

fr_out(['error' => 'Unknown action'], 404);
