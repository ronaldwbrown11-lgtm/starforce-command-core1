<?php
// Copy to api.php on nighthawk.starforcebase1198.com, next to config.php.
// Configure the operator password through the one-time setup action below.
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
session_name($config['session_name']);
session_set_cookie_params(['httponly' => true, 'secure' => true, 'samesite' => 'Lax']);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $config['allowed_origin']);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

try {
  $pdo = new PDO(
    "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4",
    $config['db_user'], $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
  );
} catch (Throwable $e) { http_response_code(500); echo json_encode(['error'=>'Database unavailable']); exit; }

function body(): array { $decoded = json_decode(file_get_contents('php://input'), true); return is_array($decoded) ? $decoded : []; }
function json_out(mixed $value, int $status = 200): never { http_response_code($status); echo json_encode($value, JSON_UNESCAPED_SLASHES); exit; }
function operator_required(): void { if (empty($_SESSION['operator_id'])) json_out(['error'=>'Operator login required'], 401); }
function csrf_required(): void { if (!hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_out(['error'=>'Invalid security token'], 403); }
function clean(array $input, string $key, int $max = 10000): ?string { if (!array_key_exists($key, $input) || $input[$key] === null) return null; return mb_substr(trim((string)$input[$key]), 0, $max); }

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

if ($action === 'session' && $method === 'GET') json_out(['loggedIn'=>!empty($_SESSION['operator_id']), 'csrf'=>$_SESSION['csrf'] ?? null]);
if ($action === 'login' && $method === 'POST') {
  $input = body(); $username = clean($input, 'username', 120) ?? ''; $password = (string)($input['password'] ?? '');
  $stmt = $pdo->prepare('SELECT id, password_hash FROM nighthawk_operators WHERE username = ? LIMIT 1'); $stmt->execute([$username]); $operator = $stmt->fetch();
  if (!$operator || !password_verify($password, $operator['password_hash'])) json_out(['error'=>'Invalid login'], 401);
  session_regenerate_id(true); $_SESSION['operator_id'] = (int)$operator['id']; $_SESSION['csrf'] = bin2hex(random_bytes(24));
  $pdo->prepare('UPDATE nighthawk_operators SET last_login_at = ? WHERE id = ?')->execute([round(microtime(true) * 1000), $operator['id']]);
  json_out(['loggedIn'=>true, 'csrf'=>$_SESSION['csrf']]);
}
if ($action === 'logout' && $method === 'POST') { session_destroy(); json_out(['loggedIn'=>false]); }

if ($action === 'list' && $method === 'GET') {
  $q = trim((string)($_GET['q'] ?? '')); $sql = 'SELECT * FROM vehicles WHERE review_status = "approved"'; $params = [];
  if ($q !== '') { $sql .= ' AND (designation LIKE ? OR category LIKE ? OR builder LIKE ? OR registry_number LIKE ? OR fleet LIKE ?)'; $like = "%{$q}%"; $params = [$like,$like,$like,$like,$like]; }
  $sql .= ' ORDER BY category ASC, designation ASC'; $stmt = $pdo->prepare($sql); $stmt->execute($params); json_out(['vehicles'=>$stmt->fetchAll()]);
}

operator_required(); csrf_required();
if ($action === 'upsert' && in_array($method, ['POST','PUT'], true)) {
  $input = body(); $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT) ?: null;
  $fields = ['designation','category','weapon_class','builder','registry_number','status','fleet','hover_range','effective_range','destructive_power','cruising_speed','top_speed','rof','power','damage','primary_spec','defense','notes','image_img','schema_img'];
  $values = []; foreach ($fields as $field) $values[$field] = clean($input, $field, in_array($field, ['primary_spec','defense','notes','image_img','schema_img'], true) ? 10000000 : 255);
  if (!$values['designation'] || !$values['category']) json_out(['error'=>'Designation and category are required'], 422);
  $values['review_status'] = 'approved'; $now = round(microtime(true) * 1000); $values['reviewed_at'] = $now; $values['created_at'] = $now;
  if ($id) { $set = implode(', ', array_map(fn($f) => "`$f` = :$f", array_keys($values))); $values['id'] = $id; $stmt = $pdo->prepare("UPDATE vehicles SET $set WHERE id = :id"); }
  else { $cols = implode(',', array_keys($values)); $marks = implode(',', array_map(fn($f) => ":$f", array_keys($values))); $stmt = $pdo->prepare("INSERT INTO vehicles ($cols) VALUES ($marks)"); }
  $stmt->execute($values); json_out(['ok'=>true, 'id'=>$id ?: (int)$pdo->lastInsertId()]);
}
if ($action === 'delete' && $method === 'DELETE') { $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT); if (!$id) json_out(['error'=>'Invalid vehicle id'],422); $stmt=$pdo->prepare('DELETE FROM vehicles WHERE id=?'); $stmt->execute([$id]); json_out(['ok'=>true]); }
json_out(['error'=>'Unknown action'], 404);
