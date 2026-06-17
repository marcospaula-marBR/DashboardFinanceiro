"use client";

import { useState, useMemo } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  RotateCcw, 
  Plus, 
  FileSpreadsheet,
  Settings,
  Network
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
  onEditContrato: (contract: ContratoBase) => void;
}

export function ComissoesTable({
  contratos,
  recebimentos,
  onAddRecebimento,
  onEditRecebimento,
  onDeleteRecebimento,
  onLiquidateRecebimento,
  onRevertRecebimento,
  isLoading,
  onEditContrato
}: ComissoesTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Agrupa recebimentos por contrato
  const getRecebimentosByContract = (contractId: string) => {
    return recebimentos.filter(r => r.contrato_id === contractId);
  };

  const handleToggleRow = (key: string) => {
    setExpandedId(expandedId === key ? null : key);
  };

  const handleLiquidateClick = (recId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const paidDate = prompt("Insira a data do recebimento (AAAA-MM-DD):", today);
    if (paidDate) {
      onLiquidateRecebimento(recId, paidDate);
    }
  };

  // Returns the earliest invoice date from a list of recebimentos as MM/AAAA
  const getEarliestDate = (recs: typeof recebimentos): string => {
    if (!recs.length) return "—";
    const dates = recs
      .map(r => r.data_recebimento)
      .filter(Boolean)
      .sort();
    if (!dates.length) return "—";
    const [year, month] = dates[0].split("-");
    return `${month}/${year}`;
  };

  // Organiza contratos agrupando por Rede (quando preenchido)
  const tableItems = useMemo(() => {
    const groups: Record<string, ContratoBase[]> = {};
    const singles: ContratoBase[] = [];

    contratos.forEach(c => {
      if (c.rede && c.rede.trim() !== "") {
        const r = c.rede.trim();
        if (!groups[r]) groups[r] = [];
        groups[r].push(c);
      } else {
        singles.push(c);
      }
    });

    const items: (
      | { type: 'single'; key: string; name: string; contract: ContratoBase }
      | { type: 'rede'; key: string; name: string; contracts: ContratoBase[] }
    )[] = [];

    // Adiciona grupos (Redes)
    Object.entries(groups).forEach(([name, list]) => {
      items.push({
        type: 'rede',
        key: `rede-${name}`,
        name,
        contracts: list
      });
    });

    // Adiciona contratos avulsos
    singles.forEach(c => {
      items.push({
        type: 'single',
        key: `single-${c.id}`,
        name: c.nome_contrato,
        contract: c
      });
    });

    // Ordena por nome
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [contratos]);

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
              <th className="py-4 px-6 min-w-[420px]">Contrato / Cliente / Rede</th>
              <th className="py-4 px-4 text-center">Empresa</th>
              <th className="py-4 px-4 text-center">Início</th>
              <th className="py-4 px-4 text-right">Total Faturado</th>
              <th className="py-4 px-4 text-right text-emerald-600">Total Recebido</th>
              <th className="py-4 px-4 text-right text-amber-600">A Receber</th>
              <th className="py-4 px-4 text-right">Total Comissões</th>
              <th className="py-4 px-4 text-center">Lançamentos</th>
              <th className="py-4 px-6 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-sm font-bold">
                  Carregando informações dos contratos...
                </td>
              </tr>
            ) : tableItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-sm italic">
                  Nenhum contrato encontrado.
                </td>
              </tr>
            ) : (
              tableItems.map((item) => {
                const isExpanded = expandedId === item.key;

                if (item.type === 'rede') {
                  // Agrupado sob rede (chapéu)
                  const redeContracts = item.contracts;
                  const redeRecs = recebimentos.filter(r => redeContracts.some(c => c.id === r.contrato_id));

                  const totalFaturado = redeRecs.reduce((sum, r) => sum + r.valor_bruto, 0);
                  const totalRecebido = redeRecs
                    .filter(r => r.status === 'Pago')
                    .reduce((sum, r) => sum + r.valor_bruto, 0);
                  const aReceber = redeRecs
                    .filter(r => r.status === 'Pendente')
                    .reduce((sum, r) => sum + r.valor_bruto, 0);
                  const totalComissoes = redeRecs.reduce(
                    (sum, r) => sum + r.comissoes.reduce((s, c) => s + c.valor_calculado, 0),
                    0
                  );

                  return (
                    <tbody key={item.key} className="border-b border-slate-100">
                      <tr 
                        className={`hover:bg-slate-50 transition-all cursor-pointer group ${isExpanded ? 'bg-amber-50/10' : ''}`}
                        onClick={() => handleToggleRow(item.key)}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-200/20 shrink-0">
                              <Network size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                                👑 REDE: {item.name}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                {redeContracts.length} contratos agrupados sob esta rede
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-[10px] font-black text-slate-400">—</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-[10px] font-black text-slate-500 tabular-nums">
                            {getEarliestDate(redeRecs)}
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
                          {redeRecs.length} faturas
                        </td>
                        <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleRow(item.key)}
                            className={`p-2 rounded-lg border transition-all ${isExpanded ? 'bg-slate-800 text-white border-slate-900' : 'hover:bg-slate-100 text-slate-400 border-transparent'}`}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr onClick={(e) => e.stopPropagation()}>
                          <td colSpan={9} className="p-0 border-t-0 bg-slate-50/50">
                            <div className="p-6 space-y-5 animate-in slide-in-from-top-2 duration-300">
                              
                              {/* Lista de Contratos da Rede */}
                              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                  Contratos Vinculados à Rede
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {redeContracts.map(c => {
                                    const cRecs = getRecebimentosByContract(c.id);
                                    return (
                                      <div key={c.id} className="bg-slate-50 border border-slate-200/50 rounded-xl p-3 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight whitespace-normal break-words">
                                            {c.nome_contrato}
                                          </p>
                                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                            {c.numero_contrato || "Sem número"} • {cRecs.length} faturas
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            onClick={() => onAddRecebimento(c.id)}
                                            className="p-1.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                                            title="Lançar Faturamento"
                                          >
                                            <Plus size={12} /> Lançar
                                          </button>
                                          <button
                                            onClick={() => onEditContrato(c)}
                                            className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-400 rounded-lg transition-all"
                                            title="Configurar Contrato"
                                          >
                                            <Settings size={12} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Histórico Consolidado de Faturamento */}
                              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <FileSpreadsheet size={14} className="text-amber-500" />
                                  Histórico de Faturamento Consolidado da Rede
                                </h4>

                                {redeRecs.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic py-4 text-center">
                                    Nenhum faturamento lançado para esta rede.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                      <thead>
                                        <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                          <th className="py-2.5 px-3">Origem / Contrato</th>
                                          <th className="py-2.5 px-3">Data Ref/Fatura</th>
                                          <th className="py-2.5 px-3">Nota Fiscal</th>
                                          <th className="py-2.5 px-3 text-right">Valor Bruto</th>
                                          <th className="py-2.5 px-3 text-right text-red-500">Glosa</th>
                                          <th className="py-2.5 px-3 text-right text-slate-500">Impostos</th>
                                          <th className="py-2.5 px-3 text-right text-emerald-600 font-bold">Valor Líquido</th>
                                          <th className="py-2.5 px-3 text-center">Status</th>
                                          <th className="py-2.5 px-3">Comissionados</th>
                                          <th className="py-2.5 px-3 text-center">Ações</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-xs">
                                        {redeRecs.sort((a, b) => b.data_recebimento.localeCompare(a.data_recebimento)).map((rec) => (
                                          <tr key={rec.id} className="hover:bg-slate-50/50">
                                            <td className="py-3 px-3 max-w-[150px] truncate">
                                              <span className="bg-amber-50 text-amber-700 border border-amber-100/50 px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block">
                                                {rec.contratoNome}
                                              </span>
                                            </td>
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
                                            <td className="py-3 px-3 text-right text-red-600 font-semibold tabular-nums">
                                              {formatCurrency(rec.glosa || 0)}
                                            </td>
                                            <td className="py-3 px-3 text-right text-slate-600 font-semibold tabular-nums">
                                              {formatCurrency(rec.impostos || 0)}
                                            </td>
                                            <td className="py-3 px-3 text-right font-black text-emerald-600 tabular-nums">
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
                    </tbody>
                  );
                } else {
                  // Contrato avulso (Single)
                  const contract = item.contract;
                  const contractRecs = getRecebimentosByContract(contract.id);

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

                  return (
                    <tbody key={item.key} className="border-b border-slate-100">
                      <tr 
                        className={`hover:bg-slate-50 transition-all cursor-pointer group ${isExpanded ? 'bg-amber-50/20' : ''}`}
                        onClick={() => handleToggleRow(item.key)}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-sm font-black text-amber-600 shrink-0">
                              {contract.nome_contrato.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 uppercase tracking-tight whitespace-normal break-words">
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
                        <td className="py-4 px-4 text-center">
                          <span className="text-[10px] font-black text-slate-500 tabular-nums">
                            {getEarliestDate(contractRecs)}
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
                          {contractRecs.length} faturas
                        </td>
                        <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onAddRecebimento(contract.id)}
                              className="p-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-500 hover:text-white hover:border-amber-600 transition-all shadow-sm flex items-center justify-center"
                              title="Lançar Faturamento"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => onEditContrato(contract)}
                              className="p-2 border border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-400 rounded-lg transition-all"
                              title="Configurar Contrato"
                            >
                              <Settings size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleRow(item.key)}
                              className={`p-2 rounded-lg border transition-all ${isExpanded ? 'bg-slate-800 text-white border-slate-900' : 'hover:bg-slate-100 text-slate-400 border-transparent'}`}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr onClick={(e) => e.stopPropagation()}>
                          <td colSpan={9} className="p-0 border-t-0 bg-slate-50/50">
                            <div className="p-6 animate-in slide-in-from-top-2 duration-300">
                              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <FileSpreadsheet size={14} className="text-amber-500" />
                                  Histórico de Faturamento e Comissões Geradas
                                </h4>

                                {contractRecs.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic py-4 text-center">
                                    Nenhum faturamento lançado para este contrato. Clique em lançar no botão '+' à direita.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                      <thead>
                                        <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                          <th className="py-2.5 px-3">Data Ref/Fatura</th>
                                          <th className="py-2.5 px-3">Nota Fiscal</th>
                                          <th className="py-2.5 px-3 text-right">Valor Bruto</th>
                                          <th className="py-2.5 px-3 text-right text-red-500">Glosa</th>
                                          <th className="py-2.5 px-3 text-right text-slate-500">Impostos</th>
                                          <th className="py-2.5 px-3 text-right text-emerald-600 font-bold">Valor Líquido</th>
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
                                            <td className="py-3 px-3 text-right text-red-600 font-semibold tabular-nums">
                                              {formatCurrency(rec.glosa || 0)}
                                            </td>
                                            <td className="py-3 px-3 text-right text-slate-600 font-semibold tabular-nums">
                                              {formatCurrency(rec.impostos || 0)}
                                            </td>
                                            <td className="py-3 px-3 text-right font-black text-emerald-600 tabular-nums">
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
                    </tbody>
                  );
                }
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
