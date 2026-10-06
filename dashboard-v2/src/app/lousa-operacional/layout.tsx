import type { Metadata } from 'next';
import { APP_VERSION } from '@/version';

export const metadata: Metadata = {
  title: `Lousa Operacional & War Room TV | Mar Brasil ${APP_VERSION}`,
  description: 'Terminal de Controle e Monitoramento Contínuo em Modo TV',
};

export default function WarRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col antialiased selection:bg-cyan-500 selection:text-slate-950">
      {children}
    </div>
  );
}
