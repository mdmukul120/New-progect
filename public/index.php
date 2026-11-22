<?php
/**
 * MovieLinkBD — front controller.
 *
 * Every HTTP request (web root) passes through this file.  No ads, no
 * third-party trackers, no click-jackers: see src/View.php + templates/.
 */

declare(strict_types=1);

define('MLBD_START', microtime(true));

require dirname(__DIR__) . '/src/bootstrap.php';

use App\Core\App;
use App\Core\Router;

$app = App::boot(__DIR__);

$response = (new Router($app))->dispatch(
    $_SERVER['REQUEST_METHOD'] ?? 'GET',
    $_SERVER['REQUEST_URI'] ?? '/'
);

$response->send();
