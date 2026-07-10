import type { Metadata } from 'next';
import { APP_VERSION } from '@/version';

export const metadata: Metadata = {
  title: `Seguros | Gestão de Apólices | Mar Brasil ${APP_VERSION}`,
  description:
    'Gestão centralizada de apólices de seguro do Grupo Mar Brasil. Controle de vigências, prêmios, corretores e alertas de vencimento.',
  robots: 'noindex, nofollow', // Portal interno
};

export default function SegurosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
