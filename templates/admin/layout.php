<?php
/**
 * Admin layout.
 *
 * @var string $content
 * @var string $title
 */
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$nav = [
    '/admin' => '📊 Dashboard',
    '/admin/titles' => '🎬 Titles',
    '/admin/endpoints' => '🧩 API endpoints',
    '/admin/settings' => '⚙️ Settings',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title ?? 'Admin') ?> — MovieLinkBD</title>
<link rel="stylesheet" href="<?= e(asset('/assets/css/admin.css')) ?>">
</head>
<body>
<div class="admin-shell">
  <aside class="sidebar">
    <div class="logo"><span>M</span> MovieLinkBD</div>
    <nav>
      <?php foreach ($nav as $href => $label): ?>
        <a href="<?= e($href) ?>" class="<?= $path === $href ? 'is-active' : '' ?>"><?= e($label) ?></a>
      <?php endforeach; ?>
      <a href="/" target="_blank" rel="noopener">🌐 View site</a>
    </nav>
    <form method="post" action="/admin/logout">
      <button class="btn btn-ghost btn-sm" type="submit">Sign out</button>
    </form>
  </aside>
  <main class="main">
    <?= $content ?>
  </main>
</div>
</body>
</html>
