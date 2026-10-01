import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  AlertCircle, 
  Save, 
  FileText, 
  FileSignature, 
  CheckCircle2, 
  Search, 
  ChevronDown,
  Eye,
  ArrowLeft,
  Download,
  Building,
  UserCheck
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';
import { LoansService, fetchEmployees, formatCurrency } from '@/services/loans.service';
import { isEligibleForNewLoan } from '@/types/loans';
import { PDFService } from '@/services/pdf.service';
import { supabase } from '@/lib/supabase';

interface NewLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onGenerateTerm: (loanData: any) => void;
}

// Componente de Seleção com Busca para Colaborador (Single-Select Autocomplete)
interface SearchableEmployeeSelectProps {
  employees: any[];
  selectedId: string;
  onChange: (id: string) => void;
}

function SearchableEmployeeSelect({ employees, selectedId, onChange }: SearchableEmployeeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const selectedEmployee = employees.find(e => e.id === selectedId);

  const filteredEmployees = employees.filter(e => 
    (e.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between border-slate-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary px-3 py-2 text-sm bg-slate-50 border text-left text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <span className="truncate">
          {selectedEmployee ? selectedEmployee.full_name : 'Selecione...'}
        </span>
        <ChevronDown size={16} className="text-slate-400 ml-2 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-[110] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-sm focus:ring-0 focus:outline-none placeholder:text-slate-400 text-slate-800"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 max-h-48 py-1">
            {filteredEmployees.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">Nenhum colaborador encontrado</div>
            ) : (
              filteredEmployees.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onChange(e.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                    e.id === selectedId ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{e.full_name}</span>
                  {e.id === selectedId && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function NewLoanModal({ isOpen, onClose, onSuccess, onGenerateTerm }: NewLoanModalProps) {
  const { isTestMode } = useDataMode();
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeDetails, setEmployeeDetails] = useState<any>(null);
  const [fullEmployeeRow, setFullEmployeeRow] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    employee_id: '',
    amount: '',
    installments: '',
    start_cycle: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'),
    request_date: new Date().toISOString().split('T')[0],
    first_payment_date: '',
    notes: ''
  });
  
  const [step, setStep] = useState<'form' | 'preview' | 'success'>('form');
  const [createdLoan, setCreatedLoan] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      setStep('form');

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const cycle = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const defaultFirstPayment = `${nextYear}-${String(nextMonth).padStart(2, '0')}-10`;

      setFormData({ 
        employee_id: '', 
        amount: '', 
        installments: '', 
        start_cycle: cycle,
        request_date: now.toISOString().split('T')[0],
        first_payment_date: defaultFirstPayment,
        notes: '' 
      });
      setCreatedLoan(null);
    }
  }, [isOpen, isTestMode]);

  useEffect(() => {
    let isMounted = true;
    if (formData.employee_id) {
       LoansService.getEmployeeDetails(formData.employee_id, isTestMode)
         .then(details => {
           if (isMounted) setEmployeeDetails(details);
         })
         .catch(err => console.error(err));

       const table = isTestMode ? 'employees_test' : 'employees';
       (async () => {
         try {
           const { data } = await supabase.from(table).select('*').eq('id', formData.employee_id).single();
           if (isMounted && data) {
             setFullEmployeeRow(data);
           }
         } catch (err) {
           console.error(err);
         }
       })();
    } else {
       setEmployeeDetails(null);
       setFullEmployeeRow(null);
    }
    return () => {
      isMounted = false;
    };
  }, [formData.employee_id, isTestMode]);

  const loadEmployees = async () => {
    try {
      const emps = await fetchEmployees(isTestMode);
      const eligible = emps.filter(e => {
        const empMapped = {
          id: e.id,
          name: e.full_name,
          company: e.company,
          linkType: e.employment_type,
          remuneration: parseFloat(String(e.remuneration)) || 0,
          status: e.status,
          start_date: e.start_date,
          contract_expiry_date: e.contract_expiry_date,
          job_role: e.job_role,
          metadata: e.metadata || {},
          is_outsourced: e.is_outsourced,
          corporate_name: e.corporate_name,
          pj_type: e.pj_type,
          tax_regime: e.tax_regime
        };
        return isEligibleForNewLoan(empMapped as any);
      });
      setEmployees(eligible);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  // Lógica de Auditoria (Sinalização)
  const selectedEmpRaw = employees.find(e => e.id === formData.employee_id);
  const requestedAmount = parseFloat(formData.amount.replace(',', '.')) || 0;
  
  let marginAvailable = 0;
  let marginError: string | null = null;
  let tenureError: string | null = null;

  if (selectedEmpRaw && employeeDetails) {
    marginAvailable = employeeDetails.remuneration - employeeDetails.balance;
    if (requestedAmount > marginAvailable && requestedAmount > 0) {
      marginError = `O valor excede a margem. Salário (R$ ${employeeDetails.remuneration.toFixed(2)}) - Dívida Ativa (R$ ${employeeDetails.balance.toFixed(2)}) = Margem Livre de R$ ${marginAvailable.toFixed(2)}`;
    }

    if (selectedEmpRaw.start_date) {
      const dataStr = selectedEmpRaw.start_date.split('T')[0];
      const start = new Date(`${dataStr}T00:00:00`); 
      const now = new Date();
      const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      
      if (diffMonths < 6) {
        tenureError = `Colaborador possui Menos de 6 meses de empresa (Admissão: ${start.toLocaleDateString('pt-BR')}).`;
      }
    }
  }

  const handleCycleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cycle = e.target.value;
    setFormData(prev => {
      let firstPay = prev.first_payment_date;
      if (!firstPay && cycle) {
        const parts = cycle.split('-');
        if (parts.length === 2) {
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]);
          const nextM = m === 12 ? 1 : m + 1;
          const nextY = m === 12 ? y + 1 : y;
          firstPay = `${nextY}-${String(nextM).padStart(2, '0')}-10`;
        }
      }
      return { ...prev, start_cycle: cycle, first_payment_date: firstPay };
    });
  };

  const handleProceedToPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_id) {
      alert('Por favor, selecione um colaborador.');
      return;
    }
    if (!requestedAmount || requestedAmount <= 0) {
      alert('Por favor, informe um valor total válido maior que zero.');
      return;
    }
    const inst = parseInt(formData.installments);
    if (!inst || inst < 1) {
      alert('Por favor, informe uma quantidade válida de parcelas.');
      return;
    }
    if (!formData.first_payment_date) {
      alert('Por favor, informe o vencimento da 1ª parcela.');
      return;
    }

    if (marginError || tenureError) {
      if (!confirm('Existem alertas de auditoria (margem excedida ou tempo de casa inferior a 6 meses).\nDeseja autorizar excepcionalmente esta operação e prosseguir para a visualização do termo?')) return;
    }

    setStep('preview');
  };

  const handleFinalCommit = async () => {
    if (!isTestMode) {
      if (!confirm('💥 ATENÇÃO: Você está adicionando um empréstimo na BASE DE PRODUÇÃO REAL. Deseja confirmar e gravar agora?')) return;
    }
    
    setIsLoading(true);
    try {
      const resp = await LoansService.createLoan({
        employee_id: formData.employee_id,
        amount: parseFloat(formData.amount.replace(',', '.')),
        installments: parseInt(formData.installments),
        start_cycle: formData.start_cycle,
        request_date: formData.request_date ? formData.request_date + 'T12:00:00.000Z' : new Date().toISOString(),
        first_payment_date: formData.first_payment_date || undefined,
        notes: formData.notes
      }, isTestMode);
      
      setCreatedLoan(resp);
      
      // Auto-gera e baixa o termo oficial com assinatura do devedor
      try {
        await PDFService.generateDebtTermPDF(resp, fullEmployeeRow || employeeDetails, isTestMode, true);
      } catch (pdfErr) {
        console.warn('Aviso ao auto-gerar termo oficial:', pdfErr);
      }

      setStep('success');
      onSuccess();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadDraft = async () => {
    try {
      const draftData = {
        amount: parseFloat(formData.amount.replace(',', '.')),
        installments: parseInt(formData.installments),
        start_cycle: formData.start_cycle,
        request_date: formData.request_date ? formData.request_date + 'T12:00:00.000Z' : new Date().toISOString(),
        first_payment_date: formData.first_payment_date,
        employee_id: formData.employee_id,
        notes: formData.notes
      };
      await PDFService.generateDebtTermPDF(draftData, fullEmployeeRow || employeeDetails, isTestMode, true);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar rascunho em PDF.');
    }
  };

  // Dados auxiliares para renderização do Termo
  const empSource = fullEmployeeRow || employeeDetails || selectedEmpRaw || {};
  const isPJ = empSource.employment_type === 'PJ' || empSource.linkType === 'PJ';
  const razaoSocialOuNome = isPJ ? (empSource.corporate_name || empSource.full_name || empSource.name || '') : (empSource.full_name || empSource.name || '');
  const tipoPessoa = isPJ ? 'pessoa jurídica de direito privado' : 'pessoa física';
  const documentId = empSource.document_id || empSource.metadata?.document_id || empSource.metadata?.cpf || empSource.metadata?.cnpj || '';
  const pjType = empSource.pj_type || (isPJ ? 'CNPJ' : 'CPF');
  const responsibleName = empSource.responsible_name || empSource.full_name || empSource.name || '';
  const responsibleCpf = empSource.responsible_cpf || documentId;
  const fullAddress = `${empSource.street || ''} ${empSource.number ? 'nº ' + empSource.number : ''}, ${empSource.neighborhood || ''}, ${empSource.city || ''} - ${empSource.state || ''}${empSource.zip_code ? ', CEP: ' + empSource.zip_code : ''}`.replace(/^(, )+|undefined/g, '').trim() || 'endereço cadastral Mar Brasil';

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '---';
    try {
      const clean = dStr.split('T')[0];
      const [y, m, d] = clean.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dStr;
    }
  };

  const installmentsCount = parseInt(formData.installments) || 1;
  const installmentValue = requestedAmount > 0 && installmentsCount > 0 ? (requestedAmount / installmentsCount) : 0;

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  let refMonthName = "---";
  let refYear = new Date().getFullYear();
  if (formData.start_cycle) {
    try {
      const [y, m] = formData.start_cycle.split('-');
      const mNum = parseInt(m);
      if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
        refMonthName = monthNames[mNum - 1];
        refYear = parseInt(y) || refYear;
      }
    } catch {}
  }
  const firstPaymentFormatted = formData.first_payment_date ? formatDisplayDate(formData.first_payment_date) : '10/--/----';
  const requestDateFormatted = formatDisplayDate(formData.request_date);

  const sigDate = formData.request_date ? new Date(formData.request_date + 'T12:00:00') : new Date();
  const sigDay = sigDate.getDate();
  const sigMonth = monthNames[sigDate.getMonth()];
  const sigYear = sigDate.getFullYear();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300 ${
        step === 'preview' ? 'max-w-3xl' : 'max-w-lg'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b transition-colors ${isTestMode ? 'bg-amber-100 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isTestMode ? 'bg-amber-200 text-amber-700' : 'bg-red-200 text-red-700'}`}>
              <AlertCircle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`font-bold text-lg leading-none ${isTestMode ? 'text-amber-900' : 'text-red-900'}`}>
                  {step === 'preview' ? 'Conferência e Validação do Termo' : step === 'success' ? 'Empréstimo Concluído' : 'Novo Empréstimo'}
                </h2>
                {step === 'preview' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                    Etapa 2 de 2
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 font-semibold ${isTestMode ? 'text-amber-700' : 'text-red-700'}`}>
                {isTestMode ? "⚠️ MODO TESTE: Ambiente Sandbox Isolado" : "🚨 AVISO DE SEGURANÇA: BASE DE PRODUÇÃO REAL ATIVA"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'form' && (
            <form id="loanForm" onSubmit={handleProceedToPreview} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Colaborador Associado</label>
                <SearchableEmployeeSelect 
                  employees={employees}
                  selectedId={formData.employee_id}
                  onChange={id => setFormData({...formData, employee_id: id})}
                />
                
                {/* Janela de Auditoria */}
                {formData.employee_id && (marginError || tenureError) && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg shadow-sm">
                    <h4 className="text-[10px] font-black uppercase text-red-500 mb-1 flex items-center gap-1">
                      <AlertCircle size={12}/> Auditoria Interna (Alerta)
                    </h4>
                    {tenureError && <p className="text-xs font-semibold text-red-700 leading-tight mb-1">• {tenureError}</p>}
                    {marginError && <p className="text-xs font-semibold text-red-700 leading-tight">• {marginError}</p>}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary px-3 py-2 text-sm bg-slate-50 border font-mono"
                    placeholder="Ex: 1500.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. de Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.installments}
                    onChange={e => setFormData({...formData, installments: e.target.value})}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary px-3 py-2 text-sm bg-slate-50 border font-mono"
                    placeholder="Ex: 5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data da Tomada (Assinatura)</label>
                  <input
                    type="date"
                    required
                    value={formData.request_date}
                    onChange={e => setFormData({...formData, request_date: e.target.value})}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary px-3 py-2 text-sm bg-slate-50 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Início do Desconto (Ciclo)</label>
                  <input
                    type="month"
                    required
                    value={formData.start_cycle}
                    onChange={handleCycleChange}
                    className="w-full border-slate-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary px-3 py-2 text-sm bg-slate-50 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vencimento da 1ª Parcela <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.first_payment_date}
                  onChange={e => setFormData({...formData, first_payment_date: e.target.value})}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary px-3 py-2 text-sm bg-slate-50 border"
                />
                <p className="text-[10px] text-slate-400 mt-1">Data real do primeiro débito em folha</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observações (Opcional)</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary px-3 py-2 text-sm bg-slate-50 border h-20 resize-none"
                  placeholder="Anotações para a folha de pagamento..."
                ></textarea>
              </div>
            </form>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Banner orientador */}
              <div className="flex items-center justify-between p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                <div className="flex items-center gap-2 font-medium">
                  <Eye size={18} className="text-blue-600 flex-shrink-0" />
                  <span>
                    Revise os termos e cláusulas abaixo. Você pode <strong>solicitar alterações</strong> ou <strong>validar e gravar</strong> definitivamente no banco.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadDraft}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg font-bold text-[11px] text-blue-700 transition-colors shadow-xs ml-3 flex-shrink-0 cursor-pointer"
                  title="Baixar rascunho em PDF para conferência prévia"
                >
                  <Download size={14} />
                  <span>Baixar Rascunho</span>
                </button>
              </div>

              {/* Documento simulado estilo papel timbrado */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 sm:p-7 shadow-inner max-h-[50vh] overflow-y-auto text-slate-800 text-xs sm:text-sm leading-relaxed space-y-4 select-text">
                {/* Cabeçalho */}
                <div className="text-center border-b border-slate-200 pb-3">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-wide uppercase">
                    MAR BRASIL SERVIÇOS E LOCAÇÕES LTDA.
                  </h3>
                  <p className="text-[11px] text-slate-500 font-normal">
                    CNPJ: 02.233.923/0001-19 • Sede: Rua Tupi, nº 782, Vila Tupi, Praia Grande - SP
                  </p>
                  <div className="mt-2.5 inline-block px-3.5 py-1 bg-white border border-slate-300 rounded text-xs font-bold uppercase tracking-wider text-slate-800 shadow-xs">
                    TERMO DE CONFISSÃO DE DÍVIDA
                  </div>
                </div>

                {/* Qualificação das Partes */}
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs leading-normal space-y-2 shadow-xs">
                  <div>
                    <strong className="text-slate-900 font-bold uppercase">DEVEDOR(A):</strong>{' '}
                    <span className="font-semibold text-slate-800">{razaoSocialOuNome}</span>, {tipoPessoa}, inscrito no {pjType} sob o n.º {documentId || '---'}, estabelecido na {fullAddress}, neste ato representada por <span className="font-semibold text-slate-800">{responsibleName}</span>, inscrito no CPF sob o n.º {responsibleCpf || '---'}.
                  </div>
                  <div>
                    <strong className="text-slate-900 font-bold uppercase">CREDOR(A):</strong>{' '}
                    MAR BRASIL SERVIÇOS E LOCAÇÕES LTDA., pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 02.233.923/0001-19, com sede em Rua Tupi, nº 782, Vila Tupi, Praia Grande - SP, neste ato representada por sua sócia administradora, a Sra. Priscilla Coelho Monteiro, brasileira, casada, empresária, inscrita no CPF sob n.º 320.421.118-56.
                  </div>
                </div>

                <p className="text-justify text-xs text-slate-700">
                  As partes acima qualificadas, por este instrumento particular e na melhor forma de direito, confessam e assumem como líquida, certa e exigível a dívida a seguir descrita, sujeitando-se às cláusulas e condições que se seguem:
                </p>

                {/* Cláusulas */}
                <div className="space-y-3 text-xs text-slate-700 text-justify">
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">CLÁUSULA PRIMEIRA – DO OBJETO DA DÍVIDA</h4>
                    <p>
                      1.1. O(A) DEVEDOR(A) confessa e declara dever ao(à) CREDOR(A) a importância líquida, certa e exigível de <strong className="text-emerald-700 font-bold">{formatCurrency(requestedAmount)}</strong>, referente ao empréstimo concedido pela MAR BRASIL SERVIÇOS E LOCAÇÕES LTDA. ao(à) DEVEDOR(A) em {requestDateFormatted}.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">CLÁUSULA SEGUNDA – DA FORMA DE PAGAMENTO</h4>
                    <p className="mb-1">
                      2.1. O valor confessado na Cláusula Primeira será quitado pelo(a) DEVEDOR(A) por meio de descontos nas futuras notas fiscais de prestação de serviços emitidas à MAR BRASIL SERVIÇOS E LOCAÇÕES LTDA., em <strong className="text-slate-900 font-bold">{installmentsCount} parcelas mensais e sucessivas</strong>, no valor de <strong className="text-slate-900 font-bold">{formatCurrency(installmentValue)} cada uma</strong>, no dia 10 de cada mês, a partir de <strong className="text-slate-900 font-bold">{firstPaymentFormatted}</strong>.
                    </p>
                    <p>
                      2.2. O ciclo de referência desta confissão é <strong className="text-slate-900 font-bold">{refMonthName} de {refYear}</strong>. Os descontos serão aplicados automaticamente pela CREDORA no momento do processamento das notas fiscais, e o valor líquido a ser pago ao(à) DEVEDOR(A) será o resultado da nota fiscal menos o valor da parcela do empréstimo.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">CLÁUSULA TERCEIRA – DA INADIMPLÊNCIA</h4>
                    <p className="mb-1">
                      3.1. O não pagamento de qualquer parcela na data estipulada, implicará no vencimento antecipado de todo o saldo devedor, que se tornará imediatamente exigível pela CREDORA.
                    </p>
                    <p className="mb-1">
                      3.2. Em caso de inadimplência, incidirão sobre o saldo devedor vencido e não pago: a) Multa moratória de 2% (dois por cento) sobre o saldo devedor em aberto; b) Juros de mora de 1% (um por cento) ao mês, calculados pro rata die; c) Correção monetária pelo IGP-M ou outro índice que o substitua.
                    </p>
                    <p className="mb-1">
                      3.3. A CREDORA se reserva o direito de promover a execução judicial deste Termo, que é título executivo extrajudicial.
                    </p>
                    <p className="mb-1">
                      3.4. A eventual tolerância não implicará em novação ou transação.
                    </p>
                    <p>
                      3.5. O valor solicitado está vinculado exclusivamente ao contrato de prestação do serviço. Com o encerramento do contrato e cessação da prestação de serviço, as parcelas restantes serão automática e antecipadamente consideradas vencidas.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">CLÁUSULA QUARTA – DA QUITAÇÃO ANTECIPADA</h4>
                    <p>
                      4.1. O(A) DEVEDOR(A) poderá solicitar a quitação antecipada total ou parcial do empréstimo a qualquer momento.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-1">CLÁUSULA QUINTA – DAS DISPOSIÇÕES GERAIS</h4>
                    <p className="mb-1">
                      5.1. As partes declaram ter lido e compreendido todas as cláusulas deste Termo.
                    </p>
                    <p>
                      5.2. Fica eleito o foro da comarca de Praia Grande - SP para dirimir quaisquer dúvidas.
                    </p>
                  </div>
                </div>

                {/* Local e Data */}
                <div className="pt-2 text-xs text-slate-700">
                  Praia Grande - SP, {sigDay} de {sigMonth} de {sigYear}.
                </div>

                {/* Bloco de Assinatura Exclusivo do Devedor */}
                <div className="pt-6 pb-2 text-center">
                  <div className="w-64 sm:w-80 mx-auto border-t-2 border-slate-400 pt-2">
                    <div className="font-bold text-xs uppercase text-slate-900">DEVEDOR(A)</div>
                    <div className="text-xs font-semibold text-slate-800">{razaoSocialOuNome}</div>
                    {responsibleName && responsibleName !== razaoSocialOuNome && (
                      <div className="text-[11px] text-slate-600">Rep. Legal: {responsibleName}</div>
                    )}
                    <div className="text-[11px] text-slate-500 font-mono">CPF/CNPJ: {documentId || '---'}</div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3 italic">
                    (Assinatura exclusiva do devedor • Termo sem exigência de testemunhas ou assinatura da empresa)
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-6 fade-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Empréstimo Validado e Registrado!</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto">
                O contrato e as parcelas mensais foram gerados e sincronizados com a base financeira {isTestMode ? 'de teste' : 'real'}. O Termo de Confissão de Dívida oficial foi disponibilizado para download.
              </p>
              
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <button 
                  onClick={() => {
                    if (createdLoan) {
                      PDFService.generateDebtTermPDF(createdLoan, fullEmployeeRow || employeeDetails, isTestMode, true);
                    } else {
                      onGenerateTerm(createdLoan);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-900 py-3 rounded-xl font-medium transition-colors shadow-sm cursor-pointer"
                >
                  <FileSignature size={18} />
                  Baixar Termo em PDF
                </button>
                <button 
                  onClick={onClose}
                  className="w-full py-3 rounded-xl font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-200 border border-transparent transition-colors cursor-pointer"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'form' && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="loanForm"
              disabled={isLoading || !formData.employee_id}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Eye size={16} />
              <span>Avançar para Visualização do Termo</span>
            </button>
          </div>
        )}

        {step === 'preview' && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep('form')}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors shadow-xs cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Solicitar Alteração / Editar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFinalCommit}
                disabled={isLoading}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-md disabled:opacity-50 cursor-pointer ${
                  isTestMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Save size={16} />
                <span>{isLoading ? 'Gravando no Banco...' : 'Validar e Gravar Empréstimo'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
