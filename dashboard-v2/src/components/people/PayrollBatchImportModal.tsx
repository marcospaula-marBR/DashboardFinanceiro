import { useState, useRef } from 'react';
import { 
  X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, 
  UserPlus, Check, HelpCircle, Save, Info, Users
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

interface ExtractedRecord {
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
  valor_consignado: number;
  banco_horas: number;
  valor_incentivos: number;
  valor_bonus: number;
  valor_comissao: number;
  valor_ajuda_custo: number;
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
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'review' | 'saving' | 'success'>('upload');
  const [parsedData, setParsedData] = useState<ParsedBatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState('');
  
  // Mapeia para cada CPF/Nome o ID do colaborador encontrado ou 'new' se deve criar novo cadastro
  const [matchedEmployees, setMatchedEmployees] = useState<Record<string, { id: string; shouldCreate: boolean }>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Função para limpar CPF deixando apenas números
  const cleanCPF = (cpf: string) => cpf.replace(/\D/g, '');

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
      // 1. Upload do PDF para o Supabase Storage bucket de contratos
      const uploadId = 'batch_' + Date.now();
      const fileUrl = await PeopleService.uploadAdditiveFile(uploadId, file, isTestMode);

      setProgressText('Gemini AI processando e extraindo verbas CLT...');
      
      // 2. Chamar a API de parse consolidada
      const res = await fetch('/api/people/parse-payroll-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileUrl }),
      });

      const responseText = await res.text();

      if (!res.ok) {
        let errMsg = 'Falha ao processar folha de pagamento.';
        try {
          const parsed = JSON.parse(responseText);
          errMsg = parsed.error || errMsg;
        } catch {
          if (responseText.trim().startsWith('<')) {
            errMsg = `Erro do servidor (${res.status}). O tempo limite do Gemini foi excedido ou a API falhou.`;
          } else {
            errMsg = responseText.slice(0, 200) || errMsg;
          }
        }
        throw new Error(errMsg);
      }

      const data: ParsedBatchData = JSON.parse(responseText);
      if (!data.records || !Array.isArray(data.records)) {
        throw new Error('A resposta do OCR de folha não retornou uma lista de registros válida.');
      }

      setParsedData(data);
      
      // 3. Realizar reconciliação (matching) prévia com colaboradores cadastrados
      const matches: Record<string, { id: string; shouldCreate: boolean }> = {};
      
      data.records.forEach(rec => {
        const key = rec.cpf ? cleanCPF(rec.cpf) : rec.name.toLowerCase().trim();
        
        // Tenta achar por CPF primeiro
        let matched = employees.find(emp => {
          if (rec.cpf && emp.document_id) {
            return cleanCPF(emp.document_id) === cleanCPF(rec.cpf);
          }
          return false;
        });

        // Se não achou por CPF, tenta por nome exato ou contido
        if (!matched) {
          matched = employees.find(emp => {
            const empName = emp.name.toLowerCase().trim();
            const recName = rec.name.toLowerCase().trim();
            return empName === recName || empName.includes(recName) || recName.includes(empName);
          });
        }

        if (matched) {
          matches[key] = { id: matched.id, shouldCreate: false };
        } else {
          // Se não encontrado, marca para criar cadastro por padrão
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

  const handleSaveBatch = async () => {
    if (!parsedData) return;

    setIsProcessing(true);
    setStep('saving');
    setProgressText('Gravando e conciliando custos mensais no banco de dados...');
    setError(null);

    try {
      // Loop por cada registro extraído
      const promises = parsedData.records.map(async (record) => {
        const key = record.cpf ? cleanCPF(record.cpf) : record.name.toLowerCase().trim();
        const matchInfo = matchedEmployees[key];
        
        let employeeId = '';

        if (matchInfo?.id === 'new' && matchInfo.shouldCreate) {
          // Criar colaborador CLT simplificado automaticamente
          const basicProfile: Partial<Employee> = {
            name: record.name,
            document_id: record.cpf || undefined,
            linkType: 'CLT',
            status: 'Ativo',
            company: 'MarBR', // Empresa padrão para novos
            start_date: record.admission_date || new Date(parsedData.competencia).toISOString().split('T')[0],
            remuneration_fixed: record.valor_fixo || 0,
            remuneration: record.valor_fixo || 0,
            relationshipNature: 'clt_internal',
            metadata: {
              qualityNotes: ['Ficha básica criada por importação automática OCR da folha de pagamento.']
            }
          };

          const newEmployee = await PeopleService.saveEmployeeProfile(basicProfile, isTestMode, true);
          employeeId = newEmployee.id;

          // Grava item na trajetória
          await PeopleService.insertHistoryItem({
            employee_id: employeeId,
            event_type: 'Admissão',
            change_date: record.admission_date || new Date(parsedData.competencia).toISOString().split('T')[0],
            observations: `Ficha cadastral básica criada por importação OCR em lote da folha de pagamento na competência ${parsedData.competencia}.`
          }, isTestMode);

        } else if (matchInfo?.id && matchInfo.id !== 'new') {
          employeeId = matchInfo.id;
        }

        // Se temos um ID de colaborador associado, criamos seu custo mensal
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
            valor_consignado: record.valor_consignado || 0,
            banco_horas: record.banco_horas || 0,
            observacao: record.observacao || `Importado via OCR em lote da folha de pagamento de ${new Date(parsedData.competencia + 'T12:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}`
          };

          // Executar insert
          await PeopleHRService.insertMonthlyCost(costPayload);
        }
      });

      await Promise.all(promises);
      setStep('success');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao persistir custos consolidados.');
      setStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCreate = (key: string) => {
    setMatchedEmployees(prev => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: { ...current, shouldCreate: !current.shouldCreate }
      };
    });
  };

  const formatCompetenciaText = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-white font-black text-sm tracking-wider uppercase">Importar Folha de Pagamento em Lote</h3>
            <p className="text-[10px] text-slate-400 uppercase mt-0.5">Alimentação automática de custos via OCR e criação básica de novos colaboradores CLT</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
          
          {error && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl text-red-400 text-xs font-bold leading-relaxed flex gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drag and Drop Area */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  file 
                    ? 'border-emerald-500/50 bg-emerald-500/5' 
                    : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/20'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="hidden"
                />
                
                {file ? (
                  <>
                    <div className="p-4 bg-emerald-950/40 rounded-full border border-emerald-900 text-emerald-400">
                      <FileText size={32} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-emerald-400 uppercase">{file.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase mt-1">{(file.size / 1024).toFixed(1)} KB · Clique ou solte outro arquivo para substituir</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-slate-950 rounded-full border border-slate-800 text-slate-400">
                      <Upload size={32} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-350 uppercase">Clique para selecionar ou arraste o Extrato Mensal PDF</p>
                      <p className="text-[10px] text-slate-500 uppercase mt-1">Apenas formato PDF (extrato consolidado de folha)</p>
                    </div>
                  </>
                )}
              </div>

              {/* Informative Banner */}
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex gap-3">
                <Info size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-slate-400">
                  <p className="font-extrabold text-slate-300 uppercase tracking-wide mb-1">Como funciona a importação?</p>
                  <p>O sistema lerá todos os colaboradores CLT presentes na folha, identificará suas verbas (salário, faltas, consignados, banco de horas) e salvará de uma vez para a competência correspondente. Colaboradores não cadastrados no banco serão exibidos para que você crie sua ficha simplificada automaticamente.</p>
                </div>
              </div>

              {/* Action Button */}
              {file && (
                <div className="flex justify-end">
                  <button
                    onClick={handleProcessFile}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:shadow-emerald-900/20 transition-all select-none active:scale-95 duration-100"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Processando Folha...</span>
                      </>
                    ) : (
                      <>
                        <FileText size={14} />
                        <span>Analisar Folha com IA</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'review' && parsedData && (
            <div className="space-y-5">
              {/* Resumo Lote */}
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm shrink-0">
                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Competência Detectada</span>
                  <span className="text-sm font-black text-emerald-400">{formatCompetenciaText(parsedData.competencia)}</span>
                </div>
                <div className="flex gap-6">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Registros na Folha</span>
                    <span className="text-sm font-extrabold text-white">{parsedData.records.length} colaboradores</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Valor Total Lançado</span>
                    <span className="text-sm font-black text-white tabular-nums">
                      {formatCurrency(parsedData.records.reduce((sum, r) => sum + (r.valor_liquido || 0), 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lista para Reconciliação */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Colaboradores Encontrados e a Reconciliar</span>
                
                <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950 max-h-[300px] overflow-y-auto divide-y divide-slate-850">
                  {parsedData.records.map((rec, idx) => {
                    const key = rec.cpf ? cleanCPF(rec.cpf) : rec.name.toLowerCase().trim();
                    const matchInfo = matchedEmployees[key];
                    const isNew = matchInfo?.id === 'new';

                    return (
                      <div key={idx} className="p-3 hover:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                        
                        {/* Colaborador Info */}
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <div className={`p-2 rounded-xl shrink-0 ${isNew ? 'bg-amber-950/40 border border-amber-900/50 text-amber-500' : 'bg-emerald-950/40 border border-emerald-900/50 text-emerald-500'}`}>
                            <Users size={16} />
                          </div>
                          <div>
                            <p className="font-extrabold text-white uppercase">{rec.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">CPF: {rec.cpf || 'N/D'} {rec.admission_date && `· Admissão: ${rec.admission_date.split('-').reverse().join('/')}`}</p>
                          </div>
                        </div>

                        {/* Detalhes do Custo Mapeado */}
                        <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
                          <div>
                            <span className="font-bold block text-[9px] uppercase text-slate-500">Salário Base</span>
                            <span className="font-semibold text-slate-350 tabular-nums">{formatCurrency(rec.valor_fixo)}</span>
                          </div>
                          {rec.valor_faltas > 0 && (
                            <div>
                              <span className="font-bold block text-[9px] uppercase text-red-500">Faltas</span>
                              <span className="font-semibold text-red-400 tabular-nums">-{formatCurrency(rec.valor_faltas)}</span>
                            </div>
                          )}
                          {rec.valor_consignado > 0 && (
                            <div>
                              <span className="font-bold block text-[9px] uppercase text-amber-500 block">Consignado</span>
                              <span className="font-semibold text-amber-400 tabular-nums">-{formatCurrency(rec.valor_consignado)}</span>
                            </div>
                          )}
                          {rec.banco_horas !== 0 && (
                            <div>
                              <span className="font-bold block text-[9px] uppercase text-sky-500">B. Horas</span>
                              <span className="font-semibold text-sky-400 tabular-nums">{rec.banco_horas > 0 ? `+` : ''}{rec.banco_horas}h</span>
                            </div>
                          )}
                          <div>
                            <span className="font-bold block text-[9px] uppercase text-emerald-500">Líquido</span>
                            <span className="font-extrabold text-emerald-400 tabular-nums">{formatCurrency(rec.valor_liquido)}</span>
                          </div>
                        </div>

                        {/* Status / Ação */}
                        <div className="shrink-0 flex items-center md:justify-end min-w-[170px]">
                          {isNew ? (
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 cursor-pointer bg-amber-950/20 border border-amber-900/50 hover:bg-amber-950/40 rounded-lg px-2.5 py-1 text-[10px] text-amber-400 font-extrabold transition-colors">
                                <input
                                  type="checkbox"
                                  checked={matchInfo?.shouldCreate}
                                  onChange={() => handleToggleCreate(key)}
                                  className="rounded border-amber-900 bg-slate-900 text-amber-500 focus:ring-amber-500/20 w-3 h-3"
                                />
                                <span>Criar Ficha CLT</span>
                              </label>
                            </div>
                          ) : (
                            <span className="px-2 py-1 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-lg text-[9px] font-black uppercase flex items-center gap-1">
                              <Check size={10} /> Associar Cadastro
                            </span>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informação sobre Novos cadastrados */}
              {Object.values(matchedEmployees).some(m => m.id === 'new' && m.shouldCreate) && (
                <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-3 text-[11px] text-amber-400 leading-relaxed flex gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-extrabold uppercase block mb-0.5">Aviso de Novos Cadastros</span>
                    <span>Colaboradores que não constavam no banco de dados serão criados com uma ficha CLT básica simplificada. Posteriormente, será necessário editar suas fichas cadastrais para preencher cargo, setor e a data correta de admissão.</span>
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => setStep('upload')}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black uppercase transition-all select-none"
                >
                  Voltar
                </button>
                
                <button
                  onClick={handleSaveBatch}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:shadow-emerald-900/20 transition-all select-none active:scale-95 duration-100"
                >
                  <Save size={14} />
                  <span>Importar Custos & Fichas</span>
                </button>
              </div>
            </div>
          )}

          {step === 'saving' && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 size={40} className="text-emerald-500 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-black text-white uppercase tracking-wider">{progressText}</p>
                <p className="text-[10px] text-slate-500 uppercase">Aguarde, executando transações e reconciliação no banco de dados...</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-10 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-4 bg-emerald-950/40 rounded-full border border-emerald-900 text-emerald-400 animate-bounce">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-white font-black text-base uppercase tracking-wider">Importação Concluída com Sucesso!</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Todos os custos mensais foram lançados e conciliados. Novos colaboradores sinalizados foram cadastrados na base do Peopleboard.
                </p>
              </div>
              
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase transition-all select-none shadow-lg active:scale-95"
              >
                Concluir e Recarregar
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
