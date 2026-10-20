import React, { useState, useMemo, useEffect } from 'react';
import { X, Download, FileText, CheckSquare, Square, Printer, FileSpreadsheet, User, Building2, MapPin, CreditCard, DollarSign, History, Calculator, HelpCircle, Link as LinkIcon, Users, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { Employee, EmploymentContract, MonthlyCost, getRemunerationLabel } from '@/types/loans';
import { formatCurrency } from '@/services/loans.service';
import { formatCompanyTime, calculateCombinedCompanyTime } from './PeopleBadges';

export const formatCostOrigem = (origem?: string) => {
  if (!origem) return 'Lançamento Base';
  const o = origem.toLowerCase();
  if (o.includes('dianna_batch_clt')) return 'Folha Mensal Dianna (CLT)';
  if (o.includes('dianna_import')) return 'Planilha Dianna (Importação)';
  if (o.includes('manual')) return 'Lançamento Manual';
  if (o.includes('holerite_pdf') || o.includes('pdf')) return 'Holerite PDF (OCR)';
  if (o.includes('csv')) return 'Planilha CSV';
  return origem;
};

export const getCostOrigemBadgeStyle = (origem?: string) => {
  if (!origem) return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
  const o = origem.toLowerCase();
  if (o.includes('dianna_batch_clt')) return { bg: '#eef2ff', color: '#3730a3', border: '#c7d2fe' };
  if (o.includes('dianna_import')) return { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' };
  if (o.includes('manual')) return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
  if (o.includes('holerite_pdf') || o.includes('pdf')) return { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
  if (o.includes('csv')) return { bg: '#f8fafc', color: '#334155', border: '#cbd5e1' };
  return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
};

interface HistoryItem {
  id: string;
  employee_id?: string;
  event_type: string;
  change_date: string;
  previous_value?: string;
  new_value?: string;
  observations?: string;
  created_at?: string;
}

export interface ProfileExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Partial<Employee>;
  history?: HistoryItem[];
  bonds?: EmploymentContract[];
  costs?: MonthlyCost[];
  loanSummary?: { totalTaken: number; totalReceived: number; balance: number } | null;
  previousProfile?: Partial<Employee> | null;
  previousCosts?: MonthlyCost[];
  previousHistory?: HistoryItem[];
  initialOnlyCosts?: boolean;
  onOpenBatchAudit?: () => void;
}

export function ProfileExportModal({
  isOpen,
  onClose,
  profile,
  history = [],
  bonds = [],
  costs = [],
  loanSummary = null,
  previousProfile = null,
  previousCosts = [],
  previousHistory = [],
  initialOnlyCosts = false,
  onOpenBatchAudit
}: ProfileExportModalProps) {
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [isUnifiedExport, setIsUnifiedExport] = useState(profile.is_unified_history !== false);
  const [reportMode, setReportMode] = useState<'audit' | 'full'>(initialOnlyCosts ? 'audit' : 'full');

  // Sincronizar modo quando initialOnlyCosts mudar
  useEffect(() => {
    if (initialOnlyCosts) {
      setReportMode('audit');
      setIncludePersonal(false);
      setIncludeContractual(false);
      setIncludeAddressContact(false);
      setIncludeBanking(false);
      setIncludeRemuneration(false);
      setIncludeTrajectory(false);
      setIncludeCostsHistory(true);
      setIncludeCostsChart(true);
    }
  }, [initialOnlyCosts]);

  // Filtrar custos e histórico se o usuário optar por NÃO unificar
  const effectiveCosts = useMemo(() => {
    if (!isUnifiedExport && previousProfile && profile.id) {
      return costs.filter(c => c.employee_id === profile.id);
    }
    return costs;
  }, [costs, isUnifiedExport, previousProfile, profile.id]);

  const effectiveHistory = useMemo(() => {
    if (!isUnifiedExport && previousProfile && profile.id) {
      return history.filter(h => h.employee_id === profile.id);
    }
    return history;
  }, [history, isUnifiedExport, previousProfile, profile.id]);

  // Seleção Módulos/Abas do Cadastro
  const [includePersonal, setIncludePersonal] = useState(!initialOnlyCosts);
  const [includeContractual, setIncludeContractual] = useState(!initialOnlyCosts);
  const [includeAddressContact, setIncludeAddressContact] = useState(!initialOnlyCosts);
  const [includeBanking, setIncludeBanking] = useState(!initialOnlyCosts);
  const [includeRemuneration, setIncludeRemuneration] = useState(!initialOnlyCosts);
  const [includeTrajectory, setIncludeTrajectory] = useState(!initialOnlyCosts);
  const [includeCostsHistory, setIncludeCostsHistory] = useState(true);
  const [includeCostsChart, setIncludeCostsChart] = useState(true);

  // Totalizadores acumulados do histórico de custos por verbas
  const costTotals = useMemo(() => {
    if (!effectiveCosts || effectiveCosts.length === 0) return null;
    return effectiveCosts.reduce((acc, c) => {
      const fixed = c.valor_fixo || 0;
      const bonus = c.valor_bonus || 0;
      const comissao = c.valor_comissao || 0;
      const horaExtra = c.valor_hora_extra || 0;
      const adicionalNot = c.valor_adicional_not || 0;
      const vr = c.valor_vr || 0;
      const vt = c.valor_vt || 0;
      const cesta = c.valor_cesta || 0;
      const ajudaCusto = c.valor_ajuda_custo || 0;
      const incentivos = c.valor_incentivos || 0;
      const adiantamento = c.valor_adiantamento || 0;
      const decimo = c.valor_decimo_terceiro || 0;
      const ferias = c.valor_ferias || 0;
      const rescisao = c.valor_rescisao || 0;
      const descontos = c.valor_descontos || 0;
      const fgts = c.valor_fgts || 0;
      const inss = c.inss_empregado || 0;
      const irrf = c.irrf_empregado || 0;
      const liquido = c.valor_liquido || 0;
      const isCLT = c.vinculo_tipo === 'CLT';
      const realCost = liquido + (isCLT ? adiantamento : 0);

      acc.fixed += fixed;
      acc.bonus += bonus;
      acc.comissao += comissao;
      acc.horaExtra += horaExtra;
      acc.adicionalNot += adicionalNot;
      acc.vr += vr;
      acc.vt += vt;
      acc.cesta += cesta;
      acc.ajudaCusto += ajudaCusto;
      acc.beneficios += (vr + vt + cesta + ajudaCusto);
      acc.incentivos += incentivos;
      acc.adiantamento += adiantamento;
      acc.decimo += decimo;
      acc.ferias += ferias;
      acc.rescisao += rescisao;
      acc.descontos += descontos;
      acc.fgts += fgts;
      acc.inss += inss;
      acc.irrf += irrf;
      acc.liquido += liquido;
      acc.realCost += realCost;
      return acc;
    }, {
      fixed: 0, bonus: 0, comissao: 0, horaExtra: 0, adicionalNot: 0,
      vr: 0, vt: 0, cesta: 0, ajudaCusto: 0, beneficios: 0, incentivos: 0,
      adiantamento: 0, decimo: 0, ferias: 0, rescisao: 0, descontos: 0,
      fgts: 0, inss: 0, irrf: 0, liquido: 0, realCost: 0
    });
  }, [effectiveCosts]);

  if (!isOpen) return null;

  const employeeName = profile.name || 'Contratado';
  const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '_');

  // FORMATADOR DATA PT-BR
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Helper para rótulo de remuneração
  const remLabel = getRemunerationLabel(profile.linkType || 'CLT');

  // Mapeador de logotipo da empresa do vínculo (disponíveis na pasta /Logos em public)
  const getCompanyLogoUrl = (company?: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const c = (company || '').toLowerCase();
    if (c.includes('dzm')) return origin + '/Logos/DZM.png';
    if (c.includes('grupo') || c.includes('g2')) return origin + '/Logos/Grupo%202.jpeg';
    if (c.includes('ybox')) return origin + '/Logos/Ybox.png';
    if (c.includes('conectius')) return origin + '/Logos/Conectius.png';
    if (c.includes('solucione')) return origin + '/Logos/Solucione.png';
    if (c.includes('brisinha')) return origin + '/Logos/BrisinhAI.jpeg';
    return origin + '/Logos/Mar-Brasil-sem-fundo-preto.png';
  };

  const photoUrl = profile.avatar || (profile as any).photo_url || (profile.metadata as any)?.photo_url || null;
  const companyLogoUrl = getCompanyLogoUrl(profile.company);

  // GERADOR CSV ESTRUTURADO (AUDITORIA OU FICHA COMPLETA)
  const handleExportCSV = () => {
    let csv = '';
    const sanitize = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
    const prevContrato = profile.remuneration_fixed || profile.remuneration || 0;
    const sortedCostsCSV = [...effectiveCosts].sort((a, b) => a.competencia.localeCompare(b.competencia));

    if (reportMode === 'audit') {
      csv += `"RELATÓRIO DE AUDITORIA DE FATURAMENTO E CUSTOS POR COMPETÊNCIA"\n`;
      csv += `"Contratado: ${sanitize(employeeName)}"\n`;
      csv += `"CPF / CNPJ: ${sanitize(profile.document_id || profile.pj_type || '-')}"\n`;
      csv += `"Empresa Contratante: ${sanitize(profile.company || 'MarBR')}"\n`;
      csv += `"Regime Contratual: ${sanitize(profile.linkType || 'CLT')}"\n`;
      csv += `"Escopo / Função: ${sanitize(profile.job_role || '-')}"\n`;
      csv += `"Valor Contratual Previsto: R$ ${prevContrato.toFixed(2).replace('.', ',')}"\n`;
      csv += `"Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}"\n\n`;

      csv += `Competência;Regime;Fonte / Origem da Informação;Valor Previsto Contrato;Valor Fixo Real;Bônus;Comissão;Horas Extras;Benefícios;FGTS;13º & Férias;Glosas / Descontos;Custo Real Desembolsado;Diferença (Real - Previsto);Status Auditoria;Observações\n`;

      sortedCostsCSV.forEach(c => {
        const isCLT = c.vinculo_tipo === 'CLT';
        const cReal = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
        const diff = cReal - prevContrato;
        const statusAuditoria = Math.abs(diff) < 0.01 ? 'Conciliado' : (diff > 0 ? 'Acima do Previsto (+)' : 'Abaixo do Previsto (-)');
        const origemLabel = formatCostOrigem(c.origem);
        const ben = (c.valor_vr || 0) + (c.valor_vt || 0) + (c.valor_cesta || 0) + (c.valor_ajuda_custo || 0);
        const decFer = (c.valor_decimo_terceiro || 0) + (c.valor_ferias || 0);

        csv += `${sanitize(c.competencia.slice(0, 7))};${sanitize(c.vinculo_tipo)};${sanitize(origemLabel)};${prevContrato.toFixed(2).replace('.', ',')};${(c.valor_fixo || 0).toFixed(2).replace('.', ',')};${(c.valor_bonus || 0).toFixed(2).replace('.', ',')};${(c.valor_comissao || 0).toFixed(2).replace('.', ',')};${(c.valor_hora_extra || 0).toFixed(2).replace('.', ',')};${ben.toFixed(2).replace('.', ',')};${(c.valor_fgts || 0).toFixed(2).replace('.', ',')};${decFer.toFixed(2).replace('.', ',')};${(c.valor_descontos || 0).toFixed(2).replace('.', ',')};${cReal.toFixed(2).replace('.', ',')};${diff.toFixed(2).replace('.', ',')};${sanitize(statusAuditoria)};${sanitize(c.observacao || '')}\n`;
      });

      if (costTotals) {
        const totalPrevisto = prevContrato * sortedCostsCSV.length;
        const diffTotal = costTotals.realCost - totalPrevisto;
        const statusTotal = Math.abs(diffTotal) < 0.01 ? 'Conciliado' : (diffTotal > 0 ? 'Acima do Previsto (+)' : 'Abaixo do Previsto (-)');
        csv += `TOTAL ACUMULADO (${sortedCostsCSV.length} COMPETÊNCIAS);-;TOTAL;${totalPrevisto.toFixed(2).replace('.', ',')};${costTotals.fixed.toFixed(2).replace('.', ',')};${costTotals.bonus.toFixed(2).replace('.', ',')};${costTotals.comissao.toFixed(2).replace('.', ',')};${costTotals.horaExtra.toFixed(2).replace('.', ',')};${costTotals.beneficios.toFixed(2).replace('.', ',')};${costTotals.fgts.toFixed(2).replace('.', ',')};${(costTotals.decimo + costTotals.ferias).toFixed(2).replace('.', ',')};${costTotals.descontos.toFixed(2).replace('.', ',')};${costTotals.realCost.toFixed(2).replace('.', ',')};${diffTotal.toFixed(2).replace('.', ',')};${sanitize(statusTotal)};-\n`;
      }

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Auditoria_Custos_${sanitizeFileName(employeeName)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onClose();
      return;
    }

    // Modo Ficha Completa
    csv += `"FICHA CADASTRAL DO CONTRATADO"\n`;
    csv += `"Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}"\n\n`;

    if (includePersonal) {
      csv += `"1. IDENTIFICAÇÃO E DADOS PESSOAIS"\n`;
      csv += `Campo;Valor\n`;
      csv += `Representante;${sanitize(profile.name)}\n`;
      csv += `CPF;${sanitize(profile.document_id)}\n`;
      csv += `RG;${sanitize(profile.document_rg)}\n`;
      csv += `Gênero;${sanitize(profile.gender)}\n`;
      csv += `Nível;${sanitize(profile.nivel)}\n`;
      csv += `Grau;${sanitize(profile.grau)}\n\n`;
    }

    if (includeContractual) {
      csv += `"2. DADOS CONTRATUAIS E EMPRESA"\n`;
      csv += `Campo;Valor\n`;
      csv += `Empresa;${sanitize(profile.company)}\n`;
      csv += `Regime Contratual;${sanitize(profile.linkType)}\n`;
      csv += `Escopo do Contrato;${sanitize(profile.job_role)}\n`;
      csv += `Setor / Departamento;${sanitize(profile.department)}\n`;
      csv += `Início Contrato;${sanitize(formatDate(profile.start_date))}\n`;
      csv += `Vencimento do Contrato;${sanitize(formatDate(profile.contract_expiry_date))}\n`;
      csv += `Status do Cadastro;${sanitize(profile.status || 'Ativo')}\n`;
      csv += `Razão Social (PJ);${sanitize(profile.corporate_name)}\n`;
      csv += `CNPJ (PJ);${sanitize(profile.pj_type)}\n`;
      csv += `Nome do Responsável;${sanitize(profile.responsible_name)}\n`;
      csv += `CPF do Responsável;${sanitize(profile.responsible_cpf)}\n\n`;

      if (isUnifiedExport && previousProfile) {
        csv += `"2.1. VÍNCULO CONTRATUAL ANTERIOR (CLT / ESTÁGIO)"\n`;
        csv += `Campo;Valor\n`;
        csv += `Regime Anterior;${sanitize(previousProfile.linkType || 'CLT')}\n`;
        csv += `Empresa Anterior;${sanitize(previousProfile.company || 'MarBR')}\n`;
        csv += `Cargo / Escopo Anterior;${sanitize(previousProfile.job_role)}\n`;
        csv += `Início Contrato Anterior;${sanitize(formatDate(previousProfile.start_date))}\n`;
        csv += `Rescisão Anterior;${sanitize(formatDate(previousProfile.resignation_date))}\n`;
        csv += `Tempo de Casa Anterior;${sanitize(formatCompanyTime(previousProfile.start_date, previousProfile.resignation_date))}\n\n`;

        csv += `"2.2. TEMPO DE CASA CONSOLIDADO"\n`;
        csv += `Campo;Valor\n`;
        csv += `Tempo no Vínculo Atual;${sanitize(formatCompanyTime(profile.start_date, profile.status === 'Inativo' ? (profile.resignation_date || profile.status_end_date) : undefined))}\n`;
        csv += `Tempo no Vínculo Anterior;${sanitize(formatCompanyTime(previousProfile.start_date, previousProfile.resignation_date))}\n`;
        csv += `TEMPO TOTAL CONSOLIDADO;${sanitize(calculateCombinedCompanyTime(previousProfile.start_date, previousProfile.resignation_date, profile.start_date, profile.status === 'Inativo' ? (profile.resignation_date || profile.status_end_date) : undefined))}\n\n`;
      }
    }

    if (includeAddressContact) {
      csv += `"3. ENDEREÇO E CONTATOS"\n`;
      csv += `Campo;Valor\n`;
      csv += `E-mail Pessoal;${sanitize(profile.email)}\n`;
      csv += `E-mail Profissional;${sanitize(profile.email_professional)}\n`;
      csv += `Telefone Pessoal;${sanitize(profile.phone)}\n`;
      csv += `Telefone Profissional;${sanitize(profile.phone_professional)}\n`;
      csv += `CEP Residencial;${sanitize(profile.zip_code)}\n`;
      csv += `Logradouro;${sanitize(profile.street)}\n`;
      csv += `Número;${sanitize(profile.number)}\n`;
      csv += `Bairro;${sanitize(profile.neighborhood)}\n`;
      csv += `Cidade;${sanitize(profile.city)}\n`;
      csv += `UF;${sanitize(profile.state)}\n\n`;
    }

    if (includeBanking) {
      csv += `"4. DADOS BANCÁRIOS E PAGAMENTO"\n`;
      csv += `Campo;Valor\n`;
      csv += `Chave PIX;${sanitize(profile.pix_key)}\n`;
      csv += `Plano de Comissão;${sanitize(profile.commission_plan)}\n\n`;
    }

    if (includeRemuneration) {
      const fixed = profile.remuneration_fixed || 0;
      const bonus = profile.remuneration_bonus || 0;
      const conn = profile.remuneration_connectivity || 0;
      const inc = profile.remuneration_incentives || 0;
      const comm = profile.remuneration_commission || 0;
      const totalCost = fixed + bonus + conn + inc + comm;

      csv += `"5. HONORÁRIOS E FICHA EXECUTIVA"\n`;
      csv += `Item;Valor (R$)\n`;
      csv += `${remLabel.bruto};${fixed.toFixed(2).replace('.', ',')}\n`;
      csv += `Bônus;${bonus.toFixed(2).replace('.', ',')}\n`;
      csv += `Comissão;${comm.toFixed(2).replace('.', ',')}\n`;
      csv += `Conectividade;${conn.toFixed(2).replace('.', ',')}\n`;
      csv += `Incentivos;${inc.toFixed(2).replace('.', ',')}\n`;
      csv += `TOTAL MENSAL ESTIMADO;${totalCost.toFixed(2).replace('.', ',')}\n\n`;
    }

    if (includeTrajectory && history.length > 0) {
      csv += `"6. TEMPO DE SERVIÇOS E HISTÓRICO DE ALTERAÇÕES"\n`;
      csv += `Data;Tipo de Evento;Valor Anterior;Novo Valor;Observações\n`;
      history.forEach(h => {
        const evType = (h.event_type === 'Cargo' || h.event_type?.toLowerCase().includes('função')) ? 'Escopo' : (h.event_type === 'Remuneração' ? 'Honorários' : h.event_type);
        const obs = (h.observations || '').replace(/\bCargo\b/g, 'Escopo').replace(/\bcargo\b/g, 'escopo').replace(/\bRemuneração\b/g, 'Honorários').replace(/\bremuneração\b/g, 'honorários');
        csv += `${sanitize(formatDate(h.change_date))};${sanitize(evType)};${sanitize(h.previous_value)};${sanitize(h.new_value)};${sanitize(obs)}\n`;
      });
      csv += `\n`;
    }

    if (includeCostsHistory && costs.length > 0) {
      const isCsvPJ = profile.linkType === 'PJ' || profile.linkType === 'MEI';
      csv += `"7. HISTÓRICO DE CUSTOS E FATURAMENTO POR COMPETÊNCIA"\n`;
      if (costTotals) {
        csv += `"TOTALIZADORES ACUMULADOS POR COMPETÊNCIA"\n`;
        csv += `Item / Valor;Total Acumulado (R$)\n`;
        csv += `${isCsvPJ ? 'Valor Contrato' : 'Valor Contrato (Fixo)'};${costTotals.fixed.toFixed(2).replace('.', ',')}\n`;
        csv += `Bônus;${costTotals.bonus.toFixed(2).replace('.', ',')}\n`;
        csv += `Comissão;${costTotals.comissao.toFixed(2).replace('.', ',')}\n`;
        if (!isCsvPJ) {
          csv += `Horas Extras;${costTotals.horaExtra.toFixed(2).replace('.', ',')}\n`;
          csv += `Benefícios (VR/VT/Cesta/Ajuda);${costTotals.beneficios.toFixed(2).replace('.', ',')}\n`;
          csv += `FGTS Empresa;${costTotals.fgts.toFixed(2).replace('.', ',')}\n`;
          csv += `13º Salário e Férias;${(costTotals.decimo + costTotals.ferias).toFixed(2).replace('.', ',')}\n`;
          csv += `Descontos Folha;${costTotals.descontos.toFixed(2).replace('.', ',')}\n`;
        }
        csv += `TOTAL DESEMBOLSADO;${costTotals.realCost.toFixed(2).replace('.', ',')}\n\n`;
      }
      csv += `DETALHAMENTO POR COMPETÊNCIA\n`;
      csv += `Competência;Regime;Fonte / Origem;${isCsvPJ ? 'Valor Contrato' : 'Valor Contrato (Fixo)'};Bônus;Comissão${!isCsvPJ ? ';FGTS' : ''};Custo Real Desembolsado\n`;
      sortedCostsCSV.forEach(c => {
        const isCLT = c.vinculo_tipo === 'CLT';
        const cReal = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
        const origemLabel = formatCostOrigem(c.origem);
        csv += `${sanitize(c.competencia.slice(0, 7))};${sanitize(c.vinculo_tipo)};${sanitize(origemLabel)};${(c.valor_fixo || 0).toFixed(2).replace('.', ',')};${(c.valor_bonus || 0).toFixed(2).replace('.', ',')};${(c.valor_comissao || 0).toFixed(2).replace('.', ',')}${!isCsvPJ ? ';' + (c.valor_fgts || 0).toFixed(2).replace('.', ',') : ''};${cReal.toFixed(2).replace('.', ',')}\n`;
      });
      csv += `\n`;
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ficha_${sanitizeFileName(employeeName)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onClose();
  };

  // GERADOR PDF VIA JANELA DE IMPRESSÃO ESTILIZADA
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para gerar o documento PDF.');
      return;
    }

    const isPJ = profile.linkType === 'PJ' || profile.linkType === 'MEI';
    const sortedCosts = [...effectiveCosts].sort((a, b) => a.competencia.localeCompare(b.competencia));
    const prevContrato = profile.remuneration_fixed || profile.remuneration || 0;

    // Se estiver no MODO AUDITORIA DEDICADO
    if (reportMode === 'audit') {
      const totalPrevisto = prevContrato * sortedCosts.length;
      const totalReal = costTotals ? costTotals.realCost : 0;
      const diffTotal = totalReal - totalPrevisto;
      const avgMonthlyCost = costTotals && sortedCosts.length > 0 ? costTotals.realCost / sortedCosts.length : 0;
      const maxCost = Math.max(...sortedCosts.map(c => (c.valor_liquido || 0) + (c.vinculo_tipo === 'CLT' ? (c.valor_adiantamento || 0) : 0)), 1);

      let auditHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Relatório de Auditoria — ${employeeName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 25px; line-height: 1.5; font-size: 11.5px; }
            .header { border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
            .badge-source { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; border: 1px solid transparent; }
            .badge-status { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: 800; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 9px; text-align: left; padding: 7px 5px; border-bottom: 2px solid #e2e8f0; }
            td { padding: 7px 5px; border-bottom: 1px solid #f1f5f9; color: #334155; }
            @media print { body { margin: 12px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center; gap: 14px;">
              ${photoUrl ? `<img src="${photoUrl}" style="width: 58px; height: 58px; border-radius: 50%; object-fit: cover; border: 2px solid #f59e0b;" />` : ''}
              <div>
                <span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; display: inline-block; margin-bottom: 3px;">
                  Auditoria de Faturamento &amp; Custos por Competência
                </span>
                <h1 style="font-size: 20px; margin: 0; color: #0f172a; font-weight: 800;">${employeeName}</h1>
                <p style="margin: 2px 0 0 0; color: #64748b; font-size: 11px; font-weight: 600;">
                  Escopo: <strong>${profile.job_role || 'Não especificado'}</strong> &nbsp;|&nbsp; Regime: <strong>${profile.linkType || 'CLT'}</strong> &nbsp;|&nbsp; Empresa: <strong>${profile.company || 'MarBR'}</strong>
                </p>
                ${profile.corporate_name ? `<p style="margin: 2px 0 0 0; color: #475569; font-size: 10px;">PJ: <strong>${profile.corporate_name}</strong> • CNPJ: <strong>${profile.pj_type || '-'}</strong></p>` : ''}
              </div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 4px;">
              ${companyLogoUrl ? `<img src="${companyLogoUrl}" style="max-height: 42px; max-width: 150px; object-fit: contain;" />` : ''}
              <p style="font-size: 9.5px; color: #94a3b8; margin: 0;">Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
          </div>

          <!-- Cards de Resumo Executivo da Auditoria -->
          <div style="margin-bottom: 16px; background: #fffdf5; border: 1.5px solid #fde68a; padding: 12px; border-radius: 8px;">
            <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #92400e; margin-bottom: 8px; border-bottom: 1px solid #fef3c7; padding-bottom: 4px; display: flex; justify-content: space-between;">
              <span>Painel de Conciliação e Auditoria Financeira</span>
              <span>${sortedCosts.length} Competência(s) Auditada(s)</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              <div style="background: #ffffff; padding: 8px 10px; border-radius: 6px; border-left: 3px solid #f59e0b;">
                <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block;">Previsto Mensal (Contrato)</span>
                <span style="font-size: 13px; font-weight: 800; color: #0f172a; display: block; margin-top: 2px;">${formatCurrency(prevContrato)}</span>
              </div>
              <div style="background: #ffffff; padding: 8px 10px; border-radius: 6px; border-left: 3px solid #10b981;">
                <span style="font-size: 9px; font-weight: 700; color: #047857; text-transform: uppercase; display: block;">Média Real Desembolsada</span>
                <span style="font-size: 13px; font-weight: 800; color: #047857; display: block; margin-top: 2px;">${formatCurrency(avgMonthlyCost)}</span>
              </div>
              <div style="background: #ffffff; padding: 8px 10px; border-radius: 6px; border-left: 3px solid #b45309;">
                <span style="font-size: 9px; font-weight: 700; color: #92400e; text-transform: uppercase; display: block;">Total Desembolsado</span>
                <span style="font-size: 13px; font-weight: 800; color: #b45309; display: block; margin-top: 2px;">${formatCurrency(totalReal)}</span>
              </div>
              <div style="background: ${Math.abs(diffTotal) < 0.01 ? '#ecfdf5' : (diffTotal > 0 ? '#fff1f2' : '#f0f9ff')}; padding: 8px 10px; border-radius: 6px; border-left: 3px solid ${Math.abs(diffTotal) < 0.01 ? '#10b981' : (diffTotal > 0 ? '#f43f5e' : '#0284c7')};">
                <span style="font-size: 9px; font-weight: 700; color: ${Math.abs(diffTotal) < 0.01 ? '#047857' : (diffTotal > 0 ? '#be123c' : '#0369a1')}; text-transform: uppercase; display: block;">Divergência Acumulada</span>
                <span style="font-size: 13px; font-weight: 800; color: ${Math.abs(diffTotal) < 0.01 ? '#047857' : (diffTotal > 0 ? '#be123c' : '#0369a1')}; display: block; margin-top: 2px;">
                  ${diffTotal > 0 ? '+' : ''}${formatCurrency(diffTotal)}
                </span>
              </div>
            </div>
          </div>

          ${includeCostsChart && sortedCosts.length > 0 ? `
            <!-- Gráfico SVG Vetorial de Evolução do Custo por Competência -->
            <div style="margin-top: 10px; margin-bottom: 14px; background: #ffffff; border: 1px solid #cbd5e1; padding: 10px; border-radius: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px; font-family: sans-serif;">
                Evolução do Custo Histórico por Competência (Rótulos de Valor R$)
              </div>
              ${(() => {
                const chartCosts = sortedCosts;
                const count = chartCosts.length;
                const svgW = Math.max(540, count * 22);
                const chartW = svgW - 50;
                const slotWidth = chartW / count;
                const barMaxH = 85;
                const baseY = 145;
                const svgH = 220;

                return `
                <svg width="100%" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="display: block; overflow: visible; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                  <line x1="30" y1="20" x2="${svgW}" y2="20" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="30" y1="60" x2="${svgW}" y2="60" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="30" y1="100" x2="${svgW}" y2="100" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="30" y1="${baseY}" x2="${svgW}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1.5" />
                  ${chartCosts.map((c, idx) => {
                    const barWidth = Math.max(3, Math.min(slotWidth * 0.65, 22));
                    const xCenter = 35 + idx * slotWidth + slotWidth / 2;
                    const xBar = xCenter - barWidth / 2;
                    const isCLT = c.vinculo_tipo === 'CLT';
                    const realCost = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                    const hasCost = realCost >= 0.01;
                    const barH = hasCost ? Math.max(6, Math.round((realCost / maxCost) * barMaxH)) : 2;
                    const yBar = baseY - barH;
                    const yValLabel = yBar - 5;
                    const compParts = c.competencia.split('-');
                    const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                    const mLabel = `${monthsShort[parseInt(compParts[1] || '1', 10) - 1]}/${(compParts[0] || '').slice(2)}`;
                    const valLabel = realCost >= 1000 ? `R$ ${(realCost / 1000).toFixed(1)}k` : `R$ ${realCost.toFixed(0)}`;
                    const fontSize = Math.min(8, Math.max(6, slotWidth * 0.45));
                    let elements = '';
                    if (hasCost) {
                      elements += `<text x="${xCenter}" y="${yValLabel}" text-anchor="start" font-size="${fontSize}" font-weight="800" fill="#047857" font-family="sans-serif" transform="rotate(-90 ${xCenter} ${yValLabel})">${valLabel}</text>`;
                      elements += `<rect x="${xBar}" y="${yBar}" width="${barWidth}" height="${barH}" rx="2" fill="#10b981" stroke="#059669" stroke-width="0.5" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;" />`;
                    } else {
                      elements += `<rect x="${xBar}" y="${baseY - 2}" width="${barWidth}" height="2" fill="#e2e8f0" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;" />`;
                    }
                    elements += `<text x="${xCenter}" y="${baseY + 8}" text-anchor="end" font-size="${fontSize}" font-weight="${hasCost ? '700' : '500'}" fill="${hasCost ? '#334155' : '#94a3b8'}" font-family="sans-serif" transform="rotate(-90 ${xCenter} ${baseY + 8})">${mLabel}</text>`;
                    return elements;
                  }).join('')}
                </svg>
                `;
              })()}
            </div>
          ` : ''}

          <!-- Tabela de Conciliação e Auditoria por Competência -->
          <table>
            <thead>
              <tr>
                <th>Competência</th>
                <th>Regime</th>
                <th>Fonte / Origem</th>
                <th>Previsto</th>
                <th>Fixo Real</th>
                <th>Bônus/Comissão</th>
                <th>Benef./Encargos</th>
                <th>Descontos</th>
                <th style="text-align: right;">Custo Real</th>
                <th style="text-align: right;">Diferença</th>
                <th style="text-align: center;">Status</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              ${sortedCosts.map(c => {
                const isCLT = c.vinculo_tipo === 'CLT';
                const cReal = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                const diff = cReal - prevContrato;
                const isMatch = Math.abs(diff) < 0.01;
                const badgeOrigem = getCostOrigemBadgeStyle(c.origem);
                const benEnc = (c.valor_vr || 0) + (c.valor_vt || 0) + (c.valor_cesta || 0) + (c.valor_ajuda_custo || 0) + (c.valor_fgts || 0);
                const varTotal = (c.valor_bonus || 0) + (c.valor_comissao || 0);
                return `
                <tr>
                  <td><strong>${c.competencia.slice(0, 7)}</strong></td>
                  <td>${c.vinculo_tipo}</td>
                  <td>
                    <span class="badge-source" style="background: ${badgeOrigem.bg}; color: ${badgeOrigem.color}; border-color: ${badgeOrigem.border};">
                      ${formatCostOrigem(c.origem)}
                    </span>
                  </td>
                  <td>${formatCurrency(prevContrato)}</td>
                  <td>${formatCurrency(c.valor_fixo || 0)}</td>
                  <td>${formatCurrency(varTotal)}</td>
                  <td>${formatCurrency(benEnc)}</td>
                  <td>${formatCurrency(c.valor_descontos || 0)}</td>
                  <td style="text-align: right; font-weight: 700; color: #b45309;">${formatCurrency(cReal)}</td>
                  <td style="text-align: right; font-weight: 700; color: ${isMatch ? '#047857' : (diff > 0 ? '#b91c1c' : '#0369a1')};">
                    ${diff > 0 ? '+' : ''}${formatCurrency(diff)}
                  </td>
                  <td style="text-align: center;">
                    <span class="badge-status" style="background: ${isMatch ? '#ecfdf5' : (diff > 0 ? '#fff1f2' : '#f0f9ff')}; color: ${isMatch ? '#047857' : (diff > 0 ? '#be123c' : '#0369a1')}; border: 1px solid ${isMatch ? '#a7f3d0' : (diff > 0 ? '#fecdd3' : '#bae6fd')};">
                      ${isMatch ? 'Conciliado' : (diff > 0 ? 'Acima (+)' : 'Abaixo (-)')}
                    </span>
                  </td>
                  <td style="font-size: 10px; color: #64748b;">${c.observacao || '-'}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
            ${costTotals ? `
              <tfoot>
                <tr style="background: #fffbeb; font-weight: 800; color: #92400e; border-top: 2px solid #fde68a;">
                  <td colspan="3">TOTAL ACUMULADO (${sortedCosts.length} COMPETÊNCIAS)</td>
                  <td>${formatCurrency(totalPrevisto)}</td>
                  <td>${formatCurrency(costTotals.fixed)}</td>
                  <td>${formatCurrency(costTotals.bonus + costTotals.comissao)}</td>
                  <td>${formatCurrency(costTotals.beneficios + costTotals.fgts)}</td>
                  <td>${formatCurrency(costTotals.descontos)}</td>
                  <td style="text-align: right; font-size: 12px; color: #b45309;">${formatCurrency(costTotals.realCost)}</td>
                  <td style="text-align: right; font-size: 12px; color: ${Math.abs(diffTotal) < 0.01 ? '#047857' : (diffTotal > 0 ? '#be123c' : '#0369a1')};">
                    ${diffTotal > 0 ? '+' : ''}${formatCurrency(diffTotal)}
                  </td>
                  <td style="text-align: center;">${Math.abs(diffTotal) < 0.01 ? '100% OK' : 'Divergente'}</td>
                  <td>-</td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(auditHtml);
      printWindow.document.close();
      onClose();
      return;
    }

    // Modo Ficha Completa
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ficha Cadastral — ${employeeName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 30px; line-height: 1.5; font-size: 13px; }
          .header { border-bottom: 2px solid #f59e0b; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
          .header h1 { font-size: 22px; margin: 0; color: #0f172a; font-weight: 800; }
          .header p { margin: 4px 0 0 0; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          .section { margin-bottom: 25px; page-break-inside: avoid; }
          .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #b45309; background: #fffbeb; padding: 6px 10px; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 12px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px 24px; }
          .field { display: flex; flex-direction: column; }
          .field-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
          .field-value { font-size: 13px; font-weight: 600; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; }
          td { padding: 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
          @media print {
            body { margin: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center; gap: 15px;">
            ${photoUrl ? `<img src="${photoUrl}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2.5px solid #f59e0b; box-shadow: 0 2px 6px rgba(0,0,0,0.15);" />` : ''}
            <div>
              <h1 style="font-size: 22px; margin: 0; color: #0f172a; font-weight: 800;">${employeeName}</h1>
              <p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                ${isPJ ? 'Ficha do Prestador de Serviços (PJ)' : 'Ficha Cadastral Executiva'} • ${profile.job_role || (isPJ ? 'Escopo Especializado' : 'Função não informada')}
              </p>
              ${isUnifiedExport && previousProfile ? `<div style="margin-top: 4px;"><span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 9999px; font-size: 9px; font-weight: 800; text-transform: uppercase;">✦ Histórico Unificado (${previousProfile.linkType || 'CLT'} + ${profile.linkType || 'PJ'})</span></div>` : ''}
              <p style="margin: 2px 0 0 0; color: #334155; font-size: 11px; font-weight: 600;">
                Empresa Contratante: <strong style="color: #b45309;">${profile.company || 'MarBR'}</strong> &nbsp;|&nbsp; Regime: <strong>${profile.linkType || 'CLT'}</strong>
              </p>
            </div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 6px;">
            ${companyLogoUrl ? `<img src="${companyLogoUrl}" style="max-height: 48px; max-width: 170px; object-fit: contain;" />` : ''}
            <p style="font-size: 10px; color: #94a3b8; margin: 0;">Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
    `;

    // 1. IDENTIFICAÇÃO E PESSOAIS
    if (includePersonal) {
      html += `
        <div class="section">
          <div class="section-title">${isPJ ? '1. Identificação da Empresa e Representante Legal' : '1. Identificação e Dados Pessoais'}</div>
          <div class="grid">
            <div class="field"><span class="field-label">${isPJ ? 'Nome do Representante / Prestador' : 'Representante'}</span><span class="field-value">${profile.name || '-'}</span></div>
            <div class="field"><span class="field-label">CPF</span><span class="field-value">${profile.document_id || '-'}</span></div>
            <div class="field"><span class="field-label">RG</span><span class="field-value">${profile.document_rg || '-'}</span></div>
            ${isPJ ? `
              <div class="field"><span class="field-label">Razão Social (PJ)</span><span class="field-value">${profile.corporate_name || '-'}</span></div>
              <div class="field"><span class="field-label">CNPJ (PJ)</span><span class="field-value">${profile.pj_type || '-'}</span></div>
            ` : `
              <div class="field"><span class="field-label">Gênero</span><span class="field-value">${profile.gender || '-'}</span></div>
            `}
            <div class="field"><span class="field-label">Nível</span><span class="field-value">${profile.nivel || '-'}</span></div>
            <div class="field"><span class="field-label">Grau</span><span class="field-value">${profile.grau || '-'}</span></div>
          </div>
        </div>
      `;
    }

    // 2. CONTRATUAIS E EMPRESA
    if (includeContractual) {
      html += `
        <div class="section">
          <div class="section-title">${isPJ ? '2. Dados do Contrato e Prestação de Serviços' : '2. Dados Contratuais e Empresa'}</div>
          <div class="grid">
            <div class="field"><span class="field-label">Empresa Contratante</span><span class="field-value">${profile.company || '-'}</span></div>
            <div class="field"><span class="field-label">Regime Contratual</span><span class="field-value">${profile.linkType || '-'}</span></div>
            <div class="field"><span class="field-label">${isPJ ? 'Escopo / Objeto do Serviço' : 'Escopo do Contrato'}</span><span class="field-value">${profile.job_role || '-'}</span></div>
            <div class="field"><span class="field-label">${isPJ ? 'Área Atendida / Unidade' : 'Setor / Departamento'}</span><span class="field-value">${profile.department || '-'}</span></div>
            <div class="field"><span class="field-label">${isPJ ? 'Início da Vigência / Prestação' : 'Início Contrato'}</span><span class="field-value">${formatDate(profile.start_date)}</span></div>
            <div class="field"><span class="field-label">${isPJ ? 'Vencimento / Término da Vigência' : 'Vencimento do Contrato'}</span><span class="field-value">${formatDate(profile.contract_expiry_date)}</span></div>
            ${profile.resignation_date ? `<div class="field"><span class="field-label">${isPJ ? 'Data do Distrato / Rescisão' : 'Data de Encerramento / Rescisão'}</span><span class="field-value">${formatDate(profile.resignation_date)}</span></div>` : ''}
            <div class="field"><span class="field-label">Status do Cadastro</span><span class="field-value">${profile.status || 'Ativo'}</span></div>
            ${profile.corporate_name && !isPJ ? `<div class="field"><span class="field-label">Razão Social (PJ)</span><span class="field-value">${profile.corporate_name}</span></div>` : ''}
            ${profile.pj_type && !isPJ ? `<div class="field"><span class="field-label">CNPJ (PJ)</span><span class="field-value">${profile.pj_type}</span></div>` : ''}
          </div>
          ${isUnifiedExport && previousProfile ? `<div style="margin-top: 14px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;"><div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px;">Quadro de Vínculos Contratuais e Tempo de Casa Consolidado</div><div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 11px;"><div style="background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #cbd5e1;"><strong style="color: #64748b; font-size: 10px; text-transform: uppercase; display: block;">1º Vínculo (Anterior - ${previousProfile.linkType || "CLT"})</strong><div style="font-weight: 700; margin-top: 2px;">${previousProfile.job_role || "Estagiário de RH"} • ${previousProfile.company || "MarBR"}</div><div style="color: #475569; margin-top: 2px;">Vigência: ${formatDate(previousProfile.start_date)} a ${formatDate(previousProfile.resignation_date || "Rescisão")}</div><div style="font-weight: 700; color: #334155; margin-top: 2px;">Tempo no Vínculo: ${formatCompanyTime(previousProfile.start_date, previousProfile.resignation_date)}</div></div><div style="background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #a7f3d0;"><strong style="color: #047857; font-size: 10px; text-transform: uppercase; display: block;">2º Vínculo (Vigente - ${profile.linkType || "PJ"})</strong><div style="font-weight: 700; margin-top: 2px;">${profile.job_role || "Terceirizado..."} • ${profile.company || "MarBR"}</div><div style="color: #475569; margin-top: 2px;">Início: ${formatDate(profile.start_date)}</div><div style="font-weight: 700; color: #047857; margin-top: 2px;">Tempo no Vínculo: ${formatCompanyTime(profile.start_date, profile.status === "Inativo" ? (profile.resignation_date || profile.status_end_date) : undefined)}</div></div></div><div style="margin-top: 10px; padding: 8px 12px; background: #ecfdf5; border-radius: 6px; border-left: 3px solid #10b981; display: flex; justify-content: space-between; align-items: center;"><span style="font-size: 11px; font-weight: 800; color: #065f46; text-transform: uppercase;">TEMPO TOTAL DE CASA ACUMULADO (AMBOS OS REGIMES):</span><span style="font-size: 12px; font-weight: 800; color: #047857;">${calculateCombinedCompanyTime(previousProfile.start_date, previousProfile.resignation_date, profile.start_date, profile.status === "Inativo" ? (profile.resignation_date || profile.status_end_date) : undefined)}</span></div></div>` : ''}
        </div>
      `;
    }

    // 3. ENDEREÇO E CONTATOS
    if (includeAddressContact) {
      html += `
        <div class="section">
          <div class="section-title">3. Endereço e Contatos</div>
          <div class="grid">
            <div class="field"><span class="field-label">E-mail Pessoal</span><span class="field-value">${profile.email || '-'}</span></div>
            <div class="field"><span class="field-label">E-mail Profissional</span><span class="field-value">${profile.email_professional || '-'}</span></div>
            <div class="field"><span class="field-label">Telefone Pessoal</span><span class="field-value">${profile.phone || '-'}</span></div>
            <div class="field"><span class="field-label">Telefone Profissional</span><span class="field-value">${profile.phone_professional || '-'}</span></div>
            <div class="field"><span class="field-label">CEP Residencial</span><span class="field-value">${profile.zip_code || '-'}</span></div>
            <div class="field"><span class="field-label">Endereço Completo</span><span class="field-value">${profile.street || ''} ${profile.number ? ', ' + profile.number : ''} ${profile.neighborhood ? ' - ' + profile.neighborhood : ''} ${profile.city ? ' - ' + profile.city + '/' + (profile.state || '') : ''}</span></div>
          </div>
        </div>
      `;
    }

    // 4. DADOS BANCÁRIOS
    if (includeBanking) {
      html += `
        <div class="section">
          <div class="section-title">4. Dados Bancários e Pagamento</div>
          <div class="grid">
            <div class="field"><span class="field-label">Chave PIX</span><span class="field-value">${profile.pix_key || '-'}</span></div>
            <div class="field"><span class="field-label">Plano de Comissão</span><span class="field-value">${profile.commission_plan || 'Padrão'}</span></div>
          </div>
        </div>
      `;
    }

    // 5. REMUNERAÇÃO E FICHA EXECUTIVA
    if (includeRemuneration) {
      const fixed = profile.remuneration_fixed || 0;
      const bonus = profile.remuneration_bonus || 0;
      const conn = profile.remuneration_connectivity || 0;
      const inc = profile.remuneration_incentives || 0;
      const comm = profile.remuneration_commission || 0;
      const totalCost = fixed + bonus + conn + inc + comm;

      html += `
        <div class="section">
          <div class="section-title">5. Remuneração e Ficha Executiva</div>
          <table>
            <thead>
              <tr><th>Item</th><th style="text-align: right;">Valor Mensal (R$)</th></tr>
            </thead>
            <tbody>
              <tr><td>${remLabel.bruto}</td><td style="text-align: right; font-weight: 600;">${formatCurrency(fixed)}</td></tr>
              <tr><td>Bônus</td><td style="text-align: right; font-weight: 600;">${formatCurrency(bonus)}</td></tr>
              <tr><td>Comissão</td><td style="text-align: right; font-weight: 600;">${formatCurrency(comm)}</td></tr>
              <tr><td>Conectividade</td><td style="text-align: right; font-weight: 600;">${formatCurrency(conn)}</td></tr>
              <tr><td>Incentivos</td><td style="text-align: right; font-weight: 600;">${formatCurrency(inc)}</td></tr>
              <tr style="background: #fffbeb; font-weight: 800; color: #92400e;"><td>CUSTO TOTAL</td><td style="text-align: right; color: #b45309; font-size: 14px;">${formatCurrency(totalCost)}</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // 6. TEMPO DE SERVIÇOS E HISTÓRICO
    if (includeTrajectory && history.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">6. Tempo de Serviços e Histórico de Alterações</div>
          <table>
            <thead>
              <tr><th>Data</th><th>Evento</th><th>Anterior</th><th>Novo Valor</th><th>Observações</th></tr>
            </thead>
            <tbody>
              ${history.map(h => {
                const evType = (h.event_type === 'Cargo' || h.event_type?.toLowerCase().includes('função')) ? 'Escopo' : (h.event_type === 'Remuneração' ? 'Honorários' : h.event_type);
                const obs = (h.observations || '').replace(/\bCargo\b/g, 'Escopo').replace(/\bcargo\b/g, 'escopo').replace(/\bRemuneração\b/g, 'Honorários').replace(/\bremuneração\b/g, 'honorários');
                return `
                <tr>
                  <td>${formatDate(h.change_date)}</td>
                  <td><strong>${evType}</strong></td>
                  <td>${h.previous_value || '-'}</td>
                  <td>${h.new_value || '-'}</td>
                  <td>${obs || '-'}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // 7. HISTÓRICO DE CUSTOS POR COMPETÊNCIA E TOTALIZADORES
    if (includeCostsHistory && costs.length > 0) {
      const avgMonthlyCost = costTotals && costs.length > 0 ? costTotals.realCost / costs.length : 0;
      const maxCost = Math.max(...sortedCosts.map(c => (c.valor_liquido || 0) + (c.vinculo_tipo === 'CLT' ? (c.valor_adiantamento || 0) : 0)), 1);
      const effectiveLoan = loanSummary || (profile.totalTaken || (profile as any).loan_amount ? {
        totalTaken: profile.totalTaken || (profile as any).loan_amount || 0,
        totalReceived: profile.totalReceived || 0,
        balance: profile.balance || 0
      } : null);

      html += `
        <div class="section">
          <div class="section-title">7. Histórico de Custos por Competência, Gráfico e Totalizadores</div>
          
          ${costTotals ? `
            <!-- Quadro de Totalizadores por Valores Recebidos -->
            <div style="margin-bottom: 18px; background: #fffdf5; border: 1.5px solid #fef3c7; padding: 14px; border-radius: 8px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e; margin-bottom: 10px; border-bottom: 1px solid #fde68a; padding-bottom: 4px;">
                Totalizadores Acumulados de Valores ${isPJ ? 'Contratuais' : 'Recebidos'} por Competência
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label">${isPJ ? 'Total Valor Contrato' : 'Total Valor Contrato (Fixo)'}</span>
                  <span class="field-value">${formatCurrency(costTotals.fixed)}</span>
                </div>
                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label">Total Bônus</span>
                  <span class="field-value">${formatCurrency(costTotals.bonus)}</span>
                </div>
                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label">Total Comissões</span>
                  <span class="field-value">${formatCurrency(costTotals.comissao)}</span>
                </div>
                ${!isPJ ? `
                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label">Total Horas Extras</span>
                  <span class="field-value">${formatCurrency(costTotals.horaExtra)}</span>
                </div>
                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label">Total Benefícios (VR/VT/Cesta)</span>
                  <span class="field-value">${formatCurrency(costTotals.beneficios)}</span>
                </div>
                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label">Total FGTS Empresa</span>
                  <span class="field-value">${formatCurrency(costTotals.fgts)}</span>
                </div>
                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label">Total 13º &amp; Férias</span>
                  <span class="field-value">${formatCurrency(costTotals.decimo + costTotals.ferias)}</span>
                </div>` : ''}
                <div style="background: #ecfdf5; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #10b981; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label" style="color: #047857;">Média por Competência Desembolsada</span>
                  <span class="field-value" style="color: #047857; font-weight: 800;">${formatCurrency(avgMonthlyCost)}</span>
                </div>
                <div style="background: #fef3c7; padding: 8px 12px; border-radius: 6px; border-left: 4px solid #b45309; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <span class="field-label" style="color: #92400e; font-weight: 800;">TOTAL ACUMULADO DESEMBOLSADO</span>
                  <span class="field-value" style="color: #b45309; font-size: 14px; font-weight: 800;">${formatCurrency(costTotals.realCost)}</span>
                </div>
              </div>
            </div>

            <!-- Resumo do Empréstimo Corporativo (Posição Financeira) -->
            ${effectiveLoan && (effectiveLoan.totalTaken > 0 || effectiveLoan.balance > 0 || effectiveLoan.totalReceived > 0) ? `
              <div style="margin-top: 14px; margin-bottom: 16px; background: #0f172a; border: 1px solid #1e293b; padding: 14px; border-radius: 8px; color: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #fbbf24; margin-bottom: 10px; font-family: sans-serif; letter-spacing: 0.5px;">
                  Resumo do Empréstimo Corporativo (Posição Financeira)
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                  <div style="background: #1e293b; padding: 10px 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
                    <span style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; font-family: sans-serif;">Total Tomado</span>
                    <span style="font-size: 13px; font-weight: 800; color: #fef08a; display: block; margin-top: 3px; font-family: sans-serif;">${formatCurrency(effectiveLoan.totalTaken)}</span>
                  </div>
                  <div style="background: #1e293b; padding: 10px 12px; border-radius: 6px; border-left: 4px solid #10b981;">
                    <span style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; font-family: sans-serif;">Total Pago</span>
                    <span style="font-size: 13px; font-weight: 800; color: #6ee7b7; display: block; margin-top: 3px; font-family: sans-serif;">${formatCurrency(effectiveLoan.totalReceived)}</span>
                  </div>
                  <div style="background: #1e293b; padding: 10px 12px; border-radius: 6px; border-left: 4px solid #f43f5e;">
                    <span style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; font-family: sans-serif;">Saldo Devedor</span>
                    <span style="font-size: 13px; font-weight: 800; color: #fda4af; display: block; margin-top: 3px; font-family: sans-serif;">${formatCurrency(effectiveLoan.balance)}</span>
                  </div>
                </div>
              </div>
            ` : ''}
          ` : ''}

          ${includeCostsChart ? `
            <!-- Gráfico SVG Vetorial de Custo por Competência -->
            <div style="margin-top: 15px; margin-bottom: 16px; background: #ffffff; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 12px; font-family: sans-serif;">
                Gráfico de Evolução do Custo Histórico por Competência (Valores e Competências em Orientação Vertical)
              </div>
              
              ${(() => {
                const chartCosts = sortedCosts;
                const count = chartCosts.length;
                const svgW = Math.max(560, count * 22);
                const chartW = svgW - 50;
                const slotWidth = chartW / count;
                const barMaxH = 95;
                const baseY = 160;
                const svgH = 240;

                return `
                <svg width="100%" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="display: block; overflow: visible; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                  <line x1="35" y1="25" x2="${svgW}" y2="25" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="35" y1="70" x2="${svgW}" y2="70" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="35" y1="115" x2="${svgW}" y2="115" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="35" y1="${baseY}" x2="${svgW}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1.5" />

                  ${chartCosts.map((c, idx) => {
                    const barWidth = Math.max(3, Math.min(slotWidth * 0.65, 24));
                    const xCenter = 40 + idx * slotWidth + slotWidth / 2;
                    const xBar = xCenter - barWidth / 2;

                    const isCLT = c.vinculo_tipo === 'CLT';
                    const realCost = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                    const hasCost = realCost >= 0.01;
                    const barH = hasCost ? Math.max(6, Math.round((realCost / maxCost) * barMaxH)) : 2;
                    const yBar = baseY - barH;
                    const yValLabel = yBar - 6;

                    const compParts = c.competencia.split('-');
                    const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                    const mLabel = `${monthsShort[parseInt(compParts[1] || '1', 10) - 1]}/${(compParts[0] || '').slice(2)}`;
                    const valLabel = realCost >= 1000 ? `R$ ${(realCost / 1000).toFixed(1)}k` : `R$ ${realCost.toFixed(0)}`;
                    const fontSize = Math.min(8.5, Math.max(6.5, slotWidth * 0.48));

                    let elements = '';
                    if (hasCost) {
                      elements += `<text x="${xCenter}" y="${yValLabel}" text-anchor="start" font-size="${fontSize}" font-weight="800" fill="#047857" font-family="sans-serif" transform="rotate(-90 ${xCenter} ${yValLabel})">${valLabel}</text>`;
                      elements += `<rect x="${xBar}" y="${yBar}" width="${barWidth}" height="${barH}" rx="2" fill="#10b981" stroke="#059669" stroke-width="0.5" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;" />`;
                    } else {
                      elements += `<rect x="${xBar}" y="${baseY - 2}" width="${barWidth}" height="2" fill="#e2e8f0" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;" />`;
                    }
                    elements += `<text x="${xCenter}" y="${baseY + 8}" text-anchor="end" font-size="${fontSize}" font-weight="${hasCost ? '700' : '500'}" fill="${hasCost ? '#334155' : '#94a3b8'}" font-family="sans-serif" transform="rotate(-90 ${xCenter} ${baseY + 8})">${mLabel}</text>`;

                    return elements;
                  }).join('')}
                </svg>
                `;
              })()}
            </div>
          ` : ''}

          <!-- Tabela Detalhada por Competência -->
          <table>
            <thead>
              <tr>
                <th>Competência</th>
                <th>Regime</th>
                <th>Fonte / Origem</th>
                <th>Valor Contrato</th>
                <th>Bônus</th>
                <th>Comissão</th>
                ${!isPJ ? '<th>FGTS</th>' : ''}
                <th style="text-align: right;">Custo Real Desembolsado</th>
              </tr>
            </thead>
            <tbody>
              ${sortedCosts.map(c => {
                const isCLT = c.vinculo_tipo === 'CLT';
                const cReal = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                const badgeOrigem = getCostOrigemBadgeStyle(c.origem);
                return `
                <tr>
                  <td><strong>${c.competencia.slice(0, 7)}</strong></td>
                  <td>${c.vinculo_tipo}</td>
                  <td>
                    <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; background: ${badgeOrigem.bg}; color: ${badgeOrigem.color}; border: 1px solid ${badgeOrigem.border};">
                      ${formatCostOrigem(c.origem)}
                    </span>
                  </td>
                  <td>${formatCurrency(c.valor_fixo || 0)}</td>
                  <td>${formatCurrency(c.valor_bonus || 0)}</td>
                  <td>${formatCurrency(c.valor_comissao || 0)}</td>
                  ${!isPJ ? '<td>' + formatCurrency(c.valor_fgts || 0) + '</td>' : ''}
                  <td style="text-align: right; font-weight: 700; color: #b45309;">${formatCurrency(cReal)}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
            ${costTotals ? `
              <tfoot>
                <tr style="background: #fffbeb; font-weight: 800; color: #92400e; border-top: 2px solid #fde68a;">
                  <td colspan="3">TOTAL ACUMULADO (${sortedCosts.length} COMPETÊNCIAS)</td>
                  <td>${formatCurrency(costTotals.fixed)}</td>
                  <td>${formatCurrency(costTotals.bonus)}</td>
                  <td>${formatCurrency(costTotals.comissao)}</td>
                  ${!isPJ ? '<td>' + formatCurrency(costTotals.fgts) + '</td>' : ''}
                  <td style="text-align: right; font-size: 13px; color: #b45309;">${formatCurrency(costTotals.realCost)}</td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
      `;
    }

    html += `
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header do Modal */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-600 shadow-xs">
              {reportMode === 'audit' ? <Calculator size={20} /> : <Download size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {reportMode === 'audit' ? 'Relatório de Auditoria de Faturamento & Custos' : 'Exportar Ficha do Contratado'}
                </h2>
                {reportMode === 'audit' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                    Auditoria
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {reportMode === 'audit'
                  ? `${employeeName} • Auditoria por competência e batimento com fontes originais`
                  : `${employeeName} • Escolha quais seções deseja incluir no documento`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Alternador de Modo do Relatório */}
        <div className="px-6 pt-3.5 pb-2 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setReportMode('audit');
              setIncludePersonal(false);
              setIncludeContractual(false);
              setIncludeAddressContact(false);
              setIncludeBanking(false);
              setIncludeRemuneration(false);
              setIncludeTrajectory(false);
              setIncludeCostsHistory(true);
              setIncludeCostsChart(true);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              reportMode === 'audit'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calculator size={15} />
            <span>Auditoria de Faturamento &amp; Custos</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setReportMode('full');
              setIncludePersonal(true);
              setIncludeContractual(true);
              setIncludeAddressContact(true);
              setIncludeBanking(true);
              setIncludeRemuneration(true);
              setIncludeTrajectory(true);
              setIncludeCostsHistory(true);
              setIncludeCostsChart(true);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              reportMode === 'full'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText size={15} />
            <span>Ficha Cadastral Completa</span>
          </button>
        </div>

        {/* Seleção de Formato */}
        <div className="px-6 pt-4 pb-3 bg-slate-50/50 border-b border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Formato de Exportação
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setExportFormat('pdf')}
              className={`p-3 rounded-2xl border flex items-center justify-center gap-2.5 transition-all text-xs font-bold ${
                exportFormat === 'pdf'
                  ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Printer size={16} />
              Documento PDF (Formatado)
            </button>
            <button
              onClick={() => setExportFormat('csv')}
              className={`p-3 rounded-2xl border flex items-center justify-center gap-2.5 transition-all text-xs font-bold ${
                exportFormat === 'csv'
                  ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet size={16} />
              Planilha Excel / CSV
            </button>
          </div>
        </div>

        {/* Conteúdo Central */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          
          {/* BANNER DO MODO AUDITORIA */}
          {reportMode === 'audit' && (
            <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 mt-0.5">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Relatório de Auditoria por Competência Ativo
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    Exporta a conciliação completa de todas as competências lançadas ({effectiveCosts.length}), permitindo auditar o valor previsto em contrato contra o custo real desembolsado e rastrear cada lançamento com sua fonte original (Planilha Dianna, Lançamento Manual, Folha CLT, Holerites OCR).
                  </p>
                </div>
              </div>

              {/* Sugestão de Auditoria em Lote se disponível */}
              {onOpenBatchAudit && (
                <div className="p-3 bg-white border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-700">
                    <span className="font-bold text-slate-900 block">Precisa auditar múltiplos colaboradores?</span>
                    Gere o relatório consolidado para toda a equipe ou por empresa/setor.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBatchAudit();
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                  >
                    <Users size={14} className="text-amber-400" />
                    Auditoria em Lote
                  </button>
                </div>
              )}
            </div>
          )}

          {/* BANNER INTERATIVO DE UNIFICAÇÃO DE VÍNCULOS (CLT + PJ) */}
          {previousProfile && (
            <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 border border-emerald-300 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 mt-0.5">
                    <LinkIcon size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">
                        Unificar com Vínculo Anterior ({previousProfile.linkType || 'CLT'})
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-200/80 text-emerald-900">
                        {previousProfile.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                      {isUnifiedExport
                        ? '✦ Ficha Unificada: consolida tempo total de casa, histórico e custos acumulados nos dois regimes (CLT + PJ).'
                        : '📄 Ficha Isolada: exporta estritamente os dados contratuais e custos da vigência atual (' + (profile.linkType || 'PJ') + ').'}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isUnifiedExport}
                    onChange={e => setIsUnifiedExport(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* Seletor de Seções (apenas no modo completo ou simplificado no modo auditoria) */}
          {reportMode === 'full' ? (
            <>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Selecione as Seções da Ficha para Incluir</span>
                <span className="text-[10px] text-slate-400 font-normal">Marque/desmarque o que deseja exportar</span>
              </label>

              <div className="grid grid-cols-1 gap-2.5">
                
                {/* 1. Identificação & Dados Pessoais */}
                <div
                  onClick={() => setIncludePersonal(!includePersonal)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    includePersonal ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={includePersonal ? 'text-amber-600' : 'text-slate-400'}>
                    {includePersonal ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={15} className="text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">1. Identificação e Dados Pessoais</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">CPF, RG, Gênero, Nível, Grau</span>
                </div>

                {/* 2. Dados Contratuais e Empresa */}
                <div
                  onClick={() => setIncludeContractual(!includeContractual)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    includeContractual ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={includeContractual ? 'text-amber-600' : 'text-slate-400'}>
                    {includeContractual ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">2. Dados Contratuais e Empresa</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">Escopo, Setor, Empresa, Regime, Início Contrato</span>
                </div>

                {/* 3. Endereço e Contatos */}
                <div
                  onClick={() => setIncludeAddressContact(!includeAddressContact)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    includeAddressContact ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={includeAddressContact ? 'text-amber-600' : 'text-slate-400'}>
                    {includeAddressContact ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">3. Endereço e Contatos</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">CEP, Logradouro, Telefones, E-mails</span>
                </div>

                {/* 4. Dados Bancários */}
                <div
                  onClick={() => setIncludeBanking(!includeBanking)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    includeBanking ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={includeBanking ? 'text-amber-600' : 'text-slate-400'}>
                    {includeBanking ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard size={15} className="text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">4. Dados Bancários e Pagamento</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">Chave PIX, Plano de Comissão</span>
                </div>

                {/* 5. Remuneração e Ficha Executiva */}
                <div
                  onClick={() => setIncludeRemuneration(!includeRemuneration)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    includeRemuneration ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={includeRemuneration ? 'text-amber-600' : 'text-slate-400'}>
                    {includeRemuneration ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={15} className="text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">5. Honorários e Ficha Executiva</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">Fixo, Bônus, Comissão, Conectividade, Custo Total</span>
                </div>

                {/* 6. Trajetória e Histórico */}
                <div
                  onClick={() => setIncludeTrajectory(!includeTrajectory)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    includeTrajectory ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="mt-0.5" style={{ color: includeTrajectory ? '#d97706' : '#94a3b8' }}>
                    {includeTrajectory ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <History size={15} className="text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">6. Tempo de Serviços e Histórico de Alterações</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">{history.length} registro(s)</span>
                </div>

                {/* 7. Histórico de Custos por Competência */}
                <div
                  onClick={() => setIncludeCostsHistory(!includeCostsHistory)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    includeCostsHistory ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={includeCostsHistory ? 'text-amber-600' : 'text-slate-400'}>
                    {includeCostsHistory ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calculator size={15} className="text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">7. Histórico de Custos por Competência</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">{effectiveCosts.length} competência(s)</span>
                </div>

                {/* 8. Gráfico de Custos por Competência */}
                <div
                  onClick={() => setIncludeCostsChart(!includeCostsChart)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    includeCostsChart ? 'bg-emerald-50/50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={includeCostsChart ? 'text-emerald-600' : 'text-slate-400'}>
                    {includeCostsChart ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calculator size={15} className="text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">8. Gráfico de Custos por Competência (com Rótulos R$)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto font-medium">Gráfico de barras em PDF</span>
                </div>

              </div>
            </>
          ) : (
            /* Modo Auditoria: Seções Específicas de Auditoria */
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Módulos de Auditoria Selecionados
              </label>
              
              <div
                onClick={() => setIncludeCostsHistory(!includeCostsHistory)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                  includeCostsHistory ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={includeCostsHistory ? 'text-amber-600' : 'text-slate-400'}>
                  {includeCostsHistory ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <div className="flex items-center gap-2">
                  <Calculator size={15} className="text-amber-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Histórico de Faturamento e Custos por Competência com Fontes
                  </span>
                </div>
                <span className="text-[10px] text-amber-700 font-bold ml-auto">{effectiveCosts.length} competência(s)</span>
              </div>

              <div
                onClick={() => setIncludeCostsChart(!includeCostsChart)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                  includeCostsChart ? 'bg-emerald-50/70 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={includeCostsChart ? 'text-emerald-600' : 'text-slate-400'}>
                  {includeCostsChart ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <div className="flex items-center gap-2">
                  <Calculator size={15} className="text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Gráfico SVG de Evolução das Competências (Inclusão no PDF)
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 font-bold ml-auto">Orientação Vertical R$</span>
              </div>
            </div>
          )}

        </div>

        {/* Footer do Modal */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <HelpCircle size={14} className="text-amber-600 shrink-0" />
            <span>
              {reportMode === 'audit'
                ? 'Relatório com colunas de auditoria (fonte, previsto, realizado, divergência e status).'
                : 'Apenas os itens marcados constarão no arquivo exportado.'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={exportFormat === 'pdf' ? handleExportPDF : handleExportCSV}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-black text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Download size={15} />
              <span>
                Exportar {exportFormat === 'pdf' ? (reportMode === 'audit' ? 'PDF de Auditoria' : 'PDF Executivo') : (reportMode === 'audit' ? 'Planilha de Auditoria (CSV)' : 'Planilha CSV')}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

