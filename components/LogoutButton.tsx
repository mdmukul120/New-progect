'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await fetch('/api/login', { method: 'DELETE' });
        router.replace('/login');
        router.refresh();
      }}
    >
      লগআউট
    </button>
  );
}
