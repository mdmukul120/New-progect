<?php
/**
 * @var string|null $error
 * @var string|null $csrf
 */
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin login — MovieLinkBD</title>
<link rel="stylesheet" href="<?= e(asset('/assets/css/admin.css')) ?>">
</head>
<body>
<div class="login-wrap">
  <form class="login-card" method="post" action="/admin/login" autocomplete="off">
    <div>
      <h1>Admin sign in</h1>
      <p>MovieLinkBD control panel</p>
    </div>

    <?php if (!empty($error)): ?>
      <div class="flash flash-err"><?= e($error) ?></div>
    <?php endif; ?>

    <input type="hidden" name="_token" value="<?= e($csrf ?? '') ?>">

    <label>Username
      <input type="text" name="username" required autofocus>
    </label>
    <label>Password
      <input type="password" name="password" required>
    </label>

    <button class="btn" type="submit">Sign in</button>
    <p style="text-align:center"><a href="/">← Back to site</a></p>
  </form>
</div>
</body>
</html>
