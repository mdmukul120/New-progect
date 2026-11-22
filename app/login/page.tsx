import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';

export default async function LoginPage() {
  if (await isAuthed()) redirect('/admin');
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-2xl font-extrabold tracking-tight">
            Site<span className="text-brand">Hub</span>
          </div>
          <p className="mt-1 text-sm text-[#8b98a5]">প্যানেলে ঢুকতে পাসওয়ার্ড দিন</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
