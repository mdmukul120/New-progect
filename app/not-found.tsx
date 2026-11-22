import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <div className="text-5xl font-extrabold text-brand">404</div>
        <p className="mt-3 text-sm text-[#8b98a5]">এই পেজটি খুঁজে পাওয়া যায়নি।</p>
        <Link href="/admin" className="btn-primary mt-6">
          প্যানেলে ফিরুন
        </Link>
      </div>
    </main>
  );
}
