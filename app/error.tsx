'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="text-4xl">⚠️</div>
        <h1 className="mt-3 text-lg font-semibold">কিছু একটা ভুল হয়েছে</h1>
        <p className="mt-2 text-sm leading-6 text-[#8b98a5]">
          পেজটি লোড করা যায়নি। আবার চেষ্টা করুন — সমস্যা থাকলে ব্রাউজার ক্যাশ পরিষ্কার করে দেখুন।
        </p>
        <p className="mt-3 break-words rounded-lg border border-line bg-[#0d141d] p-3 text-left font-mono text-[11px] text-[#ff8a9b]">
          {error.message}
        </p>
        <button className="btn-primary mt-5" onClick={reset}>
          আবার চেষ্টা করুন
        </button>
      </div>
    </main>
  );
}
