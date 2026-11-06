import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AzTU Kamikaze İDA | Komanda Qəbulu',
  description: 'AzTU Kamikaze İnsansız Dəniz Aracı Mühendislik Takımı Giriş Mülakatı ve Başvuru Portalı',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
