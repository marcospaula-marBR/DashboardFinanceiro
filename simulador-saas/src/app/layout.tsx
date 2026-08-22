import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Simulador Financeiro SaaS para PMEs',
  description: 'Ferramenta standalone de simulação executiva de cenários, runway de caixa e ponto de equilíbrio para pequenas e médias empresas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased text-slate-900 bg-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
