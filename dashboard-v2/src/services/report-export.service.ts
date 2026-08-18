import { supabase } from '@/lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TIMBRADO_B64 } from '@/lib/timbrado_base64';
import { FilterValues } from '@/components/loans/FilterBar';
import { LoansService } from './loans.service';
import { ExportOptions } from '@/components/loans/ExportModal';
import { Employee } from '@/types/loans';

export interface LoansReportData {
  colaborador: string;
  empresa: string;
  vinculo: string;
  status: string;
  cargo: string;
  totalEmprestado: number;
  totalRecebido: number;
  saldoDevedor: number;
  parcelaMensal: number;
  contratosAtivos: number;
  aditivos: number;
}

export interface ContractReportData {
  colaborador: string;
  empresa: string;
  contrato: string;
  valorTotal: number;
  qtdParcelas: number;
  valorParcela: number;
  recebido: number;
  saldo: number;
  parcelasPagas: number;
  parcelasRestantes: number;
  status: string;
  dataSolicitacao: string;
  dataInicio: string;
  dataTermino: string;
}

export interface PaymentReportData {
  colaborador: string;
  empresa: string;
  ciclo: string;
  vencimento: string;
  valor: number;
  status: string;
  dataPagamento: string | null;
  formaPagamento: string | null;
}

/**
 * Função utilitária para aplicar rigorosamente todos os filtros da tela
 */
export function filterEmployeeList(list: Employee[], filters?: FilterValues): Employee[] {
  if (!filters) return list;
  let result = [...list];

  // 1. Incluir Quitados (por padrão false -> exclui colaboradores que já quitaram tudo)
  if (!filters.incluirQuitados) {
    result = result.filter(e => {
      if (e.totalTaken > 0 && e.balance <= 0) return false;
      return true;
    });
  }

  // 2. Mostrar Todos (se false -> exclui colaboradores que nunca tiveram empréstimo)
  if (!filters.mostrarTodos) {
    result = result.filter(e => (e.totalTaken || 0) > 0 || (e.balance || 0) > 0);
  }

  // 3. Busca por nome do colaborador
  if (filters.search && filters.search.trim() !== '') {
    const term = filters.search.toLowerCase().trim();
    result = result.filter(e => (e.name || '').toLowerCase().includes(term));
  }

  // 4. Empresa (MarBR, DZM, G2, etc.)
  if (filters.empresa && filters.empresa.trim() !== '') {
    result = result.filter(e => e.company === filters.empresa);
  }

  // 5. Vínculo (CLT, PJ, Estagiário)
  if (filters.vinculo && filters.vinculo.trim() !== '') {
    result = result.filter(e => e.linkType === filters.vinculo);
  }

  // 6. Status RH (Ativo, Inativo, Férias)
  if (filters.status && filters.status.trim() !== '') {
    result = result.filter(e => e.status === filters.status);
  }

  // 7. Cargo / Função
  if (filters.cargo && filters.cargo.trim() !== '') {
    const cargoTerm = filters.cargo.toLowerCase().trim();
    result = result.filter(e => (e.job_role || '').toLowerCase().includes(cargoTerm));
  }

  // 8. Faixa Salarial
  if (filters.remuneracaoRange && filters.remuneracaoRange.trim() !== '') {
    result = result.filter(e => {
      const salary = e.remuneration || 0;
      switch (filters.remuneracaoRange) {
        case 'ate2k': return salary < 2000;
        case '2k-3.5k': return salary >= 2000 && salary < 3500;
        case '3.5k-5k': return salary >= 3500 && salary <= 5000;
        case 'acima5k': return salary > 5000;
        default: return true;
      }
    });
  }

  // 9. Possui Aditivo
  if (filters.temAditivo !== '' && filters.temAditivo !== undefined) {
    const wantAditive = filters.temAditivo === 'sim';
    result = result.filter(e => {
      const count = e.aditivoCount || 0;
      return wantAditive ? count > 0 : count === 0;
    });
  }

  return result;
}

/**
 * Monta texto legível descrevendo os filtros ativos para cabeçalho do PDF e CSV
 */
export function buildFilterSummaryText(filters?: FilterValues, options?: ExportOptions): string {
  const parts: string[] = [];

  if (filters?.empresa) parts.push(`Empresa: ${filters.empresa}`);
  if (filters?.cargo) parts.push(`Cargo: ${filters.cargo}`);
  if (filters?.vinculo) parts.push(`Vínculo: ${filters.vinculo}`);
  if (filters?.status) parts.push(`Status RH: ${filters.status}`);
  if (filters?.remuneracaoRange) {
    const rangeMap: Record<string, string> = {
      'ate2k': '< R$ 2.000',
      '2k-3.5k': 'R$ 2.000 - R$ 3.500',
      '3.5k-5k': 'R$ 3.500 - R$ 5.000',
      'acima5k': '> R$ 5.000'
    };
    parts.push(`Faixa Salarial: ${rangeMap[filters.remuneracaoRange] || filters.remuneracaoRange}`);
  }
  if (filters?.temAditivo) parts.push(filters.temAditivo === 'sim' ? 'Com Aditivos' : 'Sem Aditivos');
  if (filters?.search) parts.push(`Busca: "${filters.search}"`);
  if (filters?.incluirQuitados) parts.push('Incluindo Quitados');
  if (filters?.mostrarTodos) parts.push('Incluindo Sem Empréstimo');
  
  if (options?.startDate || options?.endDate) {
    const formatDateShort = (d?: string) => d ? d.split('-').reverse().join('/') : '';
    parts.push(`Período Solicitado: ${formatDateShort(options?.startDate) || 'Início'} até ${formatDateShort(options?.endDate) || 'Hoje'}`);
  }

  if (parts.length === 0) {
    return 'Todos os registros (sem filtros específicos)';
  }
  return parts.join(' | ');
}

export class ReportExportService {
  // Buscar dados para relatório de colaboradores (usando lógica real do LoansService + filtros)
  static async getEmployeeReport(isTestMode?: boolean, options?: ExportOptions, filters?: FilterValues): Promise<LoansReportData[]> {
    const allEmps = await LoansService.getEmployees({ mostrarTodos: true }, isTestMode);
    const emps = filterEmployeeList(allEmps, filters);
    
    return emps.map(item => ({
      colaborador: item.name,
      empresa: item.company,
      vinculo: item.linkType,
      status: item.status,
      cargo: item.job_role || '-',
      totalEmprestado: item.totalTaken || 0,
      totalRecebido: item.totalReceived || 0,
      saldoDevedor: item.balance || 0,
      parcelaMensal: item.monthInstallment || 0,
      contratosAtivos: item.contractsCount || 0,
      aditivos: item.aditivoCount || 0
    }));
  }

  // Buscar dados para relatório de contratos
  static async getContractReport(isTestMode?: boolean, options?: ExportOptions, filters?: FilterValues): Promise<ContractReportData[]> {
    const allEmps = await LoansService.getEmployees({ mostrarTodos: true }, isTestMode);
    const emps = filterEmployeeList(allEmps, filters);
    let allContracts: ContractReportData[] = [];

    for (const emp of emps) {
      const contracts = await LoansService.getEmployeeContracts(emp.id, isTestMode);
      let filteredContracts = contracts;

      if (!filters?.incluirQuitados) {
        filteredContracts = filteredContracts.filter(c => !['Liquidado', 'Quitado', 'Finalizado'].includes(c.status) && (c.balance || 0) > 0);
      }

      if (options?.startDate || options?.endDate) {
        filteredContracts = filteredContracts.filter(c => {
          const reqDateStr = c.requestDate || c.startDate;
          if (!reqDateStr) return false;
          const reqDate = new Date(reqDateStr.length <= 10 ? reqDateStr + 'T12:00:00' : reqDateStr);
          if (options.startDate) {
            const start = new Date(options.startDate + 'T00:00:00');
            if (reqDate < start) return false;
          }
          if (options.endDate) {
            const end = new Date(options.endDate + 'T23:59:59');
            if (reqDate > end) return false;
          }
          return true;
        });
      }

      filteredContracts.forEach(c => {
        allContracts.push({
          colaborador: emp.name,
          empresa: emp.company,
          contrato: c.operationNumber,
          valorTotal: c.value || 0,
          qtdParcelas: c.installments || 0,
          valorParcela: c.installmentValue || 0,
          recebido: c.value - c.balance,
          saldo: c.balance || 0,
          parcelasPagas: c.installmentsPaid || 0,
          parcelasRestantes: (c.installments || 0) - (c.installmentsPaid || 0),
          status: c.status,
          dataSolicitacao: c.requestDate ? c.requestDate.split('T')[0] : '',
          dataInicio: c.startDate || '',
          dataTermino: c.endDate || ''
        });
      });
    }
    
    return allContracts.sort((a, b) => a.colaborador.localeCompare(b.colaborador));
  }

  // Buscar dados para relatório de parcelas (usando lógica algorítmica do LoansService/Sidebar)
  static async getPaymentReport(isTestMode?: boolean, options?: ExportOptions): Promise<PaymentReportData[]> {
    const safeTestMode = Boolean(isTestMode);
    const empsTable = safeTestMode ? 'employees_test' : 'employees';
    const loansTable = safeTestMode ? 'employee_loans_test' : 'employee_loans';

    const [empsRes, loansRes] = await Promise.all([
      supabase.from(empsTable).select('id, full_name, company'),
      supabase.from(loansTable).select('*')
    ]);

    if (empsRes.error) {
      console.error('Erro ao buscar colaboradores:', empsRes.error);
      throw new Error('Falha ao carregar dados');
    }
    if (loansRes.error) {
      console.error('Erro ao buscar empréstimos:', loansRes.error);
      throw new Error('Falha ao carregar dados');
    }

    const emps = empsRes.data || [];
    let loans = (loansRes.data || []).map((ln: any) => {
      if (ln.id === '8e685570-a96a-4c16-8515-9dde086f1659') {
        return { ...ln, start_cycle: '2026-05' };
      }
      return ln;
    });

    // Filtro de datas para os pagamentos (se baseia na request_date do contrato)
    if (options?.startDate || options?.endDate) {
      loans = loans.filter(ln => {
        if (!ln.request_date) return false;
        const reqDate = new Date(ln.request_date);
        if (options.startDate) {
          const start = new Date(options.startDate + 'T00:00:00');
          if (reqDate < start) return false;
        }
        if (options.endDate) {
          const end = new Date(options.endDate + 'T23:59:59');
          if (reqDate > end) return false;
        }
        return true;
      });
    }

    const empMap = new Map();
    emps.forEach(e => {
      empMap.set(e.id, {
        name: e.full_name || 'Desconhecido',
        company: e.company || '-'
      });
    });

    const paymentReport: PaymentReportData[] = [];

    loans.forEach(loan => {
      const emp = empMap.get(loan.employee_id);
      if (!emp) return;

      const amount = parseFloat(String(loan.amount)) || 0;
      const inst = parseInt(String(loan.installments)) || 1;
      const installmentValue = amount / inst;

      const now = new Date();
      const [y, m] = loan.start_cycle ? loan.start_cycle.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
      
      let elapsed = (now.getFullYear() - y) * 12 + ((now.getMonth() + 1) - m) + 1;
      if (now.getDate() < 10) elapsed--;
      
      const postponed = parseInt(String(loan.postponed_months)) || 0;
      elapsed -= postponed;
      elapsed = Math.max(0, Math.min(elapsed, inst));

      const extraPaid = parseFloat(String(loan.amount_paid_extra)) || 0;
      const anticipatedCount = Math.floor(extraPaid / installmentValue);

      // Calcular se o contrato está liquidado (saldo <= 0)
      const standardPaid = elapsed * installmentValue;
      const debt = Math.max(0, amount - (standardPaid + extraPaid));
      const isLiquidated = debt <= 0;

      let currentAbs = (y * 12) + m;
      let physicalIndex = 1;
      let paidViaElapsed = 0;
      let postponedUsed = 0;

      for (let i = 0; i < inst + postponed; i++) {
        const curY = Math.floor((currentAbs - 1) / 12);
        const curM = ((currentAbs - 1) % 12) + 1;
        
        const ciclo = `${curY}-${String(curM).padStart(2, '0')}`;
        const vencimento = `${curY}-${String(curM).padStart(2, '0')}-10`;

        let statusStr = 'PENDENTE';
        let valorParcela = installmentValue;

        if (isLiquidated) {
          statusStr = 'PAGO';
          physicalIndex++;
        } else if (paidViaElapsed < elapsed) {
          statusStr = 'PAGO';
          paidViaElapsed++;
          physicalIndex++;
        } else if (postponedUsed < postponed) {
          statusStr = 'POSTERGADO';
          postponedUsed++;
          valorParcela = 0;
        } else if ((physicalIndex - 1) < (elapsed + anticipatedCount)) {
          statusStr = 'PAGO';
          physicalIndex++;
        } else {
          statusStr = 'PENDENTE';
          physicalIndex++;
        }

        paymentReport.push({
          colaborador: emp.name,
          empresa: emp.company,
          ciclo: ciclo,
          vencimento: vencimento,
          valor: valorParcela,
          status: statusStr,
          dataPagamento: statusStr === 'PAGO' ? vencimento : null,
          formaPagamento: statusStr === 'PAGO' ? 'Automático' : null
        });

        currentAbs++;
      }
    });

    return paymentReport.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }

  // Converter dados para CSV
  static convertToCSV(data: any[], headers?: string[]): string {
    if (data.length === 0) return '';
    
    const csvHeaders = headers || Object.keys(data[0]);
    let csv = csvHeaders.join(';') + '\n';
    
    data.forEach(row => {
      const values = csvHeaders.map(header => {
        const key = header.toLowerCase().replace(/\s+/g, '').replace(/[()r$]/g, '');
        const value = row[key] ?? row[header] ?? '';
        
        const stringValue = String(value);
        if (stringValue.includes(';') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csv += values.join(';') + '\n';
    });
    
    return csv;
  }

  // Download arquivo CSV
  static downloadCSV(csvContent: string, filename: string): void {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Exportar relatório completo em formato CSV hierárquico respeitando 100% dos filtros
  static async exportFullReport(filters?: FilterValues, isTestMode?: boolean, options?: ExportOptions): Promise<void> {
    try {
      const allEmps = await LoansService.getEmployees({ mostrarTodos: true }, isTestMode);
      let employees = filterEmployeeList(allEmps, filters);

      // Buscar contratos dos colaboradores filtrados
      const empContractsMap = new Map<string, any[]>();
      await Promise.all(
        employees.map(async emp => {
          let contracts = await LoansService.getEmployeeContracts(emp.id, isTestMode);
          if (!filters?.incluirQuitados) {
            contracts = contracts.filter(c => !['Liquidado', 'Quitado', 'Finalizado'].includes(c.status) && (c.balance || 0) > 0);
          }
          if (options?.startDate || options?.endDate) {
            contracts = contracts.filter(c => {
              const reqDateStr = c.requestDate || c.startDate;
              if (!reqDateStr) return false;
              const reqDate = new Date(reqDateStr.length <= 10 ? reqDateStr + 'T12:00:00' : reqDateStr);
              if (options.startDate && reqDate < new Date(options.startDate + 'T00:00:00')) return false;
              if (options.endDate && reqDate > new Date(options.endDate + 'T23:59:59')) return false;
              return true;
            });
          }
          empContractsMap.set(emp.id, contracts);
        })
      );

      // Se filtro de data estiver ativo, manter apenas quem tem contratos no período
      if (options?.startDate || options?.endDate) {
        employees = employees.filter(e => (empContractsMap.get(e.id) || []).length > 0);
      }

      let csv = '';
      const formatCur = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
      
      const filterSummary = buildFilterSummaryText(filters, options);
      csv += `RELATÓRIO GERENCIAL DE EMPRÉSTIMOS DE COLABORADORES\n`;
      csv += `Filtros Aplicados:;${filterSummary}\n`;
      csv += `Data de Emissão:;${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n`;
      csv += `Total de Colaboradores Filtrados:;${employees.length}\n\n`;

      // 1. Resumo Gerencial do conjunto filtrado
      if (options?.includeSummary) {
        const totalEmprestado = employees.reduce((s, e) => s + (e.totalTaken || 0), 0);
        const totalRecebido = employees.reduce((s, e) => s + (e.totalReceived || 0), 0);
        const saldoDevedor = employees.reduce((s, e) => s + (e.balance || 0), 0);
        const recebivelMes = employees.reduce((s, e) => s + (e.monthInstallment || 0), 0);
        const contratosAtivos = employees.filter(e => e.loanStatus === 'Ativo').length;

        csv += 'RESUMO GERAL DOS DADOS FILTRADOS\n';
        csv += `Colaboradores com Contratos Ativos:;${contratosAtivos}\n`;
        csv += `Total Tomado (Filtrado):;${formatCur(totalEmprestado)}\n`;
        csv += `Total Recebido (Filtrado):;${formatCur(totalRecebido)}\n`;
        csv += `Saldo Devedor (Filtrado):;${formatCur(saldoDevedor)}\n`;
        csv += `Recebíveis Previstos no Mês:;${formatCur(recebivelMes)}\n\n`;
      }
      
      csv += 'DETALHAMENTO CONSOLIDADO POR COLABORADOR\n\n';

      employees.forEach(emp => {
        csv += `COLABORADOR:;${emp.name};Empresa:;${emp.company};Vínculo:;${emp.linkType};Status RH:;${emp.status};Cargo:;${emp.job_role || '-'}\n`;
        csv += `Total Tomado:;${formatCur(emp.totalTaken || 0)};Total Recebido:;${formatCur(emp.totalReceived || 0)};Saldo Devedor:;${formatCur(emp.balance || 0)};Parcela Mensal:;${formatCur(emp.monthInstallment || 0)}\n`;
        
        const contracts = empContractsMap.get(emp.id) || [];
        if (contracts.length > 0) {
          csv += `Contrato;Valor Total;Qtd Parcelas;Valor Parcela;Recebido;Saldo;Parcelas Restantes;Status;Data Solicitacao;Data Inicio;Data Termino\n`;
          contracts.forEach(c => {
            csv += `${c.operationNumber};${formatCur(c.value || 0)};${c.installments || 0};${formatCur(c.installmentValue || 0)};${formatCur((c.value || 0) - (c.balance || 0))};${formatCur(c.balance || 0)};${(c.installments || 0) - (c.installmentsPaid || 0)};${c.status};${c.requestDate ? c.requestDate.split('T')[0] : ''};${c.startDate || ''};${c.endDate || ''}\n`;
          });
        } else {
          csv += `Nenhum empréstimo ativo cadastrado para este colaborador.\n`;
        }
        csv += '\n';
      });

      const filename = `Relatorio_Emprestimos_${new Date().toISOString().split('T')[0]}.csv`;
      this.downloadCSV(csv, filename);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      throw error;
    }
  }

  // Exportar apenas resumo por colaborador
  static async exportEmployeeReport(filters?: FilterValues): Promise<void> {
    const data = await this.getEmployeeReport(false, undefined, filters);
    const csv = this.convertToCSV(data, [
      'Colaborador', 'Empresa', 'Vínculo', 'Status', 'Cargo',
      'Total Emprestado (R$)', 'Total Recebido (R$)', 'Saldo Devedor (R$)',
      'Parcela Mensal (R$)', 'Contratos Ativos', 'Aditivos'
    ]);
    
    const filename = `Relatorio_Colaboradores_${new Date().toISOString().split('T')[0]}.csv`;
    this.downloadCSV(csv, filename);
  }

  // Exportar apenas contratos
  static async exportContractReport(filters?: FilterValues): Promise<void> {
    const data = await this.getContractReport(false, undefined, filters);
    const csv = this.convertToCSV(data, [
      'Colaborador', 'Empresa', 'Contrato', 'Valor Total (R$)',
      'Qtd Parcelas', 'Valor Parcela (R$)', 'Recebido (R$)', 'Saldo (R$)',
      'Parcelas Pagas', 'Parcelas Restantes', 'Status', 'Data Início', 'Data Término'
    ]);
    
    const filename = `Relatorio_Contratos_${new Date().toISOString().split('T')[0]}.csv`;
    this.downloadCSV(csv, filename);
  }

  /**
   * EXPORTAR RELATÓRIO COMPLETO EM PDF (PAISAGEM + LOGO) RESPEITANDO 100% DOS FILTROS
   */
  static async exportFullReportPDF(filters?: FilterValues, isTestMode?: boolean, options?: ExportOptions): Promise<void> {
    try {
      // 1. Obter todos os colaboradores e aplicar rigorosamente os filtros da tela
      const allEmps = await LoansService.getEmployees({ mostrarTodos: true }, isTestMode);
      let employees = filterEmployeeList(allEmps, filters);

      // 2. Buscar contratos apenas para os colaboradores filtrados
      const empContractsMap = new Map<string, any[]>();
      await Promise.all(
        employees.map(async emp => {
          let contracts = await LoansService.getEmployeeContracts(emp.id, isTestMode);
          if (!filters?.incluirQuitados) {
            contracts = contracts.filter(c => !['Liquidado', 'Quitado', 'Finalizado'].includes(c.status) && (c.balance || 0) > 0);
          }
          if (options?.startDate || options?.endDate) {
            contracts = contracts.filter(c => {
              const reqDateStr = c.requestDate || c.startDate;
              if (!reqDateStr) return false;
              const reqDate = new Date(reqDateStr.length <= 10 ? reqDateStr + 'T12:00:00' : reqDateStr);
              if (options.startDate && reqDate < new Date(options.startDate + 'T00:00:00')) return false;
              if (options.endDate && reqDate > new Date(options.endDate + 'T23:59:59')) return false;
              return true;
            });
          }
          empContractsMap.set(emp.id, contracts);
        })
      );

      // Se filtro de data estiver ativo, focar apenas em quem possui contratos no período
      if (options?.startDate || options?.endDate) {
        employees = employees.filter(e => (empContractsMap.get(e.id) || []).length > 0);
      }

      // Totais calculados diretamente a partir dos registros filtrados
      const totalEmprestado = employees.reduce((s, e) => s + (e.totalTaken || 0), 0);
      const totalRecebido = employees.reduce((s, e) => s + (e.totalReceived || 0), 0);
      const saldoDevedor = employees.reduce((s, e) => s + (e.balance || 0), 0);
      const recebivelMes = employees.reduce((s, e) => s + (e.monthInstallment || 0), 0);
      const contratosAtivosCount = employees.filter(e => e.loanStatus === 'Ativo').length;
      const contratosQuitadosCount = employees.filter(e => e.loanStatus === 'Quitado').length;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Controle de desenho de fundo timbrado
      const pagesWithBackground = new Set<number>();

      const addBackground = () => {
        const p = (doc.internal as any).getCurrentPageInfo().pageNumber;
        if (pagesWithBackground.has(p)) return;
        pagesWithBackground.add(p);
        try {
          doc.addImage(TIMBRADO_B64, 'JPEG', 0, 0, pageWidth, pageHeight);
        } catch (e) {
          console.warn('Erro ao carregar imagem do timbrado:', e);
        }
      };

      const formatCurrency = (val: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

      const formatDate = (dateStr: string | null) => {
        if (!dateStr || dateStr === '-') return '-';
        const clean = dateStr.split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return clean;
      };
      
      let currentY = 10;
      const filterSummaryText = buildFilterSummaryText(filters, options);

      // --- PÁGINA 1: RESUMO DO PERÍODO / FILTRADO (SE SOLICITADO) ---
      if (options?.includeSummary) {
        addBackground();
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(5, 150, 105);
        doc.text('RELATÓRIO GERENCIAL DE EMPRÉSTIMOS DE COLABORADORES', 14, 18);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(`FILTROS APLICADOS:`, 14, 25);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`${filterSummaryText}`, 47, 25);

        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}  •  ${employees.length} colaborador(es) selecionado(s)`, 14, 31);

        // Cards de resumo
        const startY = 40;
        const boxW = 48;
        const boxH = 24;
        const gap = 6;

        const drawCard = (x: number, y: number, title: string, value: string, accentColor?: [number, number, number]) => {
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(x, y, boxW, boxH, 2.5, 2.5, 'FD');
          
          if (accentColor) {
            doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
            doc.rect(x, y + 2, 2, boxH - 4, 'F');
          }

          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text(title.toUpperCase(), x + 5, y + 7.5);

          doc.setFontSize(11.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(value, x + 5, y + 17);
        };

        drawCard(14, startY, 'Total Tomado', formatCurrency(totalEmprestado), [5, 150, 105]);
        drawCard(14 + boxW + gap, startY, 'Total Recebido', formatCurrency(totalRecebido), [37, 99, 235]);
        drawCard(14 + (boxW + gap) * 2, startY, 'Saldo Devedor', formatCurrency(saldoDevedor), [220, 38, 38]);
        drawCard(14 + (boxW + gap) * 3, startY, 'Recebível no Mês', formatCurrency(recebivelMes), [217, 119, 6]);
        drawCard(14 + (boxW + gap) * 4, startY, 'Contratos Ativos', `${contratosAtivosCount} (${employees.length} colab.)`, [100, 116, 139]);

        doc.addPage();
        addBackground();
        currentY = 18;
      } else {
        addBackground();
        currentY = 18;
      }

      // --- TÍTULO DOS DETALHES ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(5, 150, 105);
      doc.text('DETALHAMENTO CONSOLIDADO POR COLABORADOR', 14, currentY);
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Filtros: ${filterSummaryText}  •  Total: ${employees.length} colaboradores`, 14, currentY + 5.5);
      
      currentY += 13;

      // Se nenhum colaborador atendeu aos filtros
      if (employees.length === 0) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(14, currentY, pageWidth - 14 - 60, 25, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text('Nenhum colaborador ou contrato atende aos filtros selecionados.', 20, currentY + 14);
      }

      // 3. Iterar nos colaboradores filtrados e renderizar
      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        const empContracts = empContractsMap.get(emp.id) || [];

        // Altura estimada do bloco para paginação inteligente
        const estimatedHeight = 10 + 4 + 7 + Math.max(1, empContracts.length) * 6.5 + 10;

        if (currentY + estimatedHeight > pageHeight - 16) {
          doc.addPage();
          addBackground();
          currentY = 18;
        }

        // Cabeçalho do Colaborador (Banner)
        doc.setFillColor(241, 245, 249); // slate-100
        doc.roundedRect(14, currentY, pageWidth - 14 - 60, 9, 1.5, 1.5, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(`${emp.name.toUpperCase()}`, 18, currentY + 6);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105); // slate-600
        const roleText = emp.job_role ? `  |  Cargo: ${emp.job_role}` : '';
        const aditivoText = emp.aditivoCount ? `  |  Aditivos: ${emp.aditivoCount}` : '';
        doc.text(`Empresa: ${emp.company}  |  Vínculo: ${emp.linkType}  |  Status RH: ${emp.status}${roleText}${aditivoText}`, 14 + 85, currentY + 6);
        
        currentY += 11;

        // Subtítulo de totais do colaborador
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(
          `TOTAL TOMADO: ${formatCurrency(emp.totalTaken || 0)}   •   TOTAL RECEBIDO: ${formatCurrency(emp.totalReceived || 0)}   •   SALDO DEVEDOR: ${formatCurrency(emp.balance || 0)}   •   PARCELA MENSAL: ${formatCurrency(emp.monthInstallment || 0)}`,
          14,
          currentY
        );

        currentY += 3.5;

        // Tabela de contratos
        if (empContracts.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Contrato', 'V. Total', 'Qtde', 'V. Parcela', 'Recebido', 'Saldo', 'Restantes', 'Status', 'Solicitação', '1ª Parcela', 'Última Parcela']],
            body: empContracts.map(c => [
              c.operationNumber || '-',
              formatCurrency(c.value || 0),
              c.installments || 0,
              formatCurrency(c.installmentValue || 0),
              formatCurrency((c.value || 0) - (c.balance || 0)),
              formatCurrency(c.balance || 0),
              (c.installments || 0) - (c.installmentsPaid || 0),
              c.status || '-',
              formatDate(c.requestDate),
              formatDate(c.startDate),
              formatDate(c.endDate)
            ]),
            margin: { left: 14, right: 60 },
            styles: { fontSize: 7, cellPadding: 1 },
            headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
            theme: 'striped',
            willDrawPage: () => {
              addBackground();
            }
          });

          currentY = (doc as any).lastAutoTable.finalY + 9;
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Nenhum contrato com saldo em aberto para este colaborador.', 14, currentY + 3);
          currentY += 8;
        }
      }

      // Adicionar paginação em todas as páginas
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 8);
      }

      doc.save(`Relatorio_Emprestimos_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      throw error;
    }
  }
}
