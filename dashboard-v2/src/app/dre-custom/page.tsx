'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DreCustomRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dre-simulador');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-200">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        <p className="text-sm font-medium">Redirecionando para o Simulador DRE (/dre-simulador)...</p>
      </div>
    </div>
  );
}
