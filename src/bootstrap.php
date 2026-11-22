<?php
/**
 * Shared bootstrap: autoloader, config, error handling, helpers.
 */

declare(strict_types=1);

use App\Core\Config;
use App\Core\Env;

define('MLBD_ROOT', dirname(__DIR__));

// --------------------------------------------------------------------
// PSR-4-ish autoloader (App\ => /src).  No composer needed.
// --------------------------------------------------------------------
spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = MLBD_ROOT . '/src/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

require MLBD_ROOT . '/src/helpers.php';

Env::load(MLBD_ROOT . '/.env');
Config::load(MLBD_ROOT . '/config');

date_default_timezone_set((string) Config::get('app.timezone', 'Asia/Dhaka'));

$debug = (bool) Config::get('app.debug', false);
ini_set('display_errors', $debug ? '1' : '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

$logDir = MLBD_ROOT . '/storage/logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0775, true);
}
ini_set('error_log', $logDir . '/php-error.log');

set_exception_handler(static function (Throwable $e) use ($debug): void {
    error_log(sprintf(
        "[%s] %s: %s in %s:%d\n%s",
        date('c'),
        $e::class,
        $e->getMessage(),
        $e->getFile(),
        $e->getLine(),
        $e->getTraceAsString()
    ));

    if (!headers_sent()) {
        header('Content-Type: text/html; charset=utf-8', true, 500);
    }

    if ($debug) {
        echo '<h1>Application error</h1><pre style="white-space:pre-wrap">'
            . htmlspecialchars($e::class . ': ' . $e->getMessage(), ENT_QUOTES)
            . "\n\n" . htmlspecialchars($e->getTraceAsString(), ENT_QUOTES)
            . '</pre>';
        return;
    }

    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>Something went wrong — ' . htmlspecialchars((string) Config::get('site.name', 'MovieLinkBD'), ENT_QUOTES) . '</title>'
        . '<style>body{font:16px/1.6 system-ui,sans-serif;background:#06131f;color:#e6eaf2;'
        . 'display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}'
        . 'h1{font-size:26px;margin:0 0 8px}p{color:#8fa3b8;margin:0 0 20px}'
        . 'a{color:#1cc88a;text-decoration:none;font-weight:700}</style></head><body><div>'
        . '<h1>500 — Somethig went wrong</h1><p>আমরা সমস্যাটি ঠিক করছি। একটু পরে আবার চেষ্টা করুন।</p>'
        . '<a href="/">&larr; Back to home</a></div></body></html>';
});
