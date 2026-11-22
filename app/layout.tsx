import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SiteHub — ব্যক্তিগত সাইট হোস্টিং',
  description: 'জিপ আপলোড করে সাইট চালান, ব্রাউজারেই কোড এডিট করুন।',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <body>{children}</body>
    </html>
  );
}
