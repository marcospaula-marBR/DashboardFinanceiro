"use client";

import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Settings2, 
  DollarSign, 
  Landmark, 
  TrendingUp, 
  Save, 
  CheckCircle2 
} from 'lucide-react';
import { WarRoomObligation, WarRoomCompany, PillarId, FollowTheMoneyFlow } from '@/types/war-room';

interface WarRoomManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddObligation: (ob: Omit<WarRoomObligation, 'id' | 'status'>) => void;
  onAddDemand: (pilarId: string, itemData: { titulo: string; prioridade: 'critica' | 'alta' | 'normal'; responsavel?: string }) => void;
  flow: FollowTheMoneyFlow;
  onUpdateFlow: (flow: FollowTheMoneyFlow) => void;
}

export function WarRoomManagementModal({
  isOpen,
  onClose,
  onAddObligation,
  onAddDemand,
  flow,
  onUpdateFlow
}: WarRoomManagementModalProps) {
  const [tab, setTab] = useState<'obrigacao' | 'demanda' | 'flow'>('obrigacao');

  // FORM OBRIGAÇÃO
  const [obTitulo, setObTitulo] = useState('');
  const [obValor, setObValor] = useState('');
  const [obDia, setObDia] = useState('10');
  const [obEmpresa, setObEmpresa] = useState<WarRoomCompany>('MarBR');
  const [obCategoria, setObCategoria] = useState('Impostos');
  const [obRecorrente, setObRecorrente] = useState(true);

  // FORM DEMANDA
  const [demTitulo, setDemTitulo] = useState('');
  const [demPilar, setDemPilar] = useState<PillarId>('contabilidade');
  const [demPrioridade, setDemPrioridade] = useState<'critica' | 'alta' | 'normal'>('alta');
  const [demResponsavel, setDemResponsavel] = useState('');

  // FORM FLOW
  const [flowState, setFlowState] = useState<FollowTheMoneyFlow>(flow);

  if (!isOpen) return null;

  const handleSubmitObligation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!obTitulo.trim()) return alert('Informe o título da obrigação.');
    const val = parseFloat(obValor.replace(',', '.'));
    if (isNaN(val) || val <= 0) return alert('Informe um valor válido.');

    onAddObligation({
      titulo: obTitulo.trim(),
      valor: val,
      diaVencimento: parseInt(obDia, 10) || 1,
      empresa: obEmpresa,
      categoria: obCategoria,
      recorrente: obRecorrente,
    });

    setObTitulo('');
    setObValor('');
    alert('Obrigação adicionada com sucesso!');
    onClose();
  };

  const handleSubmitDemand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demTitulo.trim()) return alert('Informe o título da demanda.');

    onAddDemand(demPilar, {
      titulo: demTitulo.trim(),
      prioridade: demPrioridade,
      responsavel: demResponsavel.trim() || undefined,
    });

    setDemTitulo('');
    setDemResponsavel('');
    alert('Demanda adicionada ao pilar com sucesso!');
    onClose();
  };

  const handleSubmitFlow = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...flowState,
      ultimaAtualizacao: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    onUpdateFlow(updated);
    alert('Valores do Follow The Money atualizados!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
              <Settings2 size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                Painel de Gestão & Alimentação Rápida
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Alimente a lousa operacional pelo desktop ou smartphone
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* ABAS */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2">
          <button
            onClick={() => setTab('obrigacao')}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              tab === 'obrigacao'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            + Nova Obrigação
          </button>
          <button
            onClick={() => setTab('demanda')}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              tab === 'demanda'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            + Nova Demanda (5 Pilares)
          </button>
          <button
            onClick={() => setTab('flow')}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              tab === 'flow'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Follow The Money (Valores)
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="p-5 overflow-y-auto flex-1">
          
          {/* TAB 1: NOVA OBRIGAÇÃO */}
          {tab === 'obrigacao' && (
            <form onSubmit={handleSubmitObligation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Título da Obrigação
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: DAS Simples Nacional, FGTS, Fatura Clara..."
                  value={obTitulo}
                  onChange={e => setObTitulo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 15400.00"
                    value={obValor}
                    onChange={e => setObValor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Dia do Vencimento (1 a 31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={obDia}
                    onChange={e => setObDia(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Empresa (Omie)
                  </label>
                  <select
                    value={obEmpresa}
                    onChange={e => setObEmpresa(e.target.value as WarRoomCompany)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="MarBR">Mar Brasil</option>
                    <option value="DZM">DZM Ltda</option>
                    <option value="G2">G2 Tecnologia</option>
                    <option value="Conectius">Conectius</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={obCategoria}
                    onChange={e => setObCategoria(e.target.value)}
                    placeholder="Impostos, Pessoal, Cartões, Fornecedores..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="recorrente"
                  checked={obRecorrente}
                  onChange={e => setObRecorrente(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-950"
                />
                <label htmlFor="recorrente" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Custo recorrente mensal contínuo
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-md cursor-pointer mt-3"
              >
                Cadastrar Obrigação na Lousa
              </button>
            </form>
          )}

          {/* TAB 2: NOVA DEMANDA DOS 5 PILARES */}
          {tab === 'demanda' && (
            <form onSubmit={handleSubmitDemand} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Pilar Estratégico
                </label>
                <select
                  value={demPilar}
                  onChange={e => setDemPilar(e.target.value as PillarId)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="contabilidade">Pilar 1: Contabilidade & Governança</option>
                  <option value="gateways">Pilar 2: Gateways & Meios de Pagamento</option>
                  <option value="cambio">Pilar 3: Fluxos Internacionais & Câmbio</option>
                  <option value="remessa">Pilar 4: Remessa Conforme & Regularidade</option>
                  <option value="lancamentos">Pilar 5: Planejamento & Recorrentes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Descrição da Demanda / Checklist
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Conciliar extrato bancário do Sicredi..."
                  value={demTitulo}
                  onChange={e => setDemTitulo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Nível de Prioridade
                  </label>
                  <select
                    value={demPrioridade}
                    onChange={e => setDemPrioridade(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="critica">🔴 Crítica</option>
                    <option value="alta">🟡 Alta</option>
                    <option value="normal">🔵 Normal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Responsável (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Fiscal, DP, TI, CFO..."
                    value={demResponsavel}
                    onChange={e => setDemResponsavel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-md cursor-pointer mt-3"
              >
                Adicionar Demanda ao Pilar
              </button>
            </form>
          )}

          {/* TAB 3: AJUSTAR FOLLOW THE MONEY */}
          {tab === 'flow' && (
            <form onSubmit={handleSubmitFlow} className="space-y-4">
              <p className="text-xs text-slate-400">
                Ajuste os valores nominais e as taxas da esteira de liquidação para o teste da equipe:
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Volume Origem (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={flowState.origemValor}
                    onChange={e => setFlowState({ ...flowState, origemValor: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Taxa Processadora (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={flowState.processadoraTaxa}
                    onChange={e => setFlowState({ ...flowState, processadoraTaxa: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Saldo Intermediária (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={flowState.intermediariaValor}
                    onChange={e => setFlowState({ ...flowState, intermediariaValor: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Caixa Final Omie (BRL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={flowState.contaFinalValor}
                    onChange={e => setFlowState({ ...flowState, contaFinalValor: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Spread Total Operacional (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={flowState.taxaPercentualGlobal}
                  onChange={e => setFlowState({ ...flowState, taxaPercentualGlobal: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-colors shadow-md cursor-pointer mt-3"
              >
                Salvar Calibração do Flow
              </button>
            </form>
          )}

        </div>

      </div>
    </div>
  );
}
