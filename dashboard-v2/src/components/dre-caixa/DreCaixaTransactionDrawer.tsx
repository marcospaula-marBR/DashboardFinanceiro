"use client";

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  DollarSign,
  User,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { DreCaixaLancamento } from '@/types/dre-caixa';
import { formatCurrencyBRL } from '@/services/dre-caixa.service';

interface DreCaixaTransactionDrawerProps {
  lancamento: DreCaixaLancamento | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DreCaixaTransactionDrawer({
  lancamento,
  isOpen,
  onClose
}: DreCaixaTransactionDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !lancamento) return null;

  const isEntrada = lancamento.tipo === 'RECEBER';
  const isAtrasado = (lancamento.dias_atraso || 0) > 0;
  const impostos = lancamento.impostos_retidos;
  const hasImpostos = impostos && impostos.total > 0;

  const handleCopySummary = () => {
    const text = `
Resumo do Lançamento — ${lancamento.fornecedor_cliente}
Valor: ${formatCurrencyBRL(lancamento.valor)} (${isEntrada ? 'Recebimento' : 'Pagamento'})
Data de Liquidação: ${lancamento.data_pagamento}
Data de Vencimento: ${lancamento.data_vencimento || 'N/A'}
Status: ${lancamento.status} (${lancamento.dias_atraso ? `Atraso de ${lancamento.dias_atraso} dias` : 'Em dia'})
Empresa: ${lancamento.empresa}
Projeto/Setor: ${lancamento.projeto}
Categoria: ${lancamento.categoria}
Conta: ${lancamento.conta_corrente}
Doc: ${lancamento.numero_documento || 'N/D'} | ID Omie: ${lancamento.omie_id || 'N/D'}
    `.trim();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop com desfoque elegante */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition ease-in-out duration-300">
          
          {/* Header Executivo */}
          <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-md ${
                  isEntrada ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {isEntrada ? '+' : '-'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wider uppercase px-2 py-0.5 rounded bg-white/10 text-white/90">
                    {isEntrada ? 'Entrada / Receita' : 'Saída / Despesa'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <ShieldCheck size={12} />
                    Conciliado no Extrato
                  </span>
                </div>
                <h3 className="text-lg font-black tracking-tight text-white mt-0.5 truncate max-w-sm" title={lancamento.fornecedor_cliente}>
                  {lancamento.fornecedor_cliente}
                </h3>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopySummary}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Copiar resumo do lançamento"
              >
                {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Valor Principal em Destaque */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Valor Efetivo Depositado / Pago
              </span>
              <div className={`text-2xl sm:text-3xl font-black tracking-tight ${
                isEntrada ? 'text-emerald-700' : 'text-slate-900'
              }`}>
                {formatCurrencyBRL(lancamento.valor)}
              </div>
            </div>

            {/* Badge de Pontualidade */}
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Pontualidade
              </span>
              {isAtrasado ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 border border-rose-200 text-rose-700 shadow-sm">
                  <AlertTriangle size={13} />
                  Atraso de {lancamento.dias_atraso} {lancamento.dias_atraso === 1 ? 'dia' : 'dias'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Liquidado em Dia (0 dias)
                </span>
              )}
            </div>
          </div>

          {/* Corpo do Drawer com Scroll */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* 1. Timeline de Liquidação Financeira */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                <Clock size={14} className="text-indigo-600" />
                Linha do Tempo da Operação
              </h4>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Emissão
                  </span>
                  <span className="text-xs font-black text-slate-800 mt-1 block">
                    {lancamento.data_emissao ? lancamento.data_emissao.split('-').reverse().join('/') : 'N/D'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Vencimento
                  </span>
                  <span className="text-xs font-black text-slate-800 mt-1 block">
                    {lancamento.data_vencimento ? lancamento.data_vencimento.split('-').reverse().join('/') : 'N/D'}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                    Compensação (Caixa)
                  </span>
                  <span className="text-xs font-black text-indigo-900 mt-1 block">
                    {lancamento.data_pagamento ? lancamento.data_pagamento.split('-').reverse().join('/') : 'N/D'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Raio-X Tributário (Retenções na Fonte) */}
            {hasImpostos && (
              <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 shadow-sm">
                <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <DollarSign size={14} className="text-amber-700" />
                    Raio-X Tributário & Retenções
                  </span>
                  <span className="text-[11px] font-bold text-amber-800">
                    Retenção Total: {formatCurrencyBRL(impostos.total)}
                  </span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {impostos.ir > 0 && (
                    <div className="bg-white p-2 rounded border border-amber-100">
                      <span className="text-[10px] text-slate-400 block font-bold">IRRF Retido</span>
                      <span className="font-extrabold text-slate-800">{formatCurrencyBRL(impostos.ir)}</span>
                    </div>
                  )}
                  {impostos.iss > 0 && (
                    <div className="bg-white p-2 rounded border border-amber-100">
                      <span className="text-[10px] text-slate-400 block font-bold">ISS Retido</span>
                      <span className="font-extrabold text-slate-800">{formatCurrencyBRL(impostos.iss)}</span>
                    </div>
                  )}
                  {impostos.pis > 0 && (
                    <div className="bg-white p-2 rounded border border-amber-100">
                      <span className="text-[10px] text-slate-400 block font-bold">PIS Retido</span>
                      <span className="font-extrabold text-slate-800">{formatCurrencyBRL(impostos.pis)}</span>
                    </div>
                  )}
                  {impostos.cofins > 0 && (
                    <div className="bg-white p-2 rounded border border-amber-100">
                      <span className="text-[10px] text-slate-400 block font-bold">COFINS Retido</span>
                      <span className="font-extrabold text-slate-800">{formatCurrencyBRL(impostos.cofins)}</span>
                    </div>
                  )}
                  {impostos.csll > 0 && (
                    <div className="bg-white p-2 rounded border border-amber-100">
                      <span className="text-[10px] text-slate-400 block font-bold">CSLL Retido</span>
                      <span className="font-extrabold text-slate-800">{formatCurrencyBRL(impostos.csll)}</span>
                    </div>
                  )}
                  {lancamento.valor_bruto && lancamento.valor_bruto > lancamento.valor && (
                    <div className="bg-white p-2 rounded border border-amber-100">
                      <span className="text-[10px] text-slate-400 block font-bold">Valor Bruto NF</span>
                      <span className="font-extrabold text-slate-800">{formatCurrencyBRL(lancamento.valor_bruto)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Classificação & Centro de Custo */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-600" />
                Classificação Contábil & Setorial
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Empresa</span>
                  <span className="font-bold text-slate-900 px-2.5 py-0.5 rounded bg-slate-100">
                    {lancamento.empresa}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Projeto / Setor Omie</span>
                  <span className="font-extrabold text-indigo-700 text-right max-w-xs truncate">
                    {lancamento.projeto}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Categoria Financeira</span>
                  <span className="font-bold text-slate-800 text-right max-w-xs truncate">
                    {lancamento.categoria}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Conta Corrente / Banco</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1 text-right">
                    <CreditCard size={13} className="text-slate-400" />
                    {lancamento.conta_corrente}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Documento / RPS / NF</span>
                  <span className="font-extrabold text-slate-900 font-mono">
                    {lancamento.numero_documento || 'Sem Documento'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Modalidade / Parcelamento</span>
                  <span className="font-bold text-slate-700">
                    {lancamento.tipo_pagamento === 'PARCELADO' ? `Parcelado (${lancamento.numero_parcela})` : 'À Vista (1/1)'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Rateio por Departamento (se houver múltiplos centros) */}
            {lancamento.rateios && lancamento.rateios.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <FileSpreadsheet size={14} className="text-indigo-600" />
                  Composição do Rateio por Centro de Custo
                </h4>

                <div className="space-y-1.5">
                  {lancamento.rateios.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-100">
                      <span className="text-slate-700 font-bold truncate max-w-[240px]">{r.departamento}</span>
                      <div className="flex items-center gap-2">
                        {r.percentual > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                            {r.percentual.toFixed(1)}%
                          </span>
                        )}
                        <span className="font-black text-slate-900">{formatCurrencyBRL(r.valor)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Dados Fiscais e Rastreabilidade Omie */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-2.5 text-xs">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-slate-500" />
                Rastreabilidade no Omie ERP
              </h4>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">ID Lançamento Omie</span>
                  <span className="font-mono font-bold text-slate-800">{lancamento.omie_id || 'N/A'}</span>
                </div>
                {lancamento.cnpj_cpf && (
                  <div>
                    <span className="text-slate-400 block">CNPJ / CPF</span>
                    <span className="font-mono font-bold text-slate-800">{lancamento.cnpj_cpf}</span>
                  </div>
                )}
                {lancamento.contrato_omie && (
                  <div>
                    <span className="text-slate-400 block">Contrato / Pedido</span>
                    <span className="font-bold text-slate-800">{lancamento.contrato_omie}</span>
                  </div>
                )}
                {lancamento.uInc && (
                  <div>
                    <span className="text-slate-400 block">Usuário de Inclusão</span>
                    <span className="font-bold text-slate-800">{lancamento.uInc}</span>
                  </div>
                )}
              </div>

              {lancamento.observacoes && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase mb-1">
                    Observações Registradas no ERP
                  </span>
                  <p className="text-slate-700 text-xs bg-white p-2.5 rounded border border-slate-200 break-words whitespace-pre-wrap">
                    {lancamento.observacoes}
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Rodapé Fixo com Botão Fechar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">
              Dados auditados via API oficial do Omie ERP
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-sm"
            >
              Fechar Detalhes
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
