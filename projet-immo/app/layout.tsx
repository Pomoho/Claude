import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ImmoGuide IDF — Votre conseiller immobilier',
  description: 'Trouvez la meilleure stratégie immobilière en Île-de-France : acheter ou louer, neuf ou ancien, quelle ville choisir.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
