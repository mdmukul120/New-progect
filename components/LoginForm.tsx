'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'লগইন ব্যর্থ');
      return;
    }
    router.replace('/admin');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="pw">
          পাসওয়ার্ড
        </label>
        <input
          id="pw"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {error && (
        <div className="rounded-lg border border-[#3a1f27] bg-[#241318] px-3 py-2 text-sm text-[#ff8a9b]">
          {error}
        </div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy || !password}>
        {busy ? 'অপেক্ষা করুন…' : 'ঢুকুন'}
      </button>
    </form>
  );
}
