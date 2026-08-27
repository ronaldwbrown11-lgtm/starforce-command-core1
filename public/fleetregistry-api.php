<?php
declare(strict_types=1);

// Upload alongside the Fleet Registry API and configure the existing credentials
// outside the web root or through the deployment environment. This file does
// not modify vessel or vessel_variants rows.
$config = require __DIR__ . '/fleetregistry-config.php';
header('Content-Type: application/json; charset=utf-8');
$origin = (string)($config['allowed_origin'] ?? 'https://fleetregistry.starforcebase1198.com');
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function fr_out(mixed $value, int $status = 200): never { http_response_code($status); echo json_encode($value, JSON_UNESCAPED_SLASHES); exit; }
function fr_body(): array { $decoded = json_decode(file_get_contents('php://input'), true); return is_array($decoded) ? $decoded : []; }
function fr_text(array $input, string $key, int $max = 100000): ?string { if (!array_key_exists($key, $input) || $input[$key] === null) return null; return mb_substr(trim((string)$input[$key]), 0, $max); }
function fr_id(mixed $value): ?int { $id = filter_var($value, FILTER_VALIDATE_INT); return $id !== false && $id > 0 ? (int)$id : null; }
function fr_operator(): void { if (empty($_SESSION['fleet_operator'])) fr_out(['error' => 'Operator authentication required'], 401); }
function fr_csrf(): void { $expected = (string)($_SESSION['fleet_csrf'] ?? ''); $actual = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''); if ($expected === '' || !hash_equals($expected, $actual)) fr_out(['error' => 'Invalid security token'], 403); }

try {
  $pdo = new PDO(
    "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4",
    $config['db_user'], $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
  );
  $pdo->exec("CREATE TABLE IF NOT EXISTS service_histories (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, vessel_id BIGINT UNSIGNED NOT NULL, event_date DATE NULL, event_type VARCHAR(80) NOT NULL DEFAULT 'service', title VARCHAR(255) NOT NULL, details TEXT NULL, location VARCHAR(255) NULL, source_reference VARCHAR(255) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(id), KEY idx_service_vessel(vessel_id), CONSTRAINT fk_service_vessel FOREIGN KEY(vessel_id) REFERENCES vessels(id) ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS armament_sheets (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, vessel_id BIGINT UNSIGNED NOT NULL, title VARCHAR(255) NOT NULL, primary_armament TEXT NULL, secondary_armament TEXT NULL, defensive_systems TEXT NULL, ammunition_notes TEXT NULL, classification VARCHAR(80) NOT NULL DEFAULT 'standard', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(id), UNIQUE KEY uq_armament_vessel_title(vessel_id,title), KEY idx_armament_vessel(vessel_id), CONSTRAINT fk_armament_vessel FOREIGN KEY(vessel_id) REFERENCES vessels(id) ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS black_box_files (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, vessel_id BIGINT UNSIGNED NOT NULL, file_code VARCHAR(120) NOT NULL, title VARCHAR(255) NOT NULL, incident_date DATE NULL, classification VARCHAR(80) NOT NULL DEFAULT 'operator-only', summary TEXT NULL, payload MEDIUMTEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(id), UNIQUE KEY uq_black_box_vessel_code(vessel_id,file_code), KEY idx_black_box_vessel(vessel_id), CONSTRAINT fk_black_box_vessel FOREIGN KEY(vessel_id) REFERENCES vessels(id) ON UPDATE CASCADE ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) { fr_out(['error' => 'Fleet Registry database unavailable'], 500); }

session_name((string)($config['session_name'] ?? 'fleet_registry_session')); session_set_cookie_params(['httponly' => true, 'secure' => true, 'samesite' => 'Lax']); session_start();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET'; $action = (string)($_GET['action'] ?? 'list');
if ($action === 'session' && $method === 'GET') fr_out(['loggedIn' => !empty($_SESSION['fleet_operator']), 'csrf' => $_SESSION['fleet_csrf'] ?? null]);
if ($action === 'login' && $method === 'POST') {
  $input = fr_body(); $username = fr_text($input, 'username', 120) ?? ''; $password = (string)($input['password'] ?? '');
  $stmt = $pdo->prepare('SELECT id, username, password_hash FROM fleet_operators WHERE username = ? LIMIT 1'); $stmt->execute([$username]); $operator = $stmt->fetch();
  if (!$operator || !password_verify($password, (string)$operator['password_hash'])) fr_out(['error' => 'Invalid operator credentials'], 401);
  session_regenerate_id(true); $_SESSION['fleet_operator'] = (int)$operator['id']; $_SESSION['fleet_csrf'] = bin2hex(random_bytes(24)); fr_out(['loggedIn' => true, 'csrf' => $_SESSION['fleet_csrf']]);
}
if ($action === 'logout' && $method === 'POST') { session_destroy(); fr_out(['loggedIn' => false]); }

if ($action === 'vessels' && $method === 'GET') {
  $stmt = $pdo->query('SELECT id, designation, registry_number, name, ship_class, status FROM vessels ORDER BY designation');
  fr_out(['records' => $stmt->fetchAll()]);
}
if ($action === 'archives' && $method === 'GET') {
  $vesselId = fr_id($_GET['vessel_id'] ?? null); $operator = !empty($_SESSION['fleet_operator']); $where = $vesselId ? ' WHERE vessel_id = :vessel_id' : ''; $params = $vesselId ? [':vessel_id' => $vesselId] : [];
  $service = $pdo->prepare('SELECT * FROM service_histories' . $where . ' ORDER BY event_date DESC, id DESC'); $service->execute($params);
  $armament = $pdo->prepare('SELECT * FROM armament_sheets' . $where . ' ORDER BY id DESC'); $armament->execute($params);
  $result = ['service_histories' => $service->fetchAll(), 'armament_sheets' => $armament->fetchAll()];
  if ($operator) { $black = $pdo->prepare('SELECT * FROM black_box_files' . $where . ' ORDER BY incident_date DESC, id DESC'); $black->execute($params); $result['black_box_files'] = $black->fetchAll(); }
  fr_out($result);
}

fr_operator(); fr_csrf();
if ($action === 'archive' && in_array($method, ['POST', 'PUT'], true)) {
  $input = fr_body(); $type = (string)($input['type'] ?? ''); $id = fr_id($input['id'] ?? null); $vesselId = fr_id($input['vessel_id'] ?? null);
  if (!$vesselId || !in_array($type, ['service_histories', 'armament_sheets', 'black_box_files'], true)) fr_out(['error' => 'Invalid archive record'], 422);
  if ($type === 'black_box_files') fr_operator();
  $check = $pdo->prepare('SELECT id FROM vessels WHERE id = ?'); $check->execute([$vesselId]); if (!$check->fetchColumn()) fr_out(['error' => 'Vessel not found'], 422);
  $allowed = [
    'service_histories' => ['event_date','event_type','title','details','location','source_reference'],
    'armament_sheets' => ['title','primary_armament','secondary_armament','defensive_systems','ammunition_notes','classification'],
    'black_box_files' => ['file_code','title','incident_date','classification','summary','payload'],
  ][$type];
  $values = ['vessel_id' => $vesselId]; foreach ($allowed as $field) $values[$field] = fr_text($input, $field, in_array($field, ['details','primary_armament','secondary_armament','defensive_systems','ammunition_notes','summary','payload'], true) ? 10000000 : 255);
  if (!$values['title']) fr_out(['error' => 'Title is required'], 422); if ($type === 'black_box_files' && !$values['file_code']) fr_out(['error' => 'File code is required'], 422);
  if ($id) { $set = implode(', ', array_map(fn($key) => "`$key` = :$key", array_keys($values))); $values['id'] = $id; $stmt = $pdo->prepare("UPDATE `$type` SET $set WHERE id = :id"); }
  else { $columns = implode(',', array_map(fn($key) => "`$key`", array_keys($values))); $marks = implode(',', array_map(fn($key) => ":$key", array_keys($values))); $stmt = $pdo->prepare("INSERT INTO `$type` ($columns) VALUES ($marks)"); }
  $params = []; foreach ($values as $key => $value) $params[':' . $key] = $value; $stmt->execute($params); fr_out(['success' => true, 'id' => $id ?: (int)$pdo->lastInsertId()], $id ? 200 : 201);
}
if ($action === 'archive' && $method === 'DELETE') {
  $type = (string)($_GET['type'] ?? ''); $id = fr_id($_GET['id'] ?? null); if (!in_array($type, ['service_histories','armament_sheets','black_box_files'], true) || !$id) fr_out(['error' => 'Invalid archive delete'], 422); if ($type === 'black_box_files') fr_operator(); $stmt = $pdo->prepare("DELETE FROM `$type` WHERE id = ?"); $stmt->execute([$id]); fr_out(['success' => true]);
}
if ($action === 'reassign' && $method === 'POST') {
  $input = fr_body(); $from = fr_id($input['from_vessel_id'] ?? null); $to = fr_id($input['to_vessel_id'] ?? null); if (!$from || !$to || $from === $to) fr_out(['error' => 'Two different vessel IDs are required'], 422);
  $pdo->beginTransaction(); try { $check = $pdo->prepare('SELECT id FROM vessels WHERE id IN (?, ?)'); $check->execute([$from, $to]); if ($check->rowCount() !== 2) throw new RuntimeException('Both vessel IDs must exist'); foreach (['service_histories','armament_sheets','black_box_files'] as $table) { $stmt = $pdo->prepare("UPDATE `$table` SET vessel_id = ? WHERE vessel_id = ?"); $stmt->execute([$to, $from]); } $pdo->commit(); fr_out(['success' => true]); } catch (Throwable $e) { $pdo->rollBack(); fr_out(['error' => 'Reassignment rolled back'], 409); }
}
fr_out(['error' => 'Unknown action'], 404);
