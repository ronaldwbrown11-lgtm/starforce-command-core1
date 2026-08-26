<?php
declare(strict_types=1);

// Copy this file to the Nighthawk subdomain as api.php.
// Put database credentials in config.php, never in this public file.
$config = require __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Operator-Key');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

try {
  $pdo = new PDO(
    "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4",
    $config['db_user'], $config['db_pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
  );
} catch (Throwable $e) { http_response_code(500); echo json_encode(['error'=>'Database connection failed']); exit; }

function input(): array { $v = json_decode(file_get_contents('php://input'), true); return is_array($v) ? $v : []; }
function out(mixed $v, int $status = 200): never { http_response_code($status); echo json_encode($v, JSON_UNESCAPED_SLASHES); exit; }
function text(array $a, string $key, int $max = 100000): ?string { return array_key_exists($key, $a) && $a[$key] !== null ? mb_substr(trim((string)$a[$key]), 0, $max) : null; }
function operator(array $config): void {
  $expected = (string)($config['operator_key'] ?? '');
  $actual = (string)($_SERVER['HTTP_X_OPERATOR_KEY'] ?? '');
  if ($expected === '' || !hash_equals($expected, $actual)) out(['error'=>'Operator authorization required'], 403);
}

$action = (string)($_GET['action'] ?? 'list');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($action === 'list' && $method === 'GET') {
  $q = trim((string)($_GET['q'] ?? ''));
  $sql = 'SELECT * FROM vehicles WHERE review_status = :status'; $params = [':status' => 'approved'];
  if ($q !== '') {
    $sql .= ' AND (designation LIKE :q OR category LIKE :q OR builder LIKE :q OR registry_number LIKE :q OR fleet LIKE :q)';
    $params[':q'] = "%{$q}%";
  }
  $sql .= ' ORDER BY category ASC, designation ASC';
  $stmt = $pdo->prepare($sql); $stmt->execute($params);
  out(['success'=>true, 'records'=>$stmt->fetchAll(), 'file'=>'nighthawk-api-v1']);
}

if ($action === 'submit' && $method === 'POST') {
  $a = input();
  $required = ['designation','category','weapon_class','builder','registry_number','status','fleet','hover_range','effective_range','destructive_power','cruising_speed','top_speed','rof','power','damage'];
  $values = [];
  foreach ($required as $key) { $values[$key] = text($a, $key, 255) ?? ''; }
  if ($values['designation'] === '' || $values['category'] === '') out(['error'=>'Designation and category are required'], 422);
  foreach (['primary_spec','defense','notes','image_img','schema_img'] as $key) $values[$key] = text($a, $key);
  $values['review_status'] = 'submitted'; $values['submitted_at'] = round(microtime(true) * 1000); $values['reviewed_at'] = 0; $values['created_at'] = round(microtime(true) * 1000);
  $cols = implode(',', array_keys($values)); $marks = implode(',', array_map(fn($k) => ':' . $k, array_keys($values)));
  $stmt = $pdo->prepare("INSERT INTO vehicles ($cols) VALUES ($marks)"); $stmt->execute(array_combine(array_map(fn($k) => ':' . $k, array_keys($values)), array_values($values)));
  out(['success'=>true, 'message'=>'Vehicle submitted for operator review', 'id'=>(int)$pdo->lastInsertId()], 201);
}

operator($config);
if ($action === 'pending' && $method === 'GET') {
  $stmt = $pdo->query("SELECT * FROM vehicles WHERE review_status IN ('submitted','pending') ORDER BY submitted_at ASC");
  out(['success'=>true, 'records'=>$stmt->fetchAll()]);
}
if ($action === 'review' && $method === 'PUT') {
  $a = input(); $id = filter_var($a['id'] ?? null, FILTER_VALIDATE_INT); $status = text($a, 'review_status', 20);
  if (!$id || !in_array($status, ['approved','rejected','changes_requested'], true)) out(['error'=>'Invalid review request'], 422);
  $stmt = $pdo->prepare('UPDATE vehicles SET review_status = ?, reviewed_at = ? WHERE id = ?'); $stmt->execute([$status, round(microtime(true) * 1000), $id]);
  out(['success'=>true, 'id'=>$id, 'review_status'=>$status]);
}
if ($action === 'upsert' && in_array($method, ['POST','PUT'], true)) {
  $a = input(); $id = filter_var($a['id'] ?? null, FILTER_VALIDATE_INT);
  $fields = ['designation','category','weapon_class','builder','registry_number','status','fleet','hover_range','effective_range','destructive_power','cruising_speed','top_speed','rof','power','damage','primary_spec','defense','notes','image_img','schema_img','review_status'];
  $values = []; foreach ($fields as $key) $values[$key] = text($a, $key, in_array($key, ['primary_spec','defense','notes','image_img','schema_img'], true) ? 10000000 : 255);
  $values['review_status'] = in_array($values['review_status'], ['approved','submitted','rejected','changes_requested'], true) ? $values['review_status'] : 'submitted';
  if (!$values['designation'] || !$values['category']) out(['error'=>'Designation and category are required'], 422);
  if ($id) { $set = implode(', ', array_map(fn($k) => "`$k` = :$k", array_keys($values))); $values['id'] = $id; $stmt = $pdo->prepare("UPDATE vehicles SET $set, reviewed_at = :reviewed_at WHERE id = :id"); $values['reviewed_at'] = round(microtime(true) * 1000); }
  else { $values['submitted_at'] = round(microtime(true) * 1000); $values['reviewed_at'] = 0; $values['created_at'] = round(microtime(true) * 1000); $cols = implode(',', array_keys($values)); $marks = implode(',', array_map(fn($k) => ':' . $k, array_keys($values))); $stmt = $pdo->prepare("INSERT INTO vehicles ($cols) VALUES ($marks)"); }
  $params = []; foreach ($values as $k => $v) $params[':' . $k] = $v; $stmt->execute($params); out(['success'=>true]);
}
if ($action === 'delete' && $method === 'DELETE') { $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT); if (!$id) out(['error'=>'Invalid id'],422); $stmt=$pdo->prepare('DELETE FROM vehicles WHERE id=?'); $stmt->execute([$id]); out(['success'=>true]); }
out(['error'=>'Unknown action'], 404);
