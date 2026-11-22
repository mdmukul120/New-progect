import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';

export default async function Home() {
  if (await isAuthed()) redirect('/admin');

  const features = [
    ['জিপ আপলোড', 'ব্রাউজারেই unzip হয় — সার্ভারে বড় ফাইল পাঠানোর দরকার নেই'],
    ['কোড এডিটর', 'HTML, CSS, JS সরাসরি ব্রাউজারে লিখুন, Ctrl+S-এ সেভ'],
    ['সাবডোমেইন', 'প্রতিটি সাইট আলাদা সাবডোমেইনে লাইভ'],
    ['ফাইল ম্যানেজার', 'নতুন ফাইল, রিনেম, ডিলিট — সব প্যানেল থেকেই'],
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-[#8b98a5]">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" /> ব্যক্তিগত হোস্টিং প্যানেল
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        আপনার সাইট, <span className="text-brand">আপনার নিয়ন্ত্রণে</span>
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#8b98a5]">
        একটা জিপ ফেলে দিন — কয়েক সেকেন্ডে সাইট লাইভ। এরপর ব্রাউজার থেকেই কোড লিখুন, ফাইল
        বদলান, মুছে ফেলুন। কোনো FTP নেই, কোনো cPanel নেই।
      </p>

      <div className="mt-8 flex gap-3">
        <Link href="/login" className="btn-primary px-5 py-2.5">
          প্যানেলে ঢুকুন
        </Link>
        <a href="https://nextjs.org/docs" target="_blank" rel="noreferrer" className="btn-ghost px-5 py-2.5">
          ডকুমেন্টেশন
        </a>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {features.map(([title, desc]) => (
          <div key={title} className="card p-5">
            <div className="text-sm font-semibold text-[#e6edf3]">{title}</div>
            <div className="mt-1 text-sm leading-6 text-[#8b98a5]">{desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
