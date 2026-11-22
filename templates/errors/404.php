<?php
/** @var string $path */
?>
<div class="shell">
  <div class="empty-state" style="margin:60px 0;padding:80px 20px">
    <span style="font-size:52px">🎬</span>
    <b style="font-size:24px">404 — page not found</b>
    <span class="mono" style="color:var(--text-3)"><?= e($path ?? '/') ?></span>
    <div class="hero-actions" style="justify-content:center;margin-top:12px">
      <a class="btn btn-primary" href="/">Back to home</a>
      <a class="btn btn-ghost" href="/search">Search titles</a>
    </div>
  </div>
</div>
