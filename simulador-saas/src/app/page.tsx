'use client';
import React from 'react';
import Link from 'next/link';
import { HeaderNav } from '@/components/layout/HeaderNav';
import { BarChart3, TrendingUp, ShieldCheck, Zap, ArrowRight, Target, Users, Clock, Sparkles, Building2 } from 'lucide-react';
import { APP_VERSION } from '@/version';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      
      {/* Header com botão Voltar ao Início (Regra P0) */}
      <HeaderNav companyName="Portal PME Financial" />

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 flex flex-col items-center text-center">
        
        <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6">
          <Sparkles size={14} className="animate-pulse" />
          <span>Simulador SaaS Standalone Monetizável • {APP_VERSION}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight max-w-4xl leading-tight">
          Simulação Financeira Executiva e Previsibilidade para <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">PMEs até R$ 20M/ano</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mt-4 font-normal leading-relaxed">
          Tome decisões financeiras inteligentes em segundos. Projete contratações, variações de vendas, 
          empréstimos e cortes de custos sem depender de sistemas contábeis engessados.
        </p>

        {/* CTA Principal */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full max-w-sm justify-center">
          <Link
            href="/simulador"
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 text-sm"
          >
            <span>Abrir Simulador Interativo</span>
            <ArrowRight size={18} />
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full">
          
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-4">
              <Clock size={20} />
            </div>
            <h3 className="font-bold text-lg mb-2">Runway de Caixa</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Saiba exatamente quantos meses de caixa sua empresa tem sob diferentes cenários de estresse e vendas.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center mb-4">
              <Target size={20} />
            </div>
            <h3 className="font-bold text-lg mb-2">Ponto de Equilíbrio</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Calcule automaticamente o faturamento bruto mínimo necessário para não ter prejuízo ao contratar ou investir.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center mb-4">
              <Sparkles size={20} />
            </div>
            <h3 className="font-bold text-lg mb-2">Consultor IA Executivo</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Receba recomendações financeiras automatizadas em linguagem simples para apresentação a sócios e bancos.
            </p>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        Simulador Financeiro SaaS Standalone • Versão {APP_VERSION}
      </footer>

    </div>
  );
}
