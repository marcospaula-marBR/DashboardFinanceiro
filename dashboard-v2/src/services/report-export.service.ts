import { supabase } from '@/lib/supabase';

import { jsPDF } from 'jspdf';

import autoTable from 'jspdf-autotable';

import { TIMBRADO_B64 } from '@/lib/timbrado_base64';

import { FilterValues } from '@/components/loans/FilterBar';

import { LoansService } from './loans.service';

import { ExportOptions } from '@/components/loans/ExportModal';



export interface LoansReportData {

  colaborador: string;

  empresa: string;

  vinculo: string;

  status: string;

  totalEmprestado: number;

  totalRecebido: number;

  saldoDevedor: number;

  parcelaMensal: number;

  contratosAtivos: number;

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



export class ReportExportService {

  // Buscar dados para relatório de colaboradores (usando lógica real do LoansService)

  static async getEmployeeReport(isTestMode?: boolean, options?: ExportOptions): Promise<LoansReportData[]> {

    const emps = await LoansService.getEmployees({ 

      mostrarTodos: true

    }, isTestMode);

    

    return emps.map(item => ({

      colaborador: item.name,

      empresa: item.company,

      vinculo: item.linkType,

      status: item.status,

      totalEmprestado: item.totalTaken || 0,

      totalRecebido: item.totalReceived || 0,

      saldoDevedor: item.balance || 0,

      parcelaMensal: item.monthInstallment || 0,

      contratosAtivos: item.contractsCount || 0

    }));

  }



  // Buscar dados para relatório de contratos (usando a lógica que já funciona no Dash)

  static async getContractReport(isTestMode?: boolean, options?: ExportOptions): Promise<ContractReportData[]> {

    const emps = await LoansService.getEmployees({ 

      mostrarTodos: true

    }, isTestMode);

    let allContracts: ContractReportData[] = [];



    for (const emp of emps) {

      const contracts = await LoansService.getEmployeeContracts(emp.id, isTestMode);

      contracts.forEach(c => {

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

    let loans = loansRes.data || [];



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

    

    // Usar headers fornecidos ou extrair do primeiro objeto

    const csvHeaders = headers || Object.keys(data[0]);

    

    // Criar linha de cabeçalho

    let csv = csvHeaders.join(';') + '\n';

    

    // Adicionar linhas de dados

    data.forEach(row => {

      const values = csvHeaders.map(header => {

        // Converter camelCase para o nome da propriedade

        const key = header.toLowerCase().replace(/\s+/g, '').replace(/[()r$]/g, '');

        const value = row[key] ?? row[header] ?? '';

        

        // Escapar valores que contêm ponto e vírgula

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

    // BOM para Excel ler UTF-8 corretamente

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



  // Exportar relatório completo em formato CSV hierárquico

  static async exportFullReport(filters?: FilterValues, isTestMode?: boolean, options?: ExportOptions): Promise<void> {

    try {

      let [employees, contracts] = await Promise.all([

        this.getEmployeeReport(isTestMode, options),

        this.getContractReport(isTestMode, options)

      ]);



      // Aplicar filtros se existirem

      if (filters) {

        if (filters.empresa) {

          employees = employees.filter(e => e.empresa === filters.empresa);

          contracts = contracts.filter(c => c.empresa === filters.empresa);

        }

        if (filters.search) {

          const term = filters.search.toLowerCase();

          employees = employees.filter(e => e.colaborador.toLowerCase().includes(term));

          contracts = contracts.filter(c => c.colaborador.toLowerCase().includes(term));

        }

        if (!filters.mostrarTodos) {

          employees = employees.filter(e => e.totalEmprestado > 0 || e.saldoDevedor > 0);

        }

        if (!filters.incluirQuitados) {

          employees = employees.filter(e => e.status !== 'Quitado');

          contracts = contracts.filter(c => c.status !== 'Liquidado' && c.status !== 'Quitado' && c.status !== 'Finalizado');

        }

      }



      let csv = '';

      const formatCur = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

      

      // 1. Resumo Gerencial (Apenas do Período Filtrado)

      if (options?.includeSummary) {

        const stats = await LoansService.getStats(isTestMode, { dateStart: options.startDate, dateEnd: options.endDate });

        csv += 'RESUMO GERAL DO PERÍODO (GERENCIAL)\n';

        if (options.startDate || options.endDate) {

          csv += `Período Filtrado:;${options.startDate ? new Date(options.startDate+'T12:00:00').toLocaleDateString('pt-BR') : 'Início'} até ${options.endDate ? new Date(options.endDate+'T12:00:00').toLocaleDateString('pt-BR') : 'Hoje'}\n`;

        }

        csv += `Qtd de Empréstimos Liberados no Período:;${stats.contratosAtivos + stats.contratosLiquidados}\n`;

        csv += `Total Tomado no Período:;${formatCur(stats.totalEmprestado)}\n`;

        csv += `Total Recebido no Período:;${formatCur(stats.totalRecebido)}\n`;

        csv += `Saldo Devedor do Período:;${formatCur(stats.saldoDevedor)}\n\n`;

      }

      

      csv += 'DETALHAMENTO CONSOLIDADO POR COLABORADOR\n\n';



      // 2. Filtrar colaboradores se houver filtro de data (para mostrar quem teve movimentação)

      let activeEmployees = [...employees];

      if (options?.startDate || options?.endDate) {

        const activeEmpNames = new Set(

          contracts.filter(c => {

            if (!c.dataSolicitacao) return false;

            const reqDate = new Date(c.dataSolicitacao);

            if (options.startDate && reqDate < new Date(options.startDate + 'T00:00:00')) return false;

            if (options.endDate && reqDate > new Date(options.endDate + 'T23:59:59')) return false;

            return true;

          }).map(c => c.colaborador)

        );

        activeEmployees = employees.filter(e => activeEmpNames.has(e.colaborador));

      }



      // 3. Fichas dos Colaboradores com empréstimos embaixo

      activeEmployees.forEach(emp => {

        csv += `COLABORADOR:;${emp.colaborador};Empresa:;${emp.empresa};Vínculo:;${emp.vinculo};Status:;${emp.status}\n`;

        csv += `Total Tomado (Global):;${formatCur(emp.totalEmprestado)};Total Recebido (Global):;${formatCur(emp.totalRecebido)};Saldo Devedor Global:;${formatCur(emp.saldoDevedor)};Parcela Mensal:;${formatCur(emp.parcelaMensal)}\n`;

        

        const empContracts = contracts.filter(c => c.colaborador === emp.colaborador);

        if (empContracts.length > 0) {

          csv += `Contrato;Valor Total;Qtd Parcelas;Valor Parcela;Recebido;Saldo;Parcelas Restantes;Status;Data Solicitacao;Data Inicio;Data Termino\n`;

          empContracts.forEach(c => {

            csv += `${c.contrato};${formatCur(c.valorTotal)};${c.qtdParcelas};${formatCur(c.valorParcela)};${formatCur(c.recebido)};${formatCur(c.saldo)};${c.parcelasRestantes};${c.status};${c.dataSolicitacao};${c.dataInicio};${c.dataTermino}\n`;

          });

        } else {

          csv += `Nenhum empréstimo ativo ou quitado cadastrado.\n`;

        }

        csv += '\n'; // Linha em branco separadora

      });



      const filename = `Relatorio_Emprestimos_${new Date().toISOString().split('T')[0]}.csv`;

      this.downloadCSV(csv, filename);

    } catch (error) {

      console.error('Erro ao exportar CSV:', error);

      throw error;

    }

  }



  // Exportar apenas resumo por colaborador

  static async exportEmployeeReport(): Promise<void> {

    const data = await this.getEmployeeReport();

    const csv = this.convertToCSV(data, [

      'Colaborador', 'Empresa', 'Vínculo', 'Status',

      'Total Emprestado (R$)', 'Total Recebido (R$)', 'Saldo Devedor (R$)',

      'Parcela Mensal (R$)', 'Contratos Ativos'

    ]);

    

    const filename = `Relatorio_Colaboradores_${new Date().toISOString().split('T')[0]}.csv`;

    this.downloadCSV(csv, filename);

  }



  // Exportar apenas contratos

  static async exportContractReport(): Promise<void> {

    const data = await this.getContractReport();

    const csv = this.convertToCSV(data, [

      'Colaborador', 'Empresa', 'Contrato', 'Valor Total (R$)',

      'Qtd Parcelas', 'Valor Parcela (R$)', 'Recebido (R$)', 'Saldo (R$)',

      'Parcelas Pagas', 'Parcelas Restantes', 'Status', 'Data Início', 'Data Término'

    ]);

    

    const filename = `Relatorio_Contratos_${new Date().toISOString().split('T')[0]}.csv`;

    this.downloadCSV(csv, filename);

  }



  /**

   * EXPORTAR RELATÓRIO COMPLETO EM PDF (PAISAGEM + LOGO) HIERÁRQUICO

   */

  static async exportFullReportPDF(filters?: FilterValues, isTestMode?: boolean, options?: ExportOptions): Promise<void> {

    try {

      let [employees, contracts] = await Promise.all([

        this.getEmployeeReport(isTestMode, options),

        this.getContractReport(isTestMode, options)

      ]);



      // Aplicar filtros para sincronizar com o que o usuário vê no Dashboard

      if (filters) {

        if (filters.empresa) {

          employees = employees.filter(e => e.empresa === filters.empresa);

          contracts = contracts.filter(c => c.empresa === filters.empresa);

        }

        if (filters.search) {

          const term = filters.search.toLowerCase();

          employees = employees.filter(e => e.colaborador.toLowerCase().includes(term));

          contracts = contracts.filter(c => c.colaborador.toLowerCase().includes(term));

        }

        if (!filters.mostrarTodos) {

          employees = employees.filter(e => e.totalEmprestado > 0 || e.saldoDevedor > 0);

        }

        if (!filters.incluirQuitados) {

          employees = employees.filter(e => e.status !== 'Quitado');

          contracts = contracts.filter(c => !['Liquidado', 'Quitado', 'Finalizado'].includes(c.status));

        }

      }



      const doc = new jsPDF({

        orientation: 'landscape',

        unit: 'mm',

        format: 'a4'

      });



      const pageWidth = doc.internal.pageSize.getWidth();

      const pageHeight = doc.internal.pageSize.getHeight();



      const addBackground = () => {

        try {

          doc.addImage(TIMBRADO_B64, 'JPEG', 0, 0, pageWidth, pageHeight);

        } catch (e) {

          console.warn('Erro ao carregar imagem do timbrado:', e);

        }

      };



      const formatCurrency = (val: number) => 

        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);



      const formatDate = (dateStr: string | null) => {

        if (!dateStr) return '-';

        const d = new Date(dateStr);

        if (dateStr.length <= 10) d.setUTCHours(12);

        return d.toLocaleDateString('pt-BR');

      };

      

      let currentY = 10;



      // --- PÁGINA 1: RESUMO DO PERÍODO (SE SOLICITADO) ---

      if (options?.includeSummary) {

        addBackground();

        const stats = await LoansService.getStats(isTestMode, { dateStart: options.startDate, dateEnd: options.endDate });

        

        doc.setFont('helvetica', 'bold');

        doc.setFontSize(20);

        doc.setTextColor(5, 150, 105);

        doc.text('RESUMO GERAL DO PERÍODO (GERENCIAL)', 14, 20);

        

        doc.setFontSize(11);

        doc.setTextColor(100, 116, 139);

        let periodText = 'Período Completo (Todo o histórico)';

        if (options?.startDate || options?.endDate) {

           periodText = `Filtrado por Data de Solicitação: de ${options?.startDate ? formatDate(options.startDate) : 'Início'} até ${options?.endDate ? formatDate(options.endDate) : 'Hoje'}`;

        }

        doc.text(periodText, 14, 28);

        doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 34);



        // Cards de resumo

        const startY = 45;

        const boxW = 50;

        const boxH = 25;

        const gap = 8;



        const drawCard = (x: number, y: number, title: string, value: string) => {

          doc.setFillColor(248, 250, 252);

          doc.setDrawColor(226, 232, 240);

          doc.roundedRect(x, y, boxW, boxH, 3, 3, 'FD');

          doc.setFontSize(8.5);

          doc.setFont('helvetica', 'normal');

          doc.setTextColor(100, 116, 139);

          doc.text(title, x + 4, y + 8);

          doc.setFontSize(13);

          doc.setFont('helvetica', 'bold');

          doc.setTextColor(15, 23, 42);

          doc.text(value, x + 4, y + 18);

        };



        drawCard(14, startY, 'Total Tomado (Período)', formatCurrency(stats.totalEmprestado));

        drawCard(14 + boxW + gap, startY, 'Total Recebido (Período)', formatCurrency(stats.totalRecebido));

        drawCard(14 + (boxW + gap)*2, startY, 'Saldo Devedor (Período)', formatCurrency(stats.saldoDevedor));

        drawCard(14 + (boxW + gap)*3, startY, 'Qtd Empréstimos Liberados', (stats.contratosAtivos + stats.contratosLiquidados).toString());



        doc.addPage();

        currentY = 20;

      } else {

        addBackground();

        currentY = 20;

      }



      // --- TÍTULO DOS DETALHES ---

      doc.setFont('helvetica', 'bold');

      doc.setFontSize(18);

      doc.setTextColor(5, 150, 105);

      doc.text('DETALHAMENTO CONSOLIDADO POR COLABORADOR', 14, currentY);

      

      doc.setFontSize(9);

      doc.setTextColor(100, 116, 139);

      doc.text(`Lista de empréstimos e histórico global de saldos por colaborador • Emitido em: ${new Date().toLocaleDateString('pt-BR')}`, 14, currentY + 6);

      

      currentY += 15;



      // 2. Filtrar colaboradores se houver filtro de data (focar em quem teve movimentação)

      let activeEmployees = [...employees];

      if (options?.startDate || options?.endDate) {

        const activeEmpNames = new Set(

          contracts.filter(c => {

            if (!c.dataSolicitacao) return false;

            const reqDate = new Date(c.dataSolicitacao);

            if (options.startDate && reqDate < new Date(options.startDate + 'T00:00:00')) return false;

            if (options.endDate && reqDate > new Date(options.endDate + 'T23:59:59')) return false;

            return true;

          }).map(c => c.colaborador)

        );

        activeEmployees = employees.filter(e => activeEmpNames.has(e.colaborador));

      }



      // 3. Iterar nos colaboradores e renderizar

      for (let i = 0; i < activeEmployees.length; i++) {

        const emp = activeEmployees[i];

        const empContracts = contracts.filter(c => c.colaborador === emp.colaborador);



        // Se o espaço vertical restante for muito pequeno, cria página nova (precisamos de ~55mm)

        if (currentY > pageHeight - 65) {

          doc.addPage();

          addBackground();

          currentY = 20;

        }



        // Cabeçalho do Colaborador (Destaque visual)

        doc.setFillColor(241, 245, 249); // slate-100

        doc.roundedRect(14, currentY, pageWidth - 14 - 60, 10, 1.5, 1.5, 'F');

        

        doc.setFont('helvetica', 'bold');

        doc.setFontSize(11);

        doc.setTextColor(15, 23, 42); // slate-900

        doc.text(`${emp.colaborador.toUpperCase()}`, 18, currentY + 6.5);

        

        doc.setFont('helvetica', 'normal');

        doc.setFontSize(8.5);

        doc.setTextColor(71, 85, 105); // slate-600

        doc.text(`Empresa: ${emp.empresa}  |  Vínculo: ${emp.vinculo}  |  Status: ${emp.status}`, 14 + 100, currentY + 6.5);

        

        currentY += 12;



        // Subtítulo de totais do colaborador

        doc.setFont('helvetica', 'bold');

        doc.setFontSize(8);

        doc.setTextColor(71, 85, 105);

        doc.text(

          `TOTAL TOMADO (HISTÓRICO): ${formatCurrency(emp.totalEmprestado)}   •   TOTAL RECEBIDO: ${formatCurrency(emp.totalRecebido)}   •   SALDO DEVEDOR GLOBAL: ${formatCurrency(emp.saldoDevedor)}   •   PARCELA MENSAL: ${formatCurrency(emp.parcelaMensal)}`,

          14,

          currentY

        );



        currentY += 3;



        // Tabela de contratos

        autoTable(doc, {

          startY: currentY,

          head: [['Contrato', 'V. Total', 'Pelas', 'V. Parcela', 'Recebido', 'Saldo', 'Restantes', 'Status', 'Solicitação', '1ª Parcela', 'Última Parcela']],

          body: empContracts.map(c => [

            c.contrato,

            formatCurrency(c.valorTotal),

            c.qtdParcelas,

            formatCurrency(c.valorParcela),

            formatCurrency(c.recebido),

            formatCurrency(c.saldo),

            c.parcelasRestantes,

            c.status,

            formatDate(c.dataSolicitacao),

            formatDate(c.dataInicio),

            formatDate(c.dataTermino)

          ]),

          theme: 'striped',

          headStyles: { fillColor: [15, 118, 110], fontSize: 7, cellPadding: 1.5 }, // Teal 700

          styles: { fontSize: 7, cellPadding: 1.5 },

          margin: { left: 14, right: 60 },

          willDrawPage: addBackground

        });



        // Atualizar Y para o próximo colaborador

        currentY = (doc as any).lastAutoTable.finalY + 12;

      }



      // Adicionar paginação e rodapé simples no final

      const totalPages = doc.getNumberOfPages();

      for (let i = 1; i <= totalPages; i++) {

        doc.setPage(i);

        doc.setFontSize(8);

        doc.setTextColor(150);

        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 8);

      }



      doc.save(`Relatorio_Financeiro_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {

      console.error("Erro ao gerar PDF:", error);

      throw error;

    }

  }

}

