<?php
/**
 * Static info page (about / faq / dmca / privacy).
 *
 * @var array<string,mixed> $page
 * @var array<int,array<string,mixed>> $breadcrumb
 */
?>
<div class="shell">
  <nav class="card-meta" aria-label="Breadcrumb" style="padding-top:16px">
    <?php foreach ($breadcrumb as $index => $crumb): ?>
      <?php if ($index > 0): ?><span class="dot"></span><?php endif; ?>
      <?php if ($index === count($breadcrumb) - 1): ?>
        <span><?= e($crumb['name']) ?></span>
      <?php else: ?>
        <a href="<?= e($crumb['url']) ?>"><?= e($crumb['name']) ?></a>
      <?php endif; ?>
    <?php endforeach; ?>
  </nav>

  <article class="panel mt-4" style="max-width:78ch">
    <h1 style="font-size:clamp(20px,3vw,28px);margin-bottom:10px"><?= e($page['title']) ?></h1>
    <p class="muted" style="font-size:12px;margin-bottom:16px">
      Last updated <?= e(substr((string) $page['updated_at'], 0, 10)) ?>
    </p>
    <div class="title-synopsis" style="max-width:none"><?= e($page['body']) ?></div>
  </article>
</div>
