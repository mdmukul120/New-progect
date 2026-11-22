import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';
import { store } from '@/lib/store';
import Dashboard from '@/components/Dashboard';
import LogoutButton from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await isAuthed())) redirect('/login');

  const sites = await store().list();
  const rootDomain = process.env.ROOT_DOMAIN || '';
  const defaultSite = process.env.DEFAULT_SITE || '';
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold tracking-tight">
            Site<span className="text-brand">Hub</span>
          </div>
          <p className="mt-0.5 text-xs text-[#8b98a5]">
            স্টোরেজ: <span className="text-[#c8d3df]">{driver}</span>
            {rootDomain ? (
              <>
                {' · '}রুট ডোমেইন: <span className="font-mono text-[#c8d3df]">*.{rootDomain}</span>
              </>
            ) : null}
            {defaultSite ? (
              <>
                {' · '}ডিফল্ট সাইট: <span className="font-mono text-[#c8d3df]">{defaultSite}</span>
              </>
            ) : null}
          </p>
        </div>
        <LogoutButton />
      </header>

      <Dashboard initialSites={sites} rootDomain={rootDomain} defaultSite={defaultSite} />
    </main>
  );
}
