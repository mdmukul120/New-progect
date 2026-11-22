<?php
/**
 * @var array<string,string> $values
 * @var string $csrf
 * @var bool $saved
 */
?>
<div class="topbar">
  <div>
    <h1>Settings</h1>
    <p>Runtime switches stored in the <code>settings</code> table</p>
  </div>
</div>

<?php if ($saved): ?><div class="flash flash-ok">Settings saved.</div><?php endif; ?>

<section class="panel">
  <header><h2>Site</h2></header>
  <div class="panel-body">
    <form method="post" action="/admin/settings" class="form-grid">
      <input type="hidden" name="_token" value="<?= e($csrf) ?>">
      <label class="span-2">Homepage meta title
        <input type="text" name="meta_title_home" value="<?= e($values['meta_title_home'] ?? '') ?>">
      </label>
      <label class="span-2">Homepage meta description
        <textarea name="meta_description" rows="2"><?= e($values['meta_description'] ?? '') ?></textarea>
      </label>
      <label>Notice board
        <select name="notice_enabled">
          <option value="1" <?= ($values['notice_enabled'] ?? '1') === '1' ? 'selected' : '' ?>>Enabled</option>
          <option value="0" <?= ($values['notice_enabled'] ?? '1') === '0' ? 'selected' : '' ?>>Disabled</option>
        </select>
      </label>
      <label>Analytics
        <select name="analytics_enabled">
          <option value="0" <?= ($values['analytics_enabled'] ?? '0') === '0' ? 'selected' : '' ?>>Off (privacy first)</option>
          <option value="1" <?= ($values['analytics_enabled'] ?? '0') === '1' ? 'selected' : '' ?>>On</option>
        </select>
      </label>
      <div style="grid-column:1/-1"><button class="btn" type="submit">Save settings</button></div>
    </form>
  </div>
</section>

<section class="panel">
  <header><h2>Admin password</h2></header>
  <div class="panel-body">
    <form method="post" action="/admin/settings" class="form-grid">
      <input type="hidden" name="_token" value="<?= e($csrf) ?>">
      <label class="span-2">New password (min 8 characters)
        <input type="password" name="new_password" minlength="8" autocomplete="new-password">
      </label>
      <div style="grid-column:1/-1"><button class="btn" type="submit">Update password</button></div>
    </form>
  </div>
</section>
