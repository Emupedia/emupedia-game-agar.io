<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Use POST to upload a skin.']);
}

$allowedOrigin = getenv('AGAR_SKIN_UPLOAD_ORIGIN') ?: '';
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
if ($allowedOrigin !== '' && $origin !== $allowedOrigin) {
    respond(403, ['ok' => false, 'error' => 'This upload origin is not allowed.']);
}

$maximumBytes = (int) (getenv('AGAR_SKIN_UPLOAD_MAX_BYTES') ?: 2 * 1024 * 1024);
$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > $maximumBytes) {
    respond(413, ['ok' => false, 'error' => 'The image is too large.']);
}

if (!isset($_FILES['skin']) || !is_array($_FILES['skin'])) {
    respond(400, ['ok' => false, 'error' => 'Choose an image first.']);
}

$upload = $_FILES['skin'];
if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    respond(400, ['ok' => false, 'error' => 'The image could not be uploaded.']);
}

$temporaryPath = (string) ($upload['tmp_name'] ?? '');
$size = (int) ($upload['size'] ?? 0);
if ($size < 1 || $size > $maximumBytes || !is_uploaded_file($temporaryPath)) {
    respond(400, ['ok' => false, 'error' => 'The uploaded image is invalid or too large.']);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($temporaryPath);
if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)) {
    respond(415, ['ok' => false, 'error' => 'Use a PNG, JPEG, or WebP image.']);
}

$dimensions = @getimagesize($temporaryPath);
if ($dimensions === false) {
    respond(415, ['ok' => false, 'error' => 'The selected file is not a valid image.']);
}

[$sourceWidth, $sourceHeight] = $dimensions;
if ($sourceWidth < 32 || $sourceHeight < 32 || $sourceWidth > 4096 || $sourceHeight > 4096) {
    respond(400, ['ok' => false, 'error' => 'Use an image between 32×32 and 4096×4096 pixels.']);
}

$rateRoot = getenv('AGAR_SKIN_UPLOAD_RATE_ROOT') ?: sys_get_temp_dir() . '/agar-skin-upload-rate';
if (!is_dir($rateRoot) && !mkdir($rateRoot, 0700, true) && !is_dir($rateRoot)) {
    respond(503, ['ok' => false, 'error' => 'Uploads are temporarily unavailable.']);
}

$remoteAddress = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
$rateFile = $rateRoot . '/' . hash('sha256', $remoteAddress);
$rateHandle = @fopen($rateFile, 'c+');
if ($rateHandle === false || !flock($rateHandle, LOCK_EX)) {
    respond(503, ['ok' => false, 'error' => 'Uploads are temporarily unavailable.']);
}

$cooldown = (int) (getenv('AGAR_SKIN_UPLOAD_COOLDOWN') ?: 15);
$lastUpload = (int) trim((string) stream_get_contents($rateHandle));
$now = time();
if ($lastUpload > 0 && ($now - $lastUpload) < $cooldown) {
    flock($rateHandle, LOCK_UN);
    fclose($rateHandle);
    respond(429, ['ok' => false, 'error' => 'Please wait before uploading another skin.']);
}

$bytes = file_get_contents($temporaryPath);
$source = $bytes === false ? false : @imagecreatefromstring($bytes);
if ($source === false) {
    flock($rateHandle, LOCK_UN);
    fclose($rateHandle);
    respond(415, ['ok' => false, 'error' => 'The image could not be decoded safely.']);
}

$targetSize = 512;
$target = imagecreatetruecolor($targetSize, $targetSize);
imagealphablending($target, false);
imagesavealpha($target, true);
$transparent = imagecolorallocatealpha($target, 0, 0, 0, 127);
imagefill($target, 0, 0, $transparent);

$scale = min($targetSize / $sourceWidth, $targetSize / $sourceHeight);
$drawWidth = max(1, (int) round($sourceWidth * $scale));
$drawHeight = max(1, (int) round($sourceHeight * $scale));
$drawX = (int) floor(($targetSize - $drawWidth) / 2);
$drawY = (int) floor(($targetSize - $drawHeight) / 2);
imagecopyresampled($target, $source, $drawX, $drawY, 0, 0, $drawWidth, $drawHeight, $sourceWidth, $sourceHeight);
imagedestroy($source);

$skinRoot = getenv('AGAR_SKIN_UPLOAD_ROOT') ?: dirname(__DIR__, 2) . '/docs/skins3/custom';
if (!is_dir($skinRoot) && !mkdir($skinRoot, 0750, true) && !is_dir($skinRoot)) {
    imagedestroy($target);
    flock($rateHandle, LOCK_UN);
    fclose($rateHandle);
    respond(503, ['ok' => false, 'error' => 'The skin storage directory is unavailable.']);
}
if (!is_writable($skinRoot)) {
    imagedestroy($target);
    flock($rateHandle, LOCK_UN);
    fclose($rateHandle);
    respond(503, ['ok' => false, 'error' => 'The skin storage directory is not writable.']);
}

$temporaryOutput = tempnam($skinRoot, '.upload-');
if ($temporaryOutput === false || !imagepng($target, $temporaryOutput, 8)) {
    imagedestroy($target);
    flock($rateHandle, LOCK_UN);
    fclose($rateHandle);
    respond(500, ['ok' => false, 'error' => 'The skin could not be saved.']);
}
imagedestroy($target);

$skinId = substr(hash_file('sha256', $temporaryOutput), 0, 24);
$destination = $skinRoot . '/' . $skinId . '.png';
if (is_file($destination)) {
    unlink($temporaryOutput);
} elseif (!rename($temporaryOutput, $destination)) {
    @unlink($temporaryOutput);
    flock($rateHandle, LOCK_UN);
    fclose($rateHandle);
    respond(500, ['ok' => false, 'error' => 'The skin could not be published.']);
}
chmod($destination, 0644);

ftruncate($rateHandle, 0);
rewind($rateHandle);
fwrite($rateHandle, (string) $now);
fflush($rateHandle);
flock($rateHandle, LOCK_UN);
fclose($rateHandle);

$publicPrefix = rtrim(getenv('AGAR_SKIN_UPLOAD_PUBLIC_PREFIX') ?: '/skins/custom', '/');
respond(201, [
    'ok' => true,
    'skin' => 'custom/' . $skinId,
    'url' => $publicPrefix . '/' . $skinId . '.png',
]);
