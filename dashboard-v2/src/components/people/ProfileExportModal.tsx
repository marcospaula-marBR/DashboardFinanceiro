import React, { useState, useMemo } from 'react';
import { X, Download, FileText, CheckSquare, Square, Printer, FileSpreadsheet, User, Building2, MapPin, CreditCard, DollarSign, History, Calculator, HelpCircle } from 'lucide-react';
import { Employee, EmploymentContract, MonthlyCost, getRemunerationLabel } from '@/types/loans';
import { formatCurrency } from '@/services/loans.service';

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

interface ProfileExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Partial<Employee>;
  history?: HistoryItem[];
  bonds?: EmploymentContract[];
  costs?: MonthlyCost[];
}

export function ProfileExportModal({
  isOpen,
  onClose,
  profile,
  history = [],
  bonds = [],
  costs = []
}: ProfileExportModalProps) {
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');

  // Seleção Módulos/Abas do Cadastro
  const [includePersonal, setIncludePersonal] = useState(true);
  const [includeContractual, setIncludeContractual] = useState(true);
  const [includeAddressContact, setIncludeAddressContact] = useState(true);
  const [includeBanking, setIncludeBanking] = useState(true);
  const [includeRemuneration, setIncludeRemuneration] = useState(true);
  const [includeTrajectory, setIncludeTrajectory] = useState(true);
  const [includeCostsHistory, setIncludeCostsHistory] = useState(true);
  const [includeCostsChart, setIncludeCostsChart] = useState(true);

  // Totalizadores acumulados do histórico de custos por verbas
  const costTotals = useMemo(() => {
    if (!costs || costs.length === 0) return null;
    return costs.reduce((acc, c) => {
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
  }, [costs]);

  if (!isOpen) return null;

  const employeeName = profile.name || 'Colaborador';
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

  // GERADOR CSV ESTRUTURADO
  const handleExportCSV = () => {
    let csv = '';
    const sanitize = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;

    csv += `"FICHA CADASTRAL DO COLABORADOR"\n`;
    csv += `"Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}"\n\n`;

    if (includePersonal) {
      csv += `"1. IDENTIFICAÇÃO E DADOS PESSOAIS"\n`;
      csv += `Campo;Valor\n`;
      csv += `Nome Completo;${sanitize(profile.name)}\n`;
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
      csv += `Vínculo Contratual;${sanitize(profile.linkType)}\n`;
      csv += `Escopo do Contrato;${sanitize(profile.job_role)}\n`;
      csv += `Setor / Departamento;${sanitize(profile.department)}\n`;
      csv += `Data de Admissão;${sanitize(formatDate(profile.start_date))}\n`;
      csv += `Vencimento do Contrato;${sanitize(formatDate(profile.contract_expiry_date))}\n`;
      csv += `Status do Cadastro;${sanitize(profile.status || 'Ativo')}\n`;
      csv += `Razão Social (PJ);${sanitize(profile.corporate_name)}\n`;
      csv += `CNPJ (PJ);${sanitize(profile.pj_type)}\n`;
      csv += `Nome do Responsável;${sanitize(profile.responsible_name)}\n`;
      csv += `CPF do Responsável;${sanitize(profile.responsible_cpf)}\n\n`;
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

      csv += `"5. REMUNERAÇÃO E FICHA EXECUTIVA"\n`;
      csv += `Item Remuneratório;Valor (R$)\n`;
      csv += `${remLabel.bruto};${fixed.toFixed(2).replace('.', ',')}\n`;
      csv += `Bônus;${bonus.toFixed(2).replace('.', ',')}\n`;
      csv += `Comissão;${comm.toFixed(2).replace('.', ',')}\n`;
      csv += `Conectividade;${conn.toFixed(2).replace('.', ',')}\n`;
      csv += `Incentivos;${inc.toFixed(2).replace('.', ',')}\n`;
      csv += `TOTAL MENSAL ESTIMADO;${totalCost.toFixed(2).replace('.', ',')}\n\n`;
    }

    if (includeTrajectory && history.length > 0) {
      csv += `"6. TRAJETÓRIA E HISTÓRICO DE ALTERAÇÕES"\n`;
      csv += `Data;Tipo de Evento;Valor Anterior;Novo Valor;Observações\n`;
      history.forEach(h => {
        csv += `${sanitize(formatDate(h.change_date))};${sanitize(h.event_type)};${sanitize(h.previous_value)};${sanitize(h.new_value)};${sanitize(h.observations)}\n`;
      });
      csv += `\n`;
    }

    if (includeCostsHistory && costs.length > 0) {
      csv += `"7. HISTÓRICO DE CUSTOS MENSAIS E TOTALIZADORES POR VERBA"\n`;
      if (costTotals) {
        csv += `"TOTALIZADORES ACUMULADOS POR VERBA"\n`;
        csv += `Verba;Total Acumulado (R$)\n`;
        csv += `Salário Fixo;${costTotals.fixed.toFixed(2).replace('.', ',')}\n`;
        csv += `Bônus;${costTotals.bonus.toFixed(2).replace('.', ',')}\n`;
        csv += `Comissão;${costTotals.comissao.toFixed(2).replace('.', ',')}\n`;
        csv += `Horas Extras;${costTotals.horaExtra.toFixed(2).replace('.', ',')}\n`;
        csv += `Benefícios (VR/VT/Cesta/Ajuda);${costTotals.beneficios.toFixed(2).replace('.', ',')}\n`;
        csv += `FGTS Empresa;${costTotals.fgts.toFixed(2).replace('.', ',')}\n`;
        csv += `13º Salário e Férias;${(costTotals.decimo + costTotals.ferias).toFixed(2).replace('.', ',')}\n`;
        csv += `Descontos Folha;${costTotals.descontos.toFixed(2).replace('.', ',')}\n`;
        csv += `TOTAL MENSAL DESEMBOLSADO;${costTotals.realCost.toFixed(2).replace('.', ',')}\n\n`;
      }
      csv += `DETALHAMENTO MENSAL DE CUSTOS\n`;
      csv += `Período Competência;Tipo Vínculo;Valor Fixo;Bônus;Comissão;FGTS;Custo Real Desembolsado\n`;
      costs.forEach(c => {
        const isCLT = c.vinculo_tipo === 'CLT';
        const cReal = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
        csv += `${sanitize(c.competencia)};${sanitize(c.vinculo_tipo)};${(c.valor_fixo || 0).toFixed(2).replace('.', ',')};${(c.valor_bonus || 0).toFixed(2).replace('.', ',')};${(c.valor_comissao || 0).toFixed(2).replace('.', ',')};${(c.valor_fgts || 0).toFixed(2).replace('.', ',')};${cReal.toFixed(2).replace('.', ',')}\n`;
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
                Ficha Cadastral Executiva • ${profile.job_role || 'Função não informada'}
              </p>
              <p style="margin: 2px 0 0 0; color: #334155; font-size: 11px; font-weight: 600;">
                Empresa: <strong style="color: #b45309;">${profile.company || 'MarBR'}</strong> &nbsp;|&nbsp; Vínculo: <strong>${profile.linkType || 'CLT'}</strong>
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
          <div class="section-title">1. Identificação e Dados Pessoais</div>
          <div class="grid">
            <div class="field"><span class="field-label">Nome Completo</span><span class="field-value">${profile.name || '-'}</span></div>
            <div class="field"><span class="field-label">CPF</span><span class="field-value">${profile.document_id || '-'}</span></div>
            <div class="field"><span class="field-label">RG</span><span class="field-value">${profile.document_rg || '-'}</span></div>
            <div class="field"><span class="field-label">Gênero</span><span class="field-value">${profile.gender || '-'}</span></div>
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
          <div class="section-title">2. Dados Contratuais e Empresa</div>
          <div class="grid">
            <div class="field"><span class="field-label">Empresa</span><span class="field-value">${profile.company || '-'}</span></div>
            <div class="field"><span class="field-label">Vínculo Contratual</span><span class="field-value">${profile.linkType || '-'}</span></div>
            <div class="field"><span class="field-label">Escopo do Contrato</span><span class="field-value">${profile.job_role || '-'}</span></div>
            <div class="field"><span class="field-label">Setor / Departamento</span><span class="field-value">${profile.department || '-'}</span></div>
            <div class="field"><span class="field-label">Data de Admissão</span><span class="field-value">${formatDate(profile.start_date)}</span></div>
            <div class="field"><span class="field-label">Vencimento do Contrato</span><span class="field-value">${formatDate(profile.contract_expiry_date)}</span></div>
            <div class="field"><span class="field-label">Status do Cadastro</span><span class="field-value">${profile.status || 'Ativo'}</span></div>
            ${profile.corporate_name ? `<div class="field"><span class="field-label">Razão Social (PJ)</span><span class="field-value">${profile.corporate_name}</span></div>` : ''}
            ${profile.pj_type ? `<div class="field"><span class="field-label">CNPJ (PJ)</span><span class="field-value">${profile.pj_type}</span></div>` : ''}
            ${profile.responsible_name ? `<div class="field"><span class="field-label">Nome do Responsável</span><span class="field-value">${profile.responsible_name}</span></div>` : ''}
            ${profile.responsible_cpf ? `<div class="field"><span class="field-label">CPF do Responsável</span><span class="field-value">${profile.responsible_cpf}</span></div>` : ''}
          </div>
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
              <tr><th>Item Remuneratório</th><th style="text-align: right;">Valor Mensal (R$)</th></tr>
            </thead>
            <tbody>
              <tr><td>${remLabel.bruto}</td><td style="text-align: right; font-weight: 600;">${formatCurrency(fixed)}</td></tr>
              <tr><td>Bônus</td><td style="text-align: right; font-weight: 600;">${formatCurrency(bonus)}</td></tr>
              <tr><td>Comissão</td><td style="text-align: right; font-weight: 600;">${formatCurrency(comm)}</td></tr>
              <tr><td>Conectividade</td><td style="text-align: right; font-weight: 600;">${formatCurrency(conn)}</td></tr>
              <tr><td>Incentivos</td><td style="text-align: right; font-weight: 600;">${formatCurrency(inc)}</td></tr>
              <tr style="background: #fffbeb; font-weight: 800; color: #92400e;"><td>CUSTO TOTAL ESTIMADO DA FOLHA</td><td style="text-align: right; color: #b45309; font-size: 14px;">${formatCurrency(totalCost)}</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }

    // 6. TRAJETÓRIA E HISTÓRICO
    if (includeTrajectory && history.length > 0) {
      html += `
        <div class="section">
          <div class="section-title">6. Trajetória e Histórico de Alterações</div>
          <table>
            <thead>
              <tr><th>Data</th><th>Evento</th><th>Anterior</th><th>Novo Valor</th><th>Observações</th></tr>
            </thead>
            <tbody>
              ${history.map(h => `
                <tr>
                  <td>${formatDate(h.change_date)}</td>
                  <td><strong>${h.event_type}</strong></td>
                  <td>${h.previous_value || '-'}</td>
                  <td>${h.new_value || '-'}</td>
                  <td>${h.observations || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // 7. HISTÓRICO DE CUSTOS MENSAIS E TOTALIZADORES
    if (includeCostsHistory && costs.length > 0) {
      const avgMonthlyCost = costTotals && costs.length > 0 ? costTotals.realCost / costs.length : 0;
      const sortedCosts = [...costs].sort((a, b) => a.competencia.localeCompare(b.competencia));
      const maxCost = Math.max(...sortedCosts.map(c => (c.valor_liquido || 0) + (c.vinculo_tipo === 'CLT' ? (c.valor_adiantamento || 0) : 0)), 1);

      html += `
        <div class="section">
          <div class="section-title">7. Histórico de Custos Mensais, Gráfico e Totalizadores por Verba</div>
          
          ${costTotals ? `
            <!-- Quadro de Totalizadores por Verbas Recebidas -->
            <div style="margin-bottom: 18px; background: #fffdf5; border: 1.5px solid #fef3c7; padding: 14px; border-radius: 8px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e; margin-bottom: 10px; border-bottom: 1px solid #fde68a; padding-bottom: 4px;">
                Totalizadores Acumulados de Verbas Recebidas do Custo Histórico
              </div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #f59e0b; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label">Total Salário Fixo</span>
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
                  <span class="field-label">Total 13º & Férias</span>
                  <span class="field-value">${formatCurrency(costTotals.decimo + costTotals.ferias)}</span>
                </div>
                <div style="background: #ecfdf5; padding: 8px 12px; border-radius: 6px; border-left: 3px solid #10b981; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                  <span class="field-label" style="color: #047857;">Média Mensal Desembolsada</span>
                  <span class="field-value" style="color: #047857; font-weight: 800;">${formatCurrency(avgMonthlyCost)}</span>
                </div>
                <div style="background: #fef3c7; padding: 8px 12px; border-radius: 6px; border-left: 4px solid #b45309; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <span class="field-label" style="color: #92400e; font-weight: 800;">TOTAL ACUMULADO DESEMBOLSADO</span>
                  <span class="field-value" style="color: #b45309; font-size: 14px; font-weight: 800;">${formatCurrency(costTotals.realCost)}</span>
                </div>
              </div>
            </div>
          ` : ''}

          ${includeCostsChart ? `
            <!-- Gráfico SVG Vetorial de Custo Mês a Mês (Garantido em Impressões PDF) -->
            <div style="margin-top: 15px; margin-bottom: 16px; background: #ffffff; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 12px; font-family: sans-serif;">
                Gráfico de Evolução do Custo Histórico Mês a Mês (Rótulos em R$)
              </div>
              
              <svg width="100%" height="160" viewBox="0 0 500 160" style="display: block; overflow: visible; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" stroke-width="1" />
                <line x1="0" y1="65" x2="500" y2="65" stroke="#f1f5f9" stroke-width="1" />
                <line x1="0" y1="110" x2="500" y2="110" stroke="#cbd5e1" stroke-width="1.5" />

                ${sortedCosts.map((c, idx) => {
                  const count = sortedCosts.length;
                  const slotWidth = 500 / count;
                  const barWidth = Math.min(slotWidth * 0.55, 36);
                  const xCenter = idx * slotWidth + slotWidth / 2;
                  const xBar = xCenter - barWidth / 2;

                  const isCLT = c.vinculo_tipo === 'CLT';
                  const realCost = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                  const maxH = 85;
                  const barH = Math.max(8, Math.round((realCost / maxCost) * maxH));
                  const yBar = 110 - barH;
                  const yValLabel = yBar - 4;

                  const compParts = c.competencia.split('-');
                  const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                  const mLabel = `${monthsShort[parseInt(compParts[1] || '1', 10) - 1]}/${(compParts[0] || '').slice(2)}`;
                  const valLabel = realCost >= 1000 ? `R$${(realCost / 1000).toFixed(1)}k` : `R$${realCost.toFixed(0)}`;

                  return `
                    <text x="${xCenter}" y="${yValLabel}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#047857" font-family="sans-serif">${valLabel}</text>
                    <rect x="${xBar}" y="${yBar}" width="${barWidth}" height="${barH}" rx="4" ry="4" fill="#10b981" stroke="#059669" stroke-width="1" style="-webkit-print-color-adjust: exact; print-color-adjust: exact;" />
                    <text x="${xCenter}" y="128" text-anchor="middle" font-size="9" font-weight="700" fill="#475569" font-family="sans-serif">${mLabel}</text>
                  `;
                }).join('')}
              </svg>
            </div>
          ` : ''}

          <!-- Tabela Detalhada por Mês -->
          <table>
            <thead>
              <tr>
                <th>Competência</th>
                <th>Vínculo</th>
                <th>Valor Fixo</th>
                <th>Bônus</th>
                <th>Comissão</th>
                <th>FGTS</th>
                <th style="text-align: right;">Custo Real Desembolsado</th>
              </tr>
            </thead>
            <tbody>
              ${costs.map(c => {
                const isCLT = c.vinculo_tipo === 'CLT';
                const cReal = (c.valor_liquido || 0) + (isCLT ? (c.valor_adiantamento || 0) : 0);
                return `
                <tr>
                  <td><strong>${c.competencia}</strong></td>
                  <td>${c.vinculo_tipo}</td>
                  <td>${formatCurrency(c.valor_fixo || 0)}</td>
                  <td>${formatCurrency(c.valor_bonus || 0)}</td>
                  <td>${formatCurrency(c.valor_comissao || 0)}</td>
                  <td>${formatCurrency(c.valor_fgts || 0)}</td>
                  <td style="text-align: right; font-weight: 700; color: #b45309;">${formatCurrency(cReal)}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
            ${costTotals ? `
              <tfoot>
                <tr style="background: #fffbeb; font-weight: 800; color: #92400e; border-top: 2px solid #fde68a;">
                  <td colspan="2">TOTAL ACUMULADO (${costs.length} MÊSES)</td>
                  <td>${formatCurrency(costTotals.fixed)}</td>
                  <td>${formatCurrency(costTotals.bonus)}</td>
                  <td>${formatCurrency(costTotals.comissao)}</td>
                  <td>${formatCurrency(costTotals.fgts)}</td>
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
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Exportar Ficha do Colaborador
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {employeeName} • Escolha quais seções deseja incluir no documento
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

        {/* Seleção de Formato */}
        <div className="px-6 pt-5 pb-3 bg-slate-50/60 border-b border-slate-100">
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

        {/* Seleção de Módulos (Abas do Cadastro) */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
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
              <span className="text-[10px] text-slate-400 ml-auto font-medium">Cargo, Setor, Empresa, Vínculo, Admissão</span>
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
                <span className="text-xs font-bold text-slate-800">5. Remuneração e Ficha Executiva</span>
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
                <span className="text-xs font-bold text-slate-800">6. Trajetória e Histórico de Alterações</span>
              </div>
              <span className="text-[10px] text-slate-400 ml-auto font-medium">{history.length} registro(s)</span>
            </div>

            {/* 7. Histórico de Custos Mensais */}
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
                <span className="text-xs font-bold text-slate-800">7. Histórico de Custos Mensais</span>
              </div>
              <span className="text-[10px] text-slate-400 ml-auto font-medium">{costs.length} mês(es)</span>
            </div>

            {/* 8. Gráfico de Custos Mês a Mês */}
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
                <span className="text-xs font-bold text-slate-800">8. Gráfico de Custos Mês a Mês (com Rótulos R$)</span>
              </div>
              <span className="text-[10px] text-slate-400 ml-auto font-medium">Gráfico de barras em PDF</span>
            </div>

          </div>
        </div>

        {/* Footer do Modal */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <HelpCircle size={14} className="text-amber-600 shrink-0" />
            <span>Apenas os itens marcados constarão no arquivo exportado.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={exportFormat === 'pdf' ? handleExportPDF : handleExportCSV}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-black text-amber-950 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-500 rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Download size={15} />
              <span>Exportar {exportFormat === 'pdf' ? 'PDF Executivo' : 'Planilha CSV'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
