"use client";

import { useState } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  RotateCcw, 
  Plus, 
  FileSpreadsheet 
} from "lucide-react";
import { ContratoBase, Recebimento } from "@/types/comissoes";
import { formatCurrency, formatDate } from "@/services/comissoes.service";

interface ComissoesTableProps {
  contratos: ContratoBase[];
  recebimentos: Recebimento[];
  onAddRecebimento: (contractId: string) => void;
  onEditRecebimento: (rec: Recebimento) => void;
  onDeleteRecebimento: (id: string) => void;
  onLiquidateRecebimento: (id: string, paidDate: string) => void;
  onRevertRecebimento: (id: string) => void;
  isLoading: boolean;
}

export function ComissoesTable({
  contratos,
  recebimentos,
  onAddRecebimento,
  onEditRecebimento,
  onDeleteRecebimento,
  onLiquidateRecebimento,
  onRevertRecebimento,
  isLoading
}: ComissoesTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Agrupa recebimentos por contrato
  const getRecebimentosByContract = (contractId: string) => {
    return recebimentos.filter(r => r.contrato_id === contractId);
  };

  const handleToggleRow = (contractId: string) => {
    setExpandedId(expandedId === contractId ? null : contractId);
  };

  const handleLiquidateClick = (recId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const paidDate = prompt("Insira a data do recebimento (AAAA-MM-DD):", today);
    if (paidDate) {
      onLiquidateRecebimento(recId, paidDate);
    }
  };

  return (
    <div className="card-premium overflow-hidden mt-6">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
          Listagem de Contratos & Faturamentos
          <span className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px] text-slate-500 font-bold">
            {contratos.length} CONTRATOS
          </span>
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/80 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-100">
              <th className="py-4 px-6 min-w-[280px]">Contrato / Cliente</th>
              <th className="py-4 px-4 text-center">Empresa</th>
              <th className="py-4 px-4 text-right">Total Faturado</th>
              <th className="py-4 px-4 text-right text-emerald-600">Total Recebido</th>
              <th className="py-4 px-4 text-right text-amber-600">A Receber</th>
              <th className="py-4 px-4 text-right">Total Comissões</th>
              <th className="py-4 px-4 text-center">Parcelas</th>
              <th className="py-4 px-6 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-sm font-bold">
                  Carregando informações dos contratos...
                </td>
              </tr>
            ) : contratos.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-sm italic">
                  Nenhum contrato encontrado.
                </td>
              </tr>
            ) : (
              contratos.map((contract) => {
                const contractRecs = getRecebimentosByContract(contract.id);
                
                // Cálculos
                const totalFaturado = contractRecs.reduce((sum, r) => sum + r.valor_bruto, 0);
                const totalRecebido = contractRecs
                  .filter(r => r.status === 'Pago')
                  .reduce((sum, r) => sum + r.valor_bruto, 0);
                const aReceber = contractRecs
                  .filter(r => r.status === 'Pendente')
                  .reduce((sum, r) => sum + r.valor_bruto, 0);
                
                const totalComissoes = contractRecs.reduce(
                  (sum, r) => sum + r.comissoes.reduce((s, c) => s + c.valor_calculado, 0),
                  0
                );

                const isExpanded = expandedId === contract.id;

                return (
                  <>
                    <tr 
                      className={`hover:bg-slate-50 transition-all cursor-pointer group ${isExpanded ? 'bg-amber-50/20' : ''}`}
                      onClick={() => handleToggleRow(contract.id)}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-sm font-black text-amber-600 shrink-0`}>
                            {contract.nome_contrato.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight line-clamp-1">
                              {contract.nome_contrato}
                            </p>
                            {contract.numero_contrato && (
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                NF/REF: {contract.numero_contrato}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-sm">
                          {contract.empresa || 'MarBR'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right text-sm font-bold text-slate-700 tabular-nums">
                        {formatCurrency(totalFaturado)}
                      </td>
                      <td className="py-4 px-4 text-right text-sm font-bold text-emerald-600 tabular-nums">
                        {formatCurrency(totalRecebido)}
                      </td>
                      <td className="py-4 px-4 text-right text-sm font-bold text-amber-600 tabular-nums">
                        {formatCurrency(aReceber)}
                      </td>
                      <td className="py-4 px-4 text-right text-sm font-bold text-slate-700 tabular-nums">
                        {formatCurrency(totalComissoes)}
                      </td>
                      <td className="py-4 px-4 text-center text-xs font-bold text-slate-600">
                        {contractRecs.length} lançadas
                      </td>
                      <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onAddRecebimento(contract.id)}
                            className="p-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-500 hover:text-white hover:border-amber-600 transition-all shadow-sm flex items-center justify-center"
                            title="Lançar Faturamento"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleRow(contract.id)}
                            className={`p-2 rounded-lg border transition-all ${isExpanded ? 'bg-slate-800 text-white border-slate-900' : 'hover:bg-slate-100 text-slate-400 border-transparent'}`}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr onClick={(e) => e.stopPropagation()}>
                        <td colSpan={8} className="p-0 border-t-0 bg-slate-50/50">
                          <div className="p-6 animate-in slide-in-from-top-2 duration-300">
                            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileSpreadsheet size={14} className="text-amber-500" />
                                Histórico de Faturamento e Comissões Geradas
                              </h4>

                              {contractRecs.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-4 text-center">
                                  {"Nenhum faturamento lançado para este contrato. Clique em lançar no botão '+' à direita."}
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="py-2.5 px-3">Data Ref/Fatura</th>
                                        <th className="py-2.5 px-3">Nota Fiscal</th>
                                        <th className="py-2.5 px-3 text-right">Valor Bruto</th>
                                        <th className="py-2.5 px-3 text-right">Valor Líquido</th>
                                        <th className="py-2.5 px-3 text-center">Status</th>
                                        <th className="py-2.5 px-3">Comissionados</th>
                                        <th className="py-2.5 px-3 text-center">Ações</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                      {contractRecs.map((rec) => (
                                        <tr key={rec.id} className="hover:bg-slate-50/50">
                                          <td className="py-3 px-3 font-semibold text-slate-700">
                                            {formatDate(rec.data_recebimento)}
                                            {rec.ciclo && (
                                              <span className="text-[9px] text-slate-400 block font-normal">
                                                Ciclo: {rec.ciclo}
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-3 px-3 text-slate-600 font-mono">
                                            {rec.nota_fiscal || "—"}
                                          </td>
                                          <td className="py-3 px-3 text-right font-semibold text-slate-700 tabular-nums">
                                            {formatCurrency(rec.valor_bruto)}
                                          </td>
                                          <td className="py-3 px-3 text-right font-semibold text-slate-600 tabular-nums">
                                            {formatCurrency(rec.valor_liquido)}
                                          </td>
                                          <td className="py-3 px-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                              rec.status === 'Pago' 
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                : 'bg-amber-100 text-amber-700 border border-amber-200'
                                            }`}>
                                              {rec.status === 'Pago' ? 'RECEBIDO' : 'A RECEBER'}
                                            </span>
                                          </td>
                                          <td className="py-3 px-3 max-w-[200px] truncate">
                                            {rec.comissoes.length === 0 ? (
                                              <span className="text-slate-400 italic">Nenhuma</span>
                                            ) : (
                                              <div className="flex flex-wrap gap-1">
                                                {rec.comissoes.map(c => (
                                                  <span 
                                                    key={c.id} 
                                                    className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold"
                                                    title={`${c.membroNome}: ${formatCurrency(c.valor_calculado)} (${(c.porcentagem * 100).toFixed(2)}%)`}
                                                  >
                                                    {c.membroNome?.split(" ")[0]} ({formatCurrency(c.valor_calculado)})
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </td>
                                          <td className="py-3 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                              {rec.status === 'Pendente' ? (
                                                <button
                                                  onClick={() => handleLiquidateClick(rec.id)}
                                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                                  title="Dar Baixa (Recebido)"
                                                >
                                                  <CheckCircle2 size={14} />
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() => onRevertRecebimento(rec.id)}
                                                  className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                                                  title="Estornar quitação"
                                                >
                                                  <RotateCcw size={14} />
                                                </button>
                                              )}
                                              <button
                                                onClick={() => onEditRecebimento(rec)}
                                                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                                                title="Editar"
                                              >
                                                <Edit size={14} />
                                              </button>
                                              <button
                                                onClick={() => onDeleteRecebimento(rec.id)}
                                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                title="Excluir"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
