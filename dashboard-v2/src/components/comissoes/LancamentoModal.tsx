"use client";

import { useState, useEffect, useMemo } from "react";
import { Membro, ContratoBase, Recebimento, DivisaoInput } from "@/types/comissoes";
import { formatCurrency } from "@/services/comissoes.service";
import { X, Plus, AlertCircle, CheckCircle2 } from "lucide-react";

interface LancamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    contrato_id: string;
    data_recebimento: string;
    nota_fiscal: string;
    ciclo: string;
    valor_bruto: number;
    valor_liquido: number;
    status: string;
    divisoes: DivisaoInput[];
    editId?: string;
  }) => Promise<void>;
  onNovoContrato: () => void;
  equipe: Membro[];
  contratos: ContratoBase[];
  editData?: Recebimento | null;
}

export function LancamentoModal({
  isOpen,
  onClose,
  onSave,
  onNovoContrato,
  equipe,
  contratos,
  editData,
}: LancamentoModalProps) {
  const [contratoId, setContratoId] = useState("");
  const [data, setData] = useState("");
  const [nf, setNf] = useState("");
  const [ciclo, setCiclo] = useState("");
  const [bruto, setBruto] = useState("");
  const [liquido, setLiquido] = useState("");
  const [status, setStatus] = useState("Pago"); // "Pago" | "Pendente"
  const [divisoes, setDivisoes] = useState<DivisaoInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membrosAtivos = useMemo(() => equipe.filter(m => m.ativo), [equipe]);
  const liquidoNum = parseFloat(liquido) || 0;
  
  // A soma dos percentuais cadastrados deve dar exatamente 1.00% (como padrão do rateio comercial)
  const totalPct = divisoes.reduce((s, d) => s + d.porcentagem, 0);
  const pctOk = Math.abs(totalPct - 1.0) < 0.001;

  // Inicializa o formulário ao abrir
  useEffect(() => {
    if (!isOpen) return;

    if (editData) {
      // Modo edição
      setContratoId(editData.contrato_id);
      setData(editData.data_recebimento);
      setNf(editData.nota_fiscal ?? "");
      setCiclo(editData.ciclo ?? "");
      setBruto(String(editData.valor_bruto));
      setLiquido(String(editData.valor_liquido));
      setStatus(editData.status || "Pago");
      
      // Mapeia divisões existentes ou aplica o percentual ativo
      setDivisoes(membrosAtivos.map(m => {
        const com = editData.comissoes.find(c => c.membro_id === m.id);
        return {
          membro_id: m.id,
          nome: m.nome,
          porcentagem: com ? com.porcentagem * 100 : (m.pct_padrao * 100),
          valor_calculado: com?.valor_calculado ?? 0,
        };
      }));
    } else {
      // Modo criação
      setContratoId("");
      setData(new Date().toISOString().slice(0, 10));
      setNf("");
      setCiclo("");
      setBruto("");
      setLiquido("");
      setStatus("Pendente"); // Inicia como Pendente para controle de baixa de fatura
      
      setDivisoes(membrosAtivos.map(m => ({
        membro_id: m.id,
        nome: m.nome,
        porcentagem: m.pct_padrao * 100,
        valor_calculado: 0,
      })));
    }
    setError(null);
  }, [isOpen, editData, membrosAtivos]);

  // Recalcula o valor calculado em reais sempre que o líquido ou as divisões mudam
  useEffect(() => {
    setDivisoes(prev =>
      prev.map(d => ({
        ...d,
        valor_calculado: Number((liquidoNum * (d.porcentagem / 100)).toFixed(2)),
      }))
    );
  }, [liquidoNum]);

  const handlePctChange = (membroId: string, pct: number) => {
    setDivisoes(prev =>
      prev.map(d =>
        d.membro_id === membroId
          ? { ...d, porcentagem: pct, valor_calculado: Number((liquidoNum * (pct / 100)).toFixed(2)) }
          : d
      )
    );
  };

  const handleSubmit = async () => {
    if (!contratoId) {
      setError("Selecione um contrato.");
      return;
    }
    if (!data) {
      setError("Informe a data de referência.");
      return;
    }
    if (!liquido || parseFloat(liquido) <= 0) {
      setError("Informe o valor líquido faturado.");
      return;
    }
    if (!pctOk && divisoes.length > 0) {
      setError(`A soma das comissões distribuídas deve ser exatamente 1,00%. Atual: ${totalPct.toFixed(2)}%`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        contrato_id: contratoId,
        data_recebimento: data,
        nota_fiscal: nf,
        ciclo,
        valor_bruto: parseFloat(bruto) || parseFloat(liquido),
        valor_liquido: parseFloat(liquido),
        status,
        divisoes,
        editId: editData?.id,
      });
      onClose();
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Erro ao salvar faturamento.";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
              {editData ? "Editar Faturamento" : "Lançar Faturamento"}
            </h2>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Registre a emissão da fatura do contrato e defina o rateio de comissão comercial.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Contrato e Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Contrato / Cliente *
              </label>
              <div className="flex gap-2">
                <select
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  value={contratoId}
                  onChange={e => setContratoId(e.target.value)}
                >
                  <option value="">Selecione um contrato...</option>
                  {contratos.map(c => (
                    <option key={c.id} value={c.id}>{c.nome_contrato}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onNovoContrato}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all flex items-center justify-center shadow-sm shrink-0"
                  title="Novo contrato"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Status Faturamento
              </label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="Pendente">A RECEBER</option>
                <option value="Pago">RECEBIDO</option>
              </select>
            </div>
          </div>

          {/* Data, NF, Ciclo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Data Vencimento/Ref *
              </label>
              <input
                type="date"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                value={data}
                onChange={e => setData(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Nota Fiscal / ID
              </label>
              <input
                type="text"
                placeholder="Ex: NF-293"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                value={nf}
                onChange={e => setNf(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Mês Competência
              </label>
              <input
                type="month"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                value={ciclo}
                onChange={e => setCiclo(e.target.value)}
              />
            </div>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Valor Faturado Bruto
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  value={bruto}
                  onChange={e => setBruto(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Valor Recebido Líquido *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  value={liquido}
                  onChange={e => setLiquido(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Divisão de Comissões */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Rateio da Comissão Comercial
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Distribuição do pool de comissão da venda (soma recomendada de 1.00%).</p>
              </div>
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md border flex items-center gap-1.5 shadow-sm ${
                pctOk
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}>
                {pctOk && <CheckCircle2 size={12} />}
                Soma: {totalPct.toFixed(2)}%
              </span>
            </div>

            {membrosAtivos.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">
                Nenhum membro da equipe ativo. Habilite comissionados no painel de equipe primeiro.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {divisoes.map(d => (
                  <div key={d.membro_id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{d.nome}</p>
                      <p className="text-[10px] font-bold text-slate-500 mt-1 tabular-nums">
                        {formatCurrency(d.valor_calculado)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-black text-right text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        value={d.porcentagem}
                        onChange={e => handlePctChange(d.membro_id, parseFloat(e.target.value) || 0)}
                      />
                      <span className="text-[10px] font-bold text-slate-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alerta de erro */}
          {error && (
            <div className="flex items-center gap-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSaving ? "Salvando..." : editData ? "Salvar Alterações" : "Confirmar Lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
