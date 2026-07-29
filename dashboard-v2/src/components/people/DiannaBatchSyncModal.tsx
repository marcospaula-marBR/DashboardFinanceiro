import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Database, Search, CheckCircle2, AlertTriangle, UserPlus, 
  Loader2, Check, RefreshCw, Layers, ShieldCheck, ArrowRight, UserCheck
} from 'lucide-react';
import { Employee, MonthlyCost } from '@/types/loans';
import { PeopleService } from '@/services/people.service';
import { PeopleHRService } from '@/services/people-hr.service';
import { findBestNameMatch, NameMatchResult } from '@/utils/nameSimilarity';

interface DiannaStructuredEmp {
  nome: string;
  status: string;
  setor: string;
  cargo_inicial: string;
  ultimo_cargo: string;
  data_admissao?: string | null;
  data_desligamento?: string | null;
  competencias: Record<string, Record<string, number>>;
  tipo_vinculo?: string;
}

interface DiannaBatchSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employees: Employee[];
}

export function DiannaBatchSyncModal({
  isOpen,
  onClose,
  onSuccess,
  employees
}: DiannaBatchSyncModalProps) {
  const [isLoadingLake, setIsLoadingLake] = useState(false);
  const [diannaList, setDiannaList] = useState<DiannaStructuredEmp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Mapeia para cada índice da Dianna: { mode: 'link' | 'new', targetId?: string }
  const [resolutionMap, setResolutionMap] = useState<Record<number, { mode: 'link' | 'new'; targetId?: string }>>({});
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Estados de progresso de gravação
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentEmpName, setCurrentEmpName] = useState('');
  const [saveSuccessCount, setSaveSuccessCount] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsSuccess(false);
    setError(null);
    setIsLoadingLake(true);

    fetch('/dianna_source.json')
      .then(res => {
        if (!res.ok) throw new Error('Não foi possível carregar dianna_source.json');
        return res.json();
      })
      .then(data => {
        const structured: DiannaStructuredEmp[] = data.structured_clt || [];
        setDiannaList(structured);

        // Inicializar resoluções padrão baseadas na similaridade de nomes
        const initialRes: Record<number, { mode: 'link' | 'new'; targetId?: string }> = {};
        const allIndices: number[] = [];

        structured.forEach((emp, idx) => {
          allIndices.push(idx);
          const match = findBestNameMatch(emp.nome, employees);
          if (match.status === 'EXACT' || match.status === 'SIMILAR') {
            initialRes[idx] = { mode: 'link', targetId: match.matchedEmployeeId };
          } else {
            initialRes[idx] = { mode: 'new' };
          }
        });

        setResolutionMap(initialRes);
        setSelectedIndices(allIndices);
        setIsLoadingLake(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Erro ao carregar Data Lake Dianna');
        setIsLoadingLake(false);
      });
  }, [isOpen, employees]);

  // Análise de correspondências memoizada
  const matchAnalysis = useMemo(() => {
    return diannaList.map((emp, idx) => {
      const match = findBestNameMatch(emp.nome, employees);
      const userRes = resolutionMap[idx] || { mode: match.status === 'NEW' ? 'new' : 'link', targetId: match.matchedEmployeeId };
      return {
        emp,
        idx,
        match,
        userRes
      };
    });
  }, [diannaList, employees, resolutionMap]);

  const filteredAnalysis = useMemo(() => {
    if (!searchQuery.trim()) return matchAnalysis;
    const q = searchQuery.toLowerCase().trim();
    return matchAnalysis.filter(item => {
      return (
        item.emp.nome.toLowerCase().includes(q) ||
        item.emp.setor.toLowerCase().includes(q) ||
        item.emp.ultimo_cargo.toLowerCase().includes(q)
      );
    });
  }, [matchAnalysis, searchQuery]);

  const handleToggleSelectAll = () => {
    if (selectedIndices.length === diannaList.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(diannaList.map((_, idx) => idx));
    }
  };

  const handleExecuteBatchSync = async () => {
    if (selectedIndices.length === 0) return;
    setIsProcessing(true);
    setProgressPercent(0);
    setSaveSuccessCount(0);

    const totalToProcess = selectedIndices.length;
    let processed = 0;

    try {
      for (const idx of selectedIndices) {
        const item = matchAnalysis[idx];
        if (!item) continue;

        setCurrentEmpName(item.emp.nome);
        let employeeId = item.userRes.targetId;

        // 1. Criar novo cadastro se necessário ou se a opção 'new' estiver selecionada
        if (item.userRes.mode === 'new' || !employeeId) {
          const rawStatus = item.emp.status ? item.emp.status.toLowerCase() : '';
          const statusVal: "Ativo" | "Inativo" | "Férias" = 
            rawStatus.includes('férias') || rawStatus.includes('ferias') ? 'Férias' :
            rawStatus.includes('inativo') || rawStatus.includes('desligado') ? 'Inativo' : 'Ativo';

          const newEmpPayload: Partial<Employee> = {
            name: item.emp.nome,
            status: statusVal,
            department: item.emp.setor || 'Operacional',
            job_role: item.emp.ultimo_cargo || item.emp.cargo_inicial || 'Auxiliar',
            linkType: 'CLT',
            start_date: item.emp.data_admissao || undefined,
            resignation_date: item.emp.data_desligamento || undefined,
            company: 'DZM',
          };

          const savedEmp = await PeopleService.saveEmployeeProfile(newEmpPayload);
          employeeId = savedEmp.id;
        }

        // 2. Salvar matriz de verbas por competência
        if (employeeId && item.emp.competencias) {
          for (const [comp, verbas] of Object.entries(item.emp.competencias)) {
            const holerite = verbas['Holerite'] || 0;
            const adiantamento = verbas['Adiantamento'] || 0;
            const horaExtra = (verbas['Hora extra + D.S.R'] || 0) + (verbas['Adicional noturno 20% +D.S.R'] || 0);
            const vr = verbas['VR'] || 0;
            const vt = verbas['VT'] || 0;
            const cesta = verbas['Cesta'] || 0;
            const ajudaCusto = verbas['Ajuda de custo'] || 0;
            const beneficios = vr + vt + cesta + ajudaCusto;
            const bonus = (verbas['Bonificação'] || 0) + (verbas['Comissões Rancho'] || 0);
            const decimoTerceiro = verbas['13º'] || 0;
            const ferias = verbas['Férias'] || 0;
            const rescisao = verbas['Rescisão'] || 0;
            const descontos = verbas['Descontos'] || 0;
            const outrosAjustes = verbas['Pagamento sem holerite'] || 0;

            const costPayload: Partial<MonthlyCost> = {
              employee_id: employeeId,
              competencia: comp,
              vinculo_tipo: (item.emp.tipo_vinculo as 'CLT' | 'MEI') || 'CLT',
              valor_holerite: holerite,
              valor_adiantamento: adiantamento,
              valor_hora_extra: horaExtra,
              valor_vr: vr,
              valor_vt: vt,
              valor_cesta: cesta,
              valor_ajuda_custo: ajudaCusto,
              valor_bonus: bonus,
              valor_decimo_terceiro: decimoTerceiro,
              valor_ferias: ferias,
              valor_rescisao: rescisao,
              valor_descontos: descontos,
              valor_liquido: holerite > 0 ? holerite : (beneficios + bonus + decimoTerceiro + ferias + rescisao),
              origem: 'dianna_batch_clt' as const,
              verbas_adicionais: outrosAjustes > 0 ? { outros_ajustes: outrosAjustes } : undefined
            };

            await PeopleHRService.upsertMonthlyCost(costPayload);
          }
        }

        processed++;
        setSaveSuccessCount(processed);
        setProgressPercent(Math.round((processed / totalToProcess) * 100));
      }

      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro durante a gravação dos lotes.');
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Sincronização Dianna (Aba CLT NOVA)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Importação automática em lote de perfis cadastrais e matriz de verbas históricas.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Selection Controls Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 flex-1 min-w-[240px]">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar colaborador por nome, setor ou cargo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none w-full font-medium"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-xs text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSelectAll}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              {selectedIndices.length === diannaList.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
            <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
              {selectedIndices.length} de {diannaList.length} selecionados
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 dark:bg-slate-900/50">
          {isLoadingLake ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={32} className="animate-spin text-amber-500" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Carregando Data Lake Dianna...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-400 text-xs font-bold">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          ) : isProcessing ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-400">
                <RefreshCw size={28} className="animate-spin" />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                Sincronizando Colaboradores e Verbas
              </h4>
              <p className="text-xs text-slate-500 mb-6">
                Gravando ficha e histórico de: <span className="font-bold text-amber-600">{currentEmpName}</span>
              </p>

              {/* Progress Bar */}
              <div className="w-full max-w-md bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden mb-2">
                <div 
                  className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-mono font-extrabold text-slate-600 dark:text-slate-400">
                {saveSuccessCount} / {selectedIndices.length} ({progressPercent}%)
              </span>
            </div>
          ) : isSuccess ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <CheckCircle2 size={36} />
              </div>
              <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">Sincronização Concluída!</h4>
              <p className="text-xs text-slate-500 mt-1">
                {saveSuccessCount} colaboradores e todas as suas verbas foram gravados com sucesso.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnalysis.map(({ emp, idx, match, userRes }) => {
                const isSelected = selectedIndices.includes(idx);
                const compCount = Object.keys(emp.competencias || {}).length;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-950 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 opacity-60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      
                      {/* Checkbox e Nome */}
                      <div className="flex items-center gap-3 min-w-[260px]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIndices(prev =>
                              prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                            );
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            {emp.nome}
                            {emp.status && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                emp.status.toLowerCase().includes('ativo')
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                                {emp.status}
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {emp.setor} • <span className="font-semibold">{emp.ultimo_cargo}</span> • {compCount} meses de verbas
                          </p>
                        </div>
                      </div>

                      {/* Tag de Inteligência de Leitura e Resolução de Duplicidade */}
                      <div className="flex items-center gap-2">
                        {match.status === 'EXACT' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                            <CheckCircle2 size={13} />
                            Vincular a: {match.matchedEmployeeName}
                          </span>
                        )}

                        {match.status === 'SIMILAR' && (
                          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 px-1">
                              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                              <span>Semelhante a "{match.matchedEmployeeName}" ({Math.round(match.similarity * 100)}%)</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => setResolutionMap(prev => ({ ...prev, [idx]: { mode: 'link', targetId: match.matchedEmployeeId } }))}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                  userRes.mode === 'link'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-amber-200'
                                }`}
                              >
                                Vincular
                              </button>
                              <button
                                onClick={() => setResolutionMap(prev => ({ ...prev, [idx]: { mode: 'new' } }))}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                  userRes.mode === 'new'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200'
                                }`}
                              >
                                Criar Novo
                              </button>
                            </div>
                          </div>
                        )}

                        {match.status === 'NEW' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                            <UserPlus size={13} />
                            Novo Cadastramento
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500">
            {selectedIndices.length} colaboradores serão sincronizados
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleExecuteBatchSync}
              disabled={selectedIndices.length === 0 || isProcessing}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 uppercase tracking-wider"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Importar Selecionados
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
