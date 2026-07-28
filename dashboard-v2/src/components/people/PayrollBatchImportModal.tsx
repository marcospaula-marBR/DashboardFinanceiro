import React, { useState, useRef, useMemo } from 'react';
import { 
  X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, 
  UserPlus, Check, HelpCircle, Save, Info, Users, Edit3, Trash2, Plus, DollarSign, Calculator, Eye, ChevronDown, ChevronUp, ShieldCheck
} from 'lucide-react';
import { PeopleHRService } from '@/services/people-hr.service';
import { PeopleService } from '@/services/people.service';
import { Employee, MonthlyCost } from '@/types/loans';
import { formatCurrency } from '@/services/loans.service';

interface PayrollBatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employees: Employee[];
  isTestMode?: boolean;
}

export interface ExtractedRecord {
  name: string;
  cpf: string;
  situation: string;
  admission_date?: string;
  valor_fixo: number;
  valor_holerite: number;
  valor_adiantamento: number;
  valor_hora_extra: number;
  valor_adicional_not: number;
  valor_vr: number;
  valor_vt: number;
  valor_cesta: number;
  valor_ferias: number;
  valor_rescisao: number;
  valor_decimo_terceiro: number;
  valor_descontos: number;
  valor_faltas: number;
  dias_faltas: number;
  valor_consignado: number;
  banco_horas: number;
  valor_incentivos: number;
  valor_bonus: number;
  valor_comissao: number;
  valor_ajuda_custo: number;
  // Informativos Patronais da Empresa
  valor_fgts: number;
  inss_empregado: number;
  irrf_empregado: number;
  salario_familia: number;
  valor_liquido: number;
  observacao?: string;
}

interface ParsedBatchData {
  competencia: string;
  records: ExtractedRecord[];
}

export function PayrollBatchImportModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  employees,
  isTestMode = false
}: PayrollBatchImportModalProps) {
  // 1. TODOS OS HOOKS DECLARADOS INCONDICIONALMENTE NO TOPO
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'saving' | 'success'>('upload');
  const [parsedData, setParsedData] = useState<ParsedBatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState('');
  
  // Estados para Barra de Progresso Real-time de Salvamento
  const [saveProgressPercent, setSaveProgressPercent] = useState(0);
  const [saveCurrentEmployeeName, setSaveCurrentEmployeeName] = useState('');
  const [saveSuccessCount, setSaveSuccessCount] = useState(0);
  const [saveTotalCount, setSaveTotalCount] = useState(0);

  // Accordion de detalhamento por colaborador
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Mapeia para cada CPF/Nome o ID do colaborador encontrado ou 'new' se deve criar novo cadastro
  const [matchedEmployees, setMatchedEmployees] = useState<Record<string, { id: string; shouldCreate: boolean }>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Totais da tela de auditoria memoizados no topo incondicionalmente
  const auditTotals = useMemo(() => {
    if (!parsedData?.records) return { count: 0, proventos: 0, descontos: 0, fgts: 0, liquido: 0 };
    return parsedData.records.reduce((acc, r) => {
      acc.count++;
      acc.proventos += r.valor_holerite || r.valor_fixo || 0;
      acc.descontos += r.valor_descontos || 0;
      acc.fgts += r.valor_fgts || 0;
      acc.liquido += r.valor_liquido || 0;
      return acc;
    }, { count: 0, proventos: 0, descontos: 0, fgts: 0, liquido: 0 });
  }, [parsedData]);

  // 2. RETORNO CONDICIONAL SEGURO APÓS TODOS OS HOOKS
  if (!isOpen) return null;

  const cleanCPF = (cpf: string) => (cpf || '').replace(/\D/g, '');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Por favor, selecione um arquivo no formato PDF.');
      setFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Por favor, selecione um arquivo no formato PDF.');
    }
  };

  const handleProcessFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setStep('upload');
    setProgressText('Efetuando upload seguro da folha consolidada...');

    try {
      const uploadId = 'batch_' + Date.now();
      const fileUrl = await PeopleService.uploadAdditiveFile(uploadId, file, isTestMode);

      setProgressText('Gemini AI processando verbas e encargos FGTS/INSS/IRRF...');
      
      const res = await fetch('/api/people/parse-payroll-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao processar arquivo PDF via IA.');
      }

      const data: ParsedBatchData = await res.json();
      
      if (!data.competencia || !data.records || !Array.isArray(data.records)) {
        throw new Error('Formato retornado incompatível com o padrão de folha de pagamento.');
      }

      setParsedData(data);
      setProgressText('Realizando conciliação cadastral dos colaboradores...');

      // Matching inteligente por CPF ou Nome
      const matches: Record<string, { id: string; shouldCreate: boolean }> = {};
      
      data.records.forEach((record) => {
        const cleanedCpf = cleanCPF(record.cpf);
        const recordNameNorm = record.name.toLowerCase().trim();

        const foundByCpf = cleanedCpf 
          ? employees.find(e => cleanCPF(e.document_id || '') === cleanedCpf)
          : null;

        const foundByName = !foundByCpf 
          ? employees.find(e => e.name.toLowerCase().trim() === recordNameNorm)
          : null;

        const matchedEmp = foundByCpf || foundByName;

        const key = cleanedCpf || recordNameNorm;
        if (matchedEmp) {
          matches[key] = { id: matchedEmp.id, shouldCreate: false };
        } else {
          matches[key] = { id: 'new', shouldCreate: true };
        }
      });

      setMatchedEmployees(matches);
      setStep('review');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao processar folha de pagamento.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Edição dinâmica de qualquer campo de um colaborador na tela de auditoria
  const handleUpdateRecordField = (index: number, field: keyof ExtractedRecord, value: any) => {
    if (!parsedData) return;
    const updatedRecords = [...parsedData.records];
    updatedRecords[index] = {
      ...updatedRecords[index],
      [field]: typeof value === 'number' ? (isNaN(value) ? 0 : value) : value
    };

    setParsedData({
      ...parsedData,
      records: updatedRecords
    });
  };

  // Remover colaborador da lista da folha
  const handleRemoveRecord = (index: number) => {
    if (!parsedData) return;
    const updatedRecords = parsedData.records.filter((_, i) => i !== index);
    setParsedData({
      ...parsedData,
      records: updatedRecords
    });
  };

  // Adicionar colaborador manual na auditoria
  const handleAddManualRecord = () => {
    if (!parsedData) return;
    const newRec: ExtractedRecord = {
      name: 'NOVO COLABORADOR',
      cpf: '',
      situation: 'Trabalhando',
      valor_fixo: 0,
      valor_holerite: 0,
      valor_adiantamento: 0,
      valor_hora_extra: 0,
      valor_adicional_not: 0,
      valor_vr: 0,
      valor_vt: 0,
      valor_cesta: 0,
      valor_ferias: 0,
      valor_rescisao: 0,
      valor_decimo_terceiro: 0,
      valor_descontos: 0,
      valor_faltas: 0,
      dias_faltas: 0,
      valor_consignado: 0,
      banco_horas: 0,
      valor_incentivos: 0,
      valor_bonus: 0,
      valor_comissao: 0,
      valor_ajuda_custo: 0,
      valor_fgts: 0,
      inss_empregado: 0,
      irrf_empregado: 0,
      salario_familia: 0,
      valor_liquido: 0
    };
    setParsedData({
      ...parsedData,
      records: [...parsedData.records, newRec]
    });
    setExpandedIndex(parsedData.records.length);
  };

  const handleSaveBatch = async () => {
    if (!parsedData) return;

    setIsProcessing(true);
    setStep('saving');
    setError(null);

    const totalRecords = parsedData.records.length;
    setSaveTotalCount(totalRecords);
    setSaveSuccessCount(0);
    setSaveProgressPercent(0);

    try {
      let createdCount = 0;
      let updatedCostsCount = 0;

      for (let i = 0; i < totalRecords; i++) {
        const record = parsedData.records[i];
        const currentPercent = Math.round(((i + 1) / totalRecords) * 100);
        
        setSaveProgressPercent(currentPercent);
        setSaveCurrentEmployeeName(record.name);
        setSaveSuccessCount(i + 1);

        const cleanedCpf = cleanCPF(record.cpf);
        const recordNameNorm = (record.name || '').toLowerCase().trim();

        // 1. Resolver o ID do colaborador com busca resiliente (CPF ou Nome)
        let foundEmp = cleanedCpf 
          ? employees.find(e => cleanCPF(e.document_id || '') === cleanedCpf)
          : null;

        if (!foundEmp && recordNameNorm) {
          foundEmp = employees.find(e => (e.name || '').toLowerCase().trim() === recordNameNorm);
        }

        let employeeId = foundEmp?.id || '';

        // 2. Se não foi localizado, criar ficha cadastral CLT padrão automaticamente
        if (!employeeId) {
          const basicProfile: Partial<Employee> = {
            name: record.name,
            document_id: record.cpf || undefined,
            linkType: 'CLT',
            status: 'Ativo',
            company: 'MarBR',
            start_date: record.admission_date || new Date(parsedData.competencia).toISOString().split('T')[0],
            remuneration_fixed: record.valor_fixo || 0,
            remuneration: record.valor_fixo || 0,
            relationshipNature: 'clt_internal',
            metadata: {
              qualityNotes: ['Ficha cadastral CLT padrão criada por importação com auditoria de folha de pagamento.']
            }
          };

          const newEmployee = await PeopleService.saveEmployeeProfile(basicProfile, isTestMode, true);
          employeeId = newEmployee.id;
          createdCount++;

          // Grava evento de Admissão na trajetória
          await PeopleService.insertHistoryItem({
            employee_id: employeeId,
            event_type: 'Admissão',
            change_date: record.admission_date || new Date(parsedData.competencia).toISOString().split('T')[0],
            observations: `Ficha cadastral CLT criada automaticamente na importação auditada da folha (${parsedData.competencia}).`
          }, isTestMode);
        }

        // 3. AGORA COM EMPLOYEE_ID 100% GARANTIDO, EXECUTAR UPSERT NO CUSTO HISTÓRICO!
        if (employeeId) {
          const costPayload: Partial<MonthlyCost> = {
            employee_id: employeeId,
            competencia: parsedData.competencia,
            valor_liquido: record.valor_liquido || 0,
            valor_fixo: record.valor_fixo || 0,
            valor_bonus: record.valor_bonus || 0,
            valor_comissao: record.valor_comissao || 0,
            valor_incentivos: record.valor_incentivos || 0,
            valor_ajuda_custo: record.valor_ajuda_custo || 0,
            valor_fgts: record.valor_fgts || 0,
            inss_empregado: record.inss_empregado || 0,
            irrf_empregado: record.irrf_empregado || 0,
            salario_familia: record.salario_familia || 0,
            valor_glosa_base: 0,
            valor_glosa_bonus: 0,
            valor_deducoes: 0,
            vinculo_tipo: 'CLT',
            origem: 'dianna_import',
            valor_holerite: record.valor_holerite || 0,
            valor_adiantamento: record.valor_adiantamento || 0,
            valor_hora_extra: record.valor_hora_extra || 0,
            valor_adicional_not: record.valor_adicional_not || 0,
            valor_vr: record.valor_vr || 0,
            valor_vt: record.valor_vt || 0,
            valor_cesta: record.valor_cesta || 0,
            valor_ferias: record.valor_ferias || 0,
            valor_rescisao: record.valor_rescisao || 0,
            valor_decimo_terceiro: record.valor_decimo_terceiro || 0,
            valor_descontos: record.valor_descontos || 0,
            valor_faltas: record.valor_faltas || 0,
            dias_faltas: record.dias_faltas || 0,
            valor_consignado: record.valor_consignado || 0,
            banco_horas: record.banco_horas || 0,
            observacao: record.observacao || `Auditado e homologado via Folha de Pagamento em ${new Date(parsedData.competencia + 'T12:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}`
          };

          // Executar upsert (atualiza ou insere para a competência com sanitização)
          await PeopleHRService.upsertMonthlyCost(costPayload);
          updatedCostsCount++;

          // Inativação reativa se houver rescisão no lote
          if (record.valor_rescisao && record.valor_rescisao > 0) {
            try {
              const currentProfile = await PeopleService.getEmployeeProfile(employeeId, isTestMode);
              if (currentProfile) {
                const updatedProfile = {
                  ...currentProfile,
                  status: 'Inativo' as const,
                  active: false,
                  status_end_date: parsedData.competencia,
                  resignation_date: parsedData.competencia
                };
                await PeopleService.saveEmployeeProfile(updatedProfile, isTestMode, false);
                
                await PeopleService.insertHistoryItem({
                  employee_id: employeeId,
                  event_type: 'Desligamento',
                  change_date: parsedData.competencia,
                  observations: `Inativação auditada por verba rescisória (${formatCurrency(record.valor_rescisao)}).`
                }, isTestMode);
              }
            } catch (errProfile) {
              console.error('Erro ao inativar colaborador:', errProfile);
            }
          }
        }
      }

      setStep('success');
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError('Erro ao salvar lote de custos: ' + err.message);
      setStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-600 shadow-xs">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Auditoria & Importação de Folha de Pagamento
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                  CLT Batch AI
                </span>
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Valide verba por verba, encargos patronais (FGTS) e alimente o custo histórico com conciliação automática
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* PASSO 1: UPLOAD DO PDF */}
        {step === 'upload' && (
          <div className="p-8 flex flex-col items-center justify-center space-y-6">
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-w-2xl p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                file 
                  ? 'border-amber-500 bg-amber-50/30' 
                  : 'border-slate-300 hover:border-amber-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".pdf" 
                className="hidden" 
              />
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <Upload size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                {file ? file.name : 'Clique para selecionar ou arraste o Extrato Mensal (PDF)'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md">
                Suporta o arquivo consolidado de folha de pagamento celetista. A IA extrairá os dados e abrirá a tela de auditoria.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2 max-w-2xl w-full">
                <AlertTriangle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleProcessFile}
              disabled={!file || isProcessing}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 font-black text-sm rounded-2xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>{progressText}</span>
                </>
              ) : (
                <>
                  <FileText size={18} />
                  <span>Analisar e Abrir Tela de Auditoria</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* PASSO 2: TELA DE AUDITORIA E CONFERÊNCIA EDITÁVEL */}
        {step === 'review' && parsedData && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {/* CARDS TOTAIS DA FOLHA */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Competência</span>
                <span className="text-sm font-black text-slate-800 flex items-center gap-1 mt-0.5">
                  {new Date(parsedData.competencia + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Colaboradores</span>
                <span className="text-sm font-black text-slate-800 mt-0.5 block">{auditTotals.count} celetista(s)</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Proventos Brutos</span>
                <span className="text-sm font-black text-slate-900 mt-0.5 block">{formatCurrency(auditTotals.proventos)}</span>
              </div>
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 shadow-2xs">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block flex items-center gap-1">
                  <ShieldCheck size={12} className="text-amber-600" />
                  FGTS Empresa (Patronal)
                </span>
                <span className="text-sm font-black text-amber-900 mt-0.5 block">{formatCurrency(auditTotals.fgts)}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Líquido a Pagar</span>
                <span className="text-sm font-black text-emerald-900 mt-0.5 block">{formatCurrency(auditTotals.liquido)}</span>
              </div>
            </div>

            {/* TABELA DE AUDITORIA EDITÁVEL */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 size={14} className="text-amber-600" />
                  Conferência Verba por Verba (Clique em qualquer campo para ajustar)
                </span>
                <button
                  onClick={handleAddManualRecord}
                  className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-all"
                >
                  <Plus size={14} />
                  Adicionar Colaborador Manual
                </button>
              </div>

              {parsedData.records.map((record, index) => {
                const cleanedCpf = cleanCPF(record.cpf);
                const key = cleanedCpf || record.name.toLowerCase().trim();
                const matchInfo = matchedEmployees[key];
                const isExpanded = expandedIndex === index;

                return (
                  <div 
                    key={index}
                    className="bg-white border border-slate-200 rounded-2xl shadow-2xs hover:border-slate-300 transition-all overflow-hidden"
                  >
                    {/* LINHA PRINCIPAL RESUMIDA EDITÁVEL */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/40">
                      
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <button
                          onClick={() => setExpandedIndex(isExpanded ? null : index)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        
                        <div>
                          <input
                            type="text"
                            value={record.name}
                            onChange={(e) => handleUpdateRecordField(index, 'name', e.target.value)}
                            className="font-bold text-sm text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-amber-500 focus:bg-white px-1 outline-none transition-all w-full"
                          />
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-slate-500">
                              CPF: {record.cpf || 'Sem CPF'}
                            </span>
                            {matchInfo?.id === 'new' ? (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                <UserPlus size={10} /> Novo CLT (Criar Ficha)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                <Check size={10} /> Cadastrado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* CAMPOS RÁPIDOS NA GRADE */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Proventos (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={record.valor_holerite}
                            onChange={(e) => handleUpdateRecordField(index, 'valor_holerite', parseFloat(e.target.value))}
                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Descontos (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={record.valor_descontos}
                            onChange={(e) => handleUpdateRecordField(index, 'valor_descontos', parseFloat(e.target.value))}
                            className="w-full text-xs font-bold text-rose-700 bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-amber-800 uppercase block flex items-center gap-1">
                            <ShieldCheck size={10} /> FGTS Empresa (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={record.valor_fgts}
                            onChange={(e) => handleUpdateRecordField(index, 'valor_fgts', parseFloat(e.target.value))}
                            className="w-full text-xs font-bold text-amber-900 bg-amber-50/70 border border-amber-300 rounded-lg p-1.5 focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Líquido (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={record.valor_liquido}
                            onChange={(e) => handleUpdateRecordField(index, 'valor_liquido', parseFloat(e.target.value))}
                            className="w-full text-xs font-bold text-emerald-700 bg-white border border-slate-200 rounded-lg p-1.5 focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setExpandedIndex(isExpanded ? null : index)}
                          className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                        >
                          {isExpanded ? 'Recolher' : 'Ver Detalhes'}
                        </button>
                        <button
                          onClick={() => handleRemoveRecord(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Remover da folha"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                    </div>

                    {/* ACORDEÃO DE DETALHAMENTO DA VERBA (QUANDO EXPANDIDO) */}
                    {isExpanded && (
                      <div className="p-4 bg-amber-50/20 border-t border-slate-200 space-y-4 animate-in fade-in duration-150">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Calculator size={14} className="text-amber-600" />
                          Detalhamento Completo de Rubricas e Encargos
                        </h4>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Salário Base (Fixo)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.valor_fixo}
                              onChange={(e) => handleUpdateRecordField(index, 'valor_fixo', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Horas Extras (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.valor_hora_extra}
                              onChange={(e) => handleUpdateRecordField(index, 'valor_hora_extra', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Férias (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.valor_ferias}
                              onChange={(e) => handleUpdateRecordField(index, 'valor_ferias', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">13º Salário (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.valor_decimo_terceiro}
                              onChange={(e) => handleUpdateRecordField(index, 'valor_decimo_terceiro', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-emerald-700 uppercase block">Salário Família (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.salario_familia}
                              onChange={(e) => handleUpdateRecordField(index, 'salario_familia', parseFloat(e.target.value))}
                              className="w-full text-xs font-bold text-emerald-800 bg-emerald-50/50 border border-emerald-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-rose-700 uppercase block">Desc. Adiantamento (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.valor_adiantamento}
                              onChange={(e) => handleUpdateRecordField(index, 'valor_adiantamento', parseFloat(e.target.value))}
                              className="w-full text-xs font-bold text-rose-800 bg-rose-50/50 border border-rose-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">INSS Descontado</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.inss_empregado}
                              onChange={(e) => handleUpdateRecordField(index, 'inss_empregado', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">IRRF Descontado</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.irrf_empregado}
                              onChange={(e) => handleUpdateRecordField(index, 'irrf_empregado', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Vale Transporte 6%</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.valor_vt}
                              onChange={(e) => handleUpdateRecordField(index, 'valor_vt', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Consignado / Empréstimo</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.valor_consignado}
                              onChange={(e) => handleUpdateRecordField(index, 'valor_consignado', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Faltas (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.valor_faltas}
                              onChange={(e) => handleUpdateRecordField(index, 'valor_faltas', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Dias Faltas (Qtd)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={record.dias_faltas}
                              onChange={(e) => handleUpdateRecordField(index, 'dias_faltas', parseFloat(e.target.value))}
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-amber-800 uppercase block">Valor FGTS Empresa (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={record.valor_fgts}
                              onChange={(e) => handleUpdateRecordField(index, 'valor_fgts', parseFloat(e.target.value))}
                              className="w-full text-xs font-bold text-amber-900 bg-amber-100/60 border border-amber-300 rounded-lg p-1.5 outline-none"
                            />
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* FOOTER AÇÕES DA AUDITORIA */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info size={15} className="text-amber-600 shrink-0" />
                <span>Os dados auditados substituirão/atualizarão os custos da competência no banco.</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Voltar / Novo PDF
                </button>
                <button
                  onClick={handleSaveBatch}
                  disabled={isProcessing || parsedData.records.length === 0}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-black text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>Aprovar & Alimentar Custo Histórico</span>
                </button>
              </div>
            </div>

          </div>
        )}

        {/* PASSO 3: GRAVANDO COM BARRA DE PROGRESSO REAL-TIME */}
        {step === 'saving' && (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-amber-100 border border-amber-200 text-amber-600 rounded-3xl flex items-center justify-center shadow-inner relative">
              <Loader2 size={32} className="animate-spin text-amber-600" />
            </div>

            <div className="space-y-2 max-w-lg w-full">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-amber-600" />
                  Alimentando Custo Histórico...
                </span>
                <span className="font-black text-amber-600 font-mono text-sm">{saveProgressPercent}%</span>
              </div>

              {/* BARRA DE PROGRESSO DE ALIMENTAÇÃO */}
              <div className="w-full h-4 bg-slate-100 border border-slate-200 rounded-full overflow-hidden p-0.5 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${saveProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-w-lg w-full text-left space-y-1 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gravando Colaborador</span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 truncate pr-2">
                  {saveCurrentEmployeeName || 'Inicializando...'}
                </span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-md shrink-0 font-mono">
                  {saveSuccessCount} de {saveTotalCount}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 max-w-md">
              Atualizando custos mensais, verbas, encargos FGTS e conciliação cadastral no banco de dados.
            </p>
          </div>
        )}

        {/* PASSO 4: SUCESSO */}
        {step === 'success' && (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Folha de Pagamento Auditada e Homologada com Sucesso!
            </h3>
            <p className="text-xs text-slate-600 max-w-md">
              Os custos históricos foram alimentados e atualizados na competência {parsedData?.competencia}. As fichas CLT necessárias foram criadas.
            </p>
            <button
              onClick={() => {
                onClose();
                onSuccess();
              }}
              className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl transition-all shadow-md mt-2"
            >
              Concluir
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
