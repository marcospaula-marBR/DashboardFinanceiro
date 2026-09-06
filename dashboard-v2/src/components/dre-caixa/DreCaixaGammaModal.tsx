"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckSquare,
  Square,
  FileText,
  Loader2,
  Building,
  CreditCard,
  ShoppingBag,
  Clock,
  Layers,
  CheckCircle2,
  PieChart,
  Eye,
  ExternalLink,
  AlertCircle,
  Filter
} from 'lucide-react';
import { DreCaixaLancamento, PurchasesAuditSummary, DreCaixaFilters } from '@/types/dre-caixa';
import { DreCaixaService, formatCurrencyBRL, isDespesaRecorrente, decodeHtmlEntities } from '@/services/dre-caixa.service';

interface DreCaixaGammaModalProps {
  isOpen: boolean;
  onClose: () => void;
  lancamentos: DreCaixaLancamento[];
  periodoLabel?: string;
  empresaLabel?: string;
  selectedConta?: string;
  filters?: DreCaixaFilters;
  onlyCompras?: boolean;
}

export function DreCaixaGammaModal({
  isOpen,
  onClose,
  lancamentos,
  periodoLabel = 'Período Atual',
  empresaLabel = 'Consolidado',
  selectedConta,
  filters,
  onlyCompras = false
}: DreCaixaGammaModalProps) {
  // 1. Hooks no topo incondicionalmente
  const [activeTab, setActiveTab] = useState<'builder' | 'preview'>('builder');

  // Módulos selecionáveis
  const [includeCover, setIncludeCover] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeCompanyBreakdown, setIncludeCompanyBreakdown] = useState(true);
  const [includePaymentStructure, setIncludePaymentStructure] = useState(true);
  const [includePastInstallments, setIncludePastInstallments] = useState(true);
  const [includeCardsAndFlash, setIncludeCardsAndFlash] = useState(true);
  const [includeSelectedAccount, setIncludeSelectedAccount] = useState(Boolean(selectedConta));
  const [includeTopSuppliers, setIncludeTopSuppliers] = useState(true);
  const [includeCfoInsights, setIncludeCfoInsights] = useState(true);

  const [customTitle, setCustomTitle] = useState('');
  const [editedMarkdown, setEditedMarkdown] = useState('');
  const [isEditingManually, setIsEditingManually] = useState(false);
  const [isGeneratingGamma, setIsGeneratingGamma] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Computação determinística da Auditoria de Compras respeitando onlyCompras e selectedConta
  const audit: PurchasesAuditSummary = useMemo(() => {
    if (!isOpen || !lancamentos || lancamentos.length === 0) {
      return DreCaixaService.computePurchasesAudit([], selectedConta, Boolean(onlyCompras));
    }
    return DreCaixaService.computePurchasesAudit(lancamentos, selectedConta || undefined, Boolean(onlyCompras));
  }, [isOpen, lancamentos, selectedConta, onlyCompras]);

  // Detalhe robusto do cartão selecionado (com fallback via filtro direto)
  const activeCardDetail = useMemo(() => {
    if (!selectedConta) return null;
    if (audit.detalheContaSelecionada && audit.detalheContaSelecionada.count > 0) {
      return audit.detalheContaSelecionada;
    }

    const items = lancamentos.filter(
      l => (l.conta_corrente || '').trim().toLowerCase() === selectedConta.trim().toLowerCase() &&
           (l.sinal_valor < 0 || l.tipo === 'PAGAR')
    );
    const total = items.reduce((acc, l) => acc + Math.abs(l.valor), 0);
    const projMap = new Map<string, number>();
    const catMap = new Map<string, number>();
    const fornMap = new Map<string, { total: number; count: number }>();

    items.forEach(l => {
      const v = Math.abs(l.valor);
      const p = decodeHtmlEntities(l.projeto || 'Operacional / Geral');
      const c = decodeHtmlEntities(l.categoria || 'Geral');
      const f = decodeHtmlEntities(l.fornecedor_cliente || 'Outros / Não Informado');
      projMap.set(p, (projMap.get(p) || 0) + v);
      catMap.set(c, (catMap.get(c) || 0) + v);
      const currF = fornMap.get(f) || { total: 0, count: 0 };
      fornMap.set(f, { total: currF.total + v, count: currF.count + 1 });
    });

    return {
      conta: decodeHtmlEntities(selectedConta),
      total,
      count: items.length,
      projetos: Array.from(projMap.entries()).map(([projeto, val]) => ({
        projeto,
        total: val,
        count: 1,
        percentual: total > 0 ? (val / total) * 100 : 0
      })).sort((a, b) => b.total - a.total),
      categorias: Array.from(catMap.entries()).map(([categoria, val]) => ({
        categoria,
        total: val,
        count: 1,
        percentual: total > 0 ? (val / total) * 100 : 0
      })).sort((a, b) => b.total - a.total),
      fornecedores: Array.from(fornMap.entries()).map(([fornecedor, d]) => ({
        fornecedor,
        total: d.total,
        count: d.count,
        percentual: total > 0 ? (d.total / total) * 100 : 0
      })).sort((a, b) => b.total - a.total)
    };
  }, [selectedConta, audit.detalheContaSelecionada, lancamentos]);

  // Atualizar seleção de conta reativamente quando selectedConta mudar
  useEffect(() => {
    if (selectedConta) {
      setIncludeSelectedAccount(true);
    }
  }, [selectedConta]);

  // Título padrão inteligente considerando os filtros ativos
  const defaultTitle = useMemo(() => {
    if (selectedConta) {
      return `Raio-X de Compras: ${selectedConta} — ${empresaLabel} (${periodoLabel})`;
    }
    if (filters?.projetos && filters.projetos.length === 1) {
      return `Auditoria de Desembolsos: ${filters.projetos[0]} — ${empresaLabel} (${periodoLabel})`;
    }
    if (onlyCompras) {
      return `Auditoria Executiva de Compras & Aquisições — ${empresaLabel} (${periodoLabel})`;
    }
    return `Relatório Executivo de Compras & Desembolsos — ${empresaLabel} (${periodoLabel})`;
  }, [empresaLabel, periodoLabel, selectedConta, filters?.projetos, onlyCompras]);

  useEffect(() => {
    if (!isEditingManually) {
      setCustomTitle(defaultTitle);
    }
  }, [defaultTitle, isEditingManually]);

  // Compilador dinâmico do Markdown para a apresentação no Gamma
  const compiledMarkdown = useMemo(() => {
    if (!isOpen || !lancamentos || lancamentos.length === 0) return '';

    let md = '';

    // Metadados dos Filtros em Vigor para transparência executiva
    const filterBullets: string[] = [];
    filterBullets.push(`- **Data da Apuração:** ${new Date().toLocaleDateString('pt-BR')}`);
    filterBullets.push(`- **Base Operacional:** Regime de Caixa Real (Dados liquidados no Omie ERP)`);
    filterBullets.push(`- **Empresa(s):** ${filters?.empresas && filters.empresas.length > 0 ? filters.empresas.join(', ') : empresaLabel}`);
    filterBullets.push(`- **Período de Referência:** ${filters?.periodos && filters.periodos.length > 0 ? filters.periodos.join(', ') : periodoLabel}`);

    if (filters?.projetos && filters.projetos.length > 0) {
      filterBullets.push(`- **Projeto(s) / Contrato(s) Filtrado(s):** ${filters.projetos.join(', ')}`);
    }
    if (filters?.categorias && filters.categorias.length > 0) {
      filterBullets.push(`- **Categoria(s) Filtrada(s):** ${filters.categorias.join(', ')}`);
    }
    if (filters?.fornecedores && filters.fornecedores.length > 0) {
      filterBullets.push(`- **Fornecedor(es) Filtrado(s):** ${filters.fornecedores.join(', ')}`);
    }
    if (selectedConta) {
      filterBullets.push(`- **Cartão / Conta em Foco:** ${selectedConta}`);
    } else if (filters?.contasCorrentes && filters.contasCorrentes.length > 0) {
      filterBullets.push(`- **Contas Correntes Filtradas:** ${filters.contasCorrentes.join(', ')}`);
    }
    if (filters?.tipoPagamento && filters.tipoPagamento !== 'TODOS') {
      filterBullets.push(`- **Modalidade de Pagamento:** ${filters.tipoPagamento === 'A_VISTA' ? 'Somente Compras À Vista (1/1)' : 'Somente Compras Parceladas (1/N e amortizações)'}`);
    }
    if (onlyCompras) {
      filterBullets.push(`- **Escopo do Relatório:** Somente Compras & Aquisições (Despesas estruturais fixas, folha e tributos excluídos)`);
    } else {
      filterBullets.push(`- **Escopo do Relatório:** Consolidado Geral de Saídas (Compras + Despesas Estruturais)`);
    }
    const totalOcultos = (filters?.ocultarCategorias?.length || 0) + (filters?.ocultarProjetos?.length || 0) + (filters?.ocultarFornecedores?.length || 0);
    if (totalOcultos > 0) {
      filterBullets.push(`- **Privacidade & Compliance:** Ocultação de dados sensíveis ativada (${totalOcultos} itens restritos)`);
    }

    // 1. CAPA EXECUTIVA & LOGOS
    if (includeCover) {
      const getLogoUrl = (nome: string) => {
        const baseUrl = 'https://dashboard-financeiro-mar-brasil.vercel.app/Logos';
        if (nome.includes('Mar Brasil')) return `${baseUrl}/Mar%20BR%20-%20Chap%C3%A9u.png`;
        if (nome.includes('DZM')) return `${baseUrl}/DZM.png`;
        if (nome.includes('G2') || nome.includes('Grupo 2')) return `${baseUrl}/Grupo%202.jpeg`;
        if (nome.includes('Conectius')) return `${baseUrl}/Conectius.png`;
        return `${baseUrl}/Mar-Brasil-sem-fundo-preto.png`;
      };

      let logosHtml = '';
      if (empresaLabel.includes('Mar Brasil') || empresaLabel === 'Consolidado' || empresaLabel === 'Todas as Empresas') {
        logosHtml += `<img align="right" src="${getLogoUrl('Mar Brasil')}" height="70" style="margin-left: 10px;" />\n`;
      }
      if (empresaLabel.includes('DZM') || empresaLabel === 'Consolidado' || empresaLabel === 'Todas as Empresas') {
        logosHtml += `<img align="right" src="${getLogoUrl('DZM')}" height="70" style="margin-left: 10px;" />\n`;
      }
      if (empresaLabel.includes('G2') || empresaLabel === 'Consolidado' || empresaLabel === 'Todas as Empresas') {
        logosHtml += `<img align="right" src="${getLogoUrl('G2')}" height="70" style="margin-left: 10px;" />\n`;
      }
      if (empresaLabel.includes('Conectius') || empresaLabel === 'Consolidado' || empresaLabel === 'Todas as Empresas') {
        logosHtml += `<img align="right" src="${getLogoUrl('Conectius')}" height="70" style="margin-left: 10px;" />\n`;
      }
      logosHtml += '\n\n';

      md += logosHtml;
      md += `# ${customTitle || defaultTitle}\n\n`;
      md += `**Apresentação Executiva para Reunião de Diretoria & Conselho**\n\n`;
      md += `${filterBullets.join('\n')}\n\n`;
      md += `---\n\n`;
    }

    // 2. SUMÁRIO C-LEVEL: COMPRAS DO MÊS VS. DESPESAS RECORRENTES
    if (includeSummary) {
      md += `## 1. Sumário Executivo: Compras vs. Despesas Recorrentes\n\n`;
      if (onlyCompras) {
        md += `> 🛒 **Escopo Aplicado: Somente Compras & Aquisições**\n> Esta apuração isola estritamente insumos, materiais, softwares, equipamentos e despesas operacionais contratadas, desconsiderando folha de pagamento, pró-labore, aluguéis e tributos contínuos.\n\n`;
      } else {
        md += `Visão consolidada segregando o que foi efetivamente **comprado** (insumos, materiais, softwares, equipamentos e cartões) das **despesas estruturais fixas recorrentes** (folha de pagamento, encargos, pró-labore, aluguéis e tributos contínuos):\n\n`;
      }

      if (filters?.projetos && filters.projetos.length > 0) {
        md += `> 📌 **Projeto(s) em Análise:** ${filters.projetos.join(', ')}\n\n`;
      }
      if (selectedConta) {
        md += `> 💳 **Conta/Cartão em Análise:** ${selectedConta}\n\n`;
      }

      md += `| Dimensão Financeira | Valor Liquidado (R$) | % do Desembolso Total |\n`;
      md += `|---|---|---|\n`;
      md += `| **Total de Saídas no Caixa** | **${formatCurrencyBRL(audit.totalGeralPago)}** | **100,0%** |\n`;
      md += `| 🛒 **Compras & Aquisições Efetivas** | **${formatCurrencyBRL(audit.totalCompras)}** | **${audit.percentualCompras.toFixed(1)}%** |\n`;
      md += `| 🏢 Despesas Recorrentes Estruturais | ${formatCurrencyBRL(audit.totalRecorrente)} | ${(100 - audit.percentualCompras).toFixed(1)}% |\n\n`;
    }

    // 3. CONSOLIDAÇÃO POR EMPRESA
    if (includeCompanyBreakdown) {
      md += `## 2. Total Comprado por Cada Empresa\n\n`;
      md += `Distribuição dos desembolsos e compras entre as empresas do grupo econômico:\n\n`;

      md += `| Empresa | Total Compras (R$) | Desp. Recorrentes (R$) | Compras À Vista | Novas Parceladas | Amort. Passada | Lançamentos |\n`;
      md += `|---|---|---|---|---|---|---|\n`;
      audit.porEmpresa.forEach(emp => {
        md += `| **${emp.empresa}** | ${formatCurrencyBRL(emp.totalCompras)} | ${formatCurrencyBRL(emp.totalRecorrente)} | ${formatCurrencyBRL(emp.aVista)} | ${formatCurrencyBRL(emp.parcelado)} | ${formatCurrencyBRL(emp.amortizacaoPassada)} | ${emp.count} |\n`;
      });
      md += `\n`;
    }

    // 4. ESTRUTURA DE PAGAMENTO (À VISTA VS. NOVAS COMPRAS PARCELADAS)
    if (includePaymentStructure) {
      md += `## 3. Estrutura de Pagamento das Compras: À Vista vs. Parcelado\n\n`;
      md += `Análise de liquidez das compras contratadas e liquidadas no período:\n\n`;

      const pctAVista = audit.totalCompras > 0 ? (audit.totalAVista / audit.totalCompras) * 100 : 0;
      const pctNovasParc = audit.totalCompras > 0 ? (audit.totalNovasParceladas / audit.totalCompras) * 100 : 0;

      md += `- **Compras À Vista (Parcela 1/1):** ${formatCurrencyBRL(audit.totalAVista)} (${pctAVista.toFixed(1)}% das compras)\n`;
      md += `- **Novas Compras Parceladas (1ª Parcela 1/N):** ${formatCurrencyBRL(audit.totalNovasParceladas)} (${pctNovasParc.toFixed(1)}% das compras)\n`;
      md += `- **Comprometimento Financeiro Futuro Estimado:** ${formatCurrencyBRL(audit.totalComprometimentoFuturo)} a vencer nos próximos meses decorrentes das compras parceladas deste período.\n\n`;
    }

    // 5. AMORTIZAÇÃO DE COMPRAS ANTERIORES (> 1/N)
    if (includePastInstallments) {
      md += `## 4. Quitação de Compras Anteriores (Parcelas > 1/N Pagas no Mês)\n\n`;
      const escopoAmort = selectedConta
        ? `através da conta/cartão **${selectedConta}**`
        : `no período filtrado`;
      md += `Desembolsos de caixa efetuados ${escopoAmort} que **não representam compras novas**, mas sim quitação de compromissos parcelados assumidos em períodos anteriores:\n\n`;
      md += `> **Total Pago no Mês em Parcelas Passadas:** **${formatCurrencyBRL(audit.totalAmortizacaoAnterior)}**\n\n`;

      md += `| Fornecedor / Credor | Empresa | Categoria | Parcela | Valor Pago (R$) |\n`;
      md += `|---|---|---|---|---|\n`;
      const passadas = lancamentos
        .filter(l => {
          if (l.sinal_valor >= 0 && l.tipo !== 'PAGAR') return false;
          if (selectedConta && (l.conta_corrente || '').trim().toLowerCase() !== selectedConta.trim().toLowerCase()) return false;
          if (onlyCompras && isDespesaRecorrente(l.categoria, l.conta_dre, l.fornecedor_cliente)) return false;
          return (l.parcela_atual || 1) > 1;
        })
        .slice(0, 15);

      if (passadas.length === 0) {
        md += `| Nenhuma amortização de compras passadas registrada no escopo selecionado | - | - | - | - |\n`;
      } else {
        passadas.forEach(p => {
          md += `| ${decodeHtmlEntities(p.fornecedor_cliente)} | ${decodeHtmlEntities(p.empresa)} | ${decodeHtmlEntities(p.categoria)} | ${p.numero_parcela || `${p.parcela_atual}/${p.total_parcelas}`} | ${formatCurrencyBRL(p.valor)} |\n`;
        });
      }
      md += `\n`;
    }

    // 6. MEIOS DE PAGAMENTO, CARTÕES CORPORATIVOS & RAIO-X
    if (includeCardsAndFlash || includeSelectedAccount) {
      if (selectedConta && activeCardDetail) {
        md += `## 5. Raio-X do Cartão / Conta em Foco: ${activeCardDetail.conta}\n\n`;
        md += `Detalhamento exclusivo dos desembolsos liquidados através de **${activeCardDetail.conta}** (Total: **${formatCurrencyBRL(activeCardDetail.total)}** em ${activeCardDetail.count} transações):\n\n`;

        if (activeCardDetail.projetos.length > 0) {
          md += `### Aplicação por Projeto / Contrato (Omie):\n\n`;
          md += `| Projeto / Contrato | Valor Liquidado (R$) | Participação (%) |\n`;
          md += `|---|---|---|\n`;
          activeCardDetail.projetos.slice(0, 10).forEach(p => {
            md += `| **${decodeHtmlEntities(p.projeto)}** | ${formatCurrencyBRL(p.total)} | ${p.percentual.toFixed(1)}% |\n`;
          });
          md += `\n`;
        }

        if (activeCardDetail.categorias.length > 0) {
          md += `### Desembolsos por Categoria no Cartão:\n\n`;
          md += `| Categoria | Valor Liquidado (R$) | Participação (%) |\n`;
          md += `|---|---|---|\n`;
          activeCardDetail.categorias.slice(0, 10).forEach(c => {
            md += `| **${decodeHtmlEntities(c.categoria)}** | ${formatCurrencyBRL(c.total)} | ${c.percentual.toFixed(1)}% |\n`;
          });
          md += `\n`;
        }
      } else {
        md += `## 5. Meios de Pagamento, Cartões Corporativos & Cartão Flash\n\n`;
        md += `### Total Comprado por Cartão Corporativo:\n\n`;

        md += `| Cartão / Conta | Total Liquidado (R$) | Quantidade de Transações |\n`;
        md += `|---|---|---|\n`;
        const cartoes = audit.porCartao.filter(c => c.isCartao || c.isFlash);
        if (cartoes.length === 0) {
          md += `| Nenhuma transação em cartão identificada no período | - | - |\n`;
        } else {
          cartoes.forEach(c => {
            md += `| **${decodeHtmlEntities(c.conta)}** | ${formatCurrencyBRL(c.total)} | ${c.count} |\n`;
          });
        }
        md += `\n`;

        md += `### Utilização do Cartão Flash por Projeto / Contrato (Omie):\n\n`;
        md += `| Projeto / Contrato | Valor Pago via Flash (R$) | Participação (%) |\n`;
        md += `|---|---|---|\n`;
        if (audit.flashPorProjeto.length === 0) {
          md += `| Nenhuma despesa Flash vinculada a projetos no período | - | - |\n`;
        } else {
          audit.flashPorProjeto.forEach(p => {
            md += `| ${decodeHtmlEntities(p.projeto)} | ${formatCurrencyBRL(p.total)} | ${p.percentual.toFixed(1)}% |\n`;
          });
        }
        md += `\n`;
      }
    }

    // 7. TOP FORNECEDORES & CATEGORIAS DE COMPRAS
    if (includeTopSuppliers) {
      const fornTitle = selectedConta
        ? `Principais Estabelecimentos & Fornecedores: ${selectedConta}`
        : `Principais Fornecedores & Categorias de Compras`;
      md += `## 6. ${fornTitle}\n\n`;

      if (selectedConta && activeCardDetail && activeCardDetail.fornecedores.length > 0) {
        md += `### Maiores Estabelecimentos / Favorecidos no Cartão:\n\n`;
        md += `| Estabelecimento / Favorecido | Total Pago (R$) | Transações | % do Cartão |\n`;
        md += `|---|---|---|---|\n`;
        activeCardDetail.fornecedores.slice(0, 10).forEach(f => {
          md += `| **${decodeHtmlEntities(f.fornecedor)}** | ${formatCurrencyBRL(f.total)} | ${f.count} | ${f.percentual.toFixed(1)}% |\n`;
        });
        md += `\n`;
      } else {
        md += `### Maiores Fornecedores do Período:\n\n`;
        md += `| Fornecedor | Total (R$) | Modalidade | Parcelas | % do Desembolso |\n`;
        md += `|---|---|---|---|---|\n`;
        audit.topFornecedoresCompras.slice(0, 10).forEach(f => {
          md += `| **${decodeHtmlEntities(f.fornecedor)}** | ${formatCurrencyBRL(f.total)} | ${f.modalidade} | ${f.parcelasExemplo} | ${f.percentual.toFixed(1)}% |\n`;
        });
        md += `\n`;

        md += `### Maiores Categorias de Compras:\n\n`;
        audit.porCategoriaCompras.slice(0, 8).forEach(c => {
          md += `- **${decodeHtmlEntities(c.categoria)}:** ${formatCurrencyBRL(c.total)} (${c.percentual.toFixed(1)}%)\n`;
        });
        md += `\n`;
      }
    }

    // 8. PARECER EXECUTIVO DE CFO
    if (includeCfoInsights) {
      md += `## 7. Parecer Executivo de CFO & Recomendações Estratégicas\n\n`;
      if (onlyCompras) {
        md += `1. **Auditoria de Compras:** Compras e aquisições representam **${formatCurrencyBRL(audit.totalCompras)}** no escopo analisado. O acompanhamento contínuo dos gastos operacionais e aquisições assegura contenção de custos e alta rastreabilidade.\n`;
      } else {
        md += `1. **Equilíbrio de Caixa:** As compras do mês mantiveram uma proporção de ${(audit.totalCompras / (audit.totalGeralPago || 1) * 100).toFixed(1)}% sobre as saídas totais, indicando que a maior parte da estrutura operacional de desembolsos é composta por custos fixos e folha.\n`;
      }
      md += `2. **Gestão de Prazos e Alavancagem:** A relação entre compras à vista (${formatCurrencyBRL(audit.totalAVista)}) e parceladas preserva liquidez imediata. A amortização de períodos anteriores (${formatCurrencyBRL(audit.totalAmortizacaoAnterior)}) deve ser acompanhada para evitar pressão de capital de giro.\n`;
      if (selectedConta) {
        md += `3. **Governança do Cartão/Conta (${selectedConta}):** As movimentações em **${selectedConta}** foram devidamente segregadas por contratos e centros de custo no Omie ERP, garantindo transparência fiscal perante a diretoria.\n\n`;
      } else {
        md += `3. **Governança de Cartões e Flash:** Os gastos em cartões corporativos e no benefício Flash encontram-se atrelados aos contratos operacionais (projetos), garantindo rastreabilidade e segurança fiscal.\n\n`;
      }
    }

    return md;
  }, [
    isOpen,
    lancamentos,
    customTitle,
    defaultTitle,
    empresaLabel,
    periodoLabel,
    selectedConta,
    filters,
    onlyCompras,
    activeCardDetail,
    includeCover,
    includeSummary,
    includeCompanyBreakdown,
    includePaymentStructure,
    includePastInstallments,
    includeCardsAndFlash,
    includeSelectedAccount,
    includeTopSuppliers,
    includeCfoInsights,
    audit
  ]);

  // Conteúdo Markdown ativo (editado ou compilado)
  const activeMarkdown = useMemo(() => {
    return isEditingManually ? editedMarkdown : compiledMarkdown;
  }, [isEditingManually, editedMarkdown, compiledMarkdown]);

  // Disparo da geração assíncrona no Gamma.app
  const handleGenerateGamma = async () => {
    try {
      setIsGeneratingGamma(true);
      setStatusMessage('Enviando dados estruturados para a IA do Gamma...');
      setGeneratedUrl(null);

      const resGenerate = await fetch('/api/gamma/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdownReport: activeMarkdown
        })
      });

      if (!resGenerate.ok) {
        const errData = await resGenerate.json();
        throw new Error(errData.error || 'Falha ao conectar à API do Gamma.');
      }

      const generateData = await resGenerate.json();
      const generationId = generateData.id || generateData.generationId;

      if (!generationId) {
        const fallbackUrl = generateData.gammaUrl || generateData.url || generateData.exportUrl;
        if (fallbackUrl) {
          setGeneratedUrl(fallbackUrl);
          window.open(fallbackUrl, '_blank');
          return;
        }
        throw new Error('ID de geração não retornado pelo Gamma.');
      }

      // Polling de status
      let isComplete = false;
      let attempts = 0;
      const maxAttempts = 60; // 3 minutos

      while (!isComplete && attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 3000));

        const resStatus = await fetch(`/api/gamma/status/${generationId}`);
        if (resStatus.ok) {
          const statusData = await resStatus.json();
          const statusStr = (statusData.status || statusData.state || '').toLowerCase();
          const finalUrl = statusData.gammaUrl || statusData.url || statusData.exportUrl || statusData.link;

          if (statusStr === 'completed' || statusStr === 'complete' || statusStr === 'done' || (finalUrl && statusStr !== 'pending' && statusStr !== 'generating')) {
            isComplete = true;
            setStatusMessage('Apresentação pronta com sucesso!');
            if (finalUrl) {
              setGeneratedUrl(finalUrl);
              window.open(finalUrl, '_blank');
            }
          } else {
            setStatusMessage(`A inteligência artificial do Gamma está montando os slides... (${attempts * 3}s)`);
          }
        }
      }
    } catch (err: any) {
      console.error('Erro na geração Gamma:', err);
      alert(err.message || 'Erro ao gerar apresentação no Gamma.');
    } finally {
      setIsGeneratingGamma(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-inner">
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  Gerador de Apresentação Executiva no Gamma
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/20 text-white">
                  Board Slides
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Monte slides C-Level em 1 clique a partir dos dados reais de compras do Omie ERP
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'builder'
                ? 'bg-white text-emerald-800 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            🧩 Módulos da Apresentação
          </button>
          <button
            onClick={() => {
              if (!isEditingManually) setEditedMarkdown(compiledMarkdown);
              setActiveTab('preview');
            }}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'preview'
                ? 'bg-white text-emerald-800 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            👁️ Pré-visualizar & Editar Conteúdo
          </button>
        </div>

        {/* CORPO DO CONSTRUTOR */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {activeTab === 'builder' && (
            <div className="space-y-5 animate-fadeIn">

              {/* Filtros em Vigor Aplicados na Apresentação */}
              <div className="p-3.5 bg-slate-100/80 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-2 text-xs">
                <span className="font-extrabold text-slate-700 flex items-center gap-1.5 mr-1">
                  <Filter size={14} className="text-emerald-600" />
                  Filtros Ativos nos Slides:
                </span>
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold shadow-2xs">
                  🏢 {filters?.empresas && filters.empresas.length > 0 ? filters.empresas.join(', ') : empresaLabel}
                </span>
                <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold shadow-2xs">
                  📅 {filters?.periodos && filters.periodos.length > 0 ? filters.periodos.join(', ') : periodoLabel}
                </span>
                {filters?.projetos && filters.projetos.length > 0 && (
                  <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-bold shadow-2xs">
                    📌 Projetos: {filters.projetos.join(', ')}
                  </span>
                )}
                {filters?.categorias && filters.categorias.length > 0 && (
                  <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-bold shadow-2xs">
                    🏷️ Categorias: {filters.categorias.join(', ')}
                  </span>
                )}
                {filters?.fornecedores && filters.fornecedores.length > 0 && (
                  <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-bold shadow-2xs">
                    🤝 Fornecedores: {filters.fornecedores.join(', ')}
                  </span>
                )}
                {selectedConta && (
                  <span className="px-2.5 py-1 bg-teal-50 border border-teal-200 rounded-lg text-teal-800 font-bold shadow-2xs">
                    💳 Cartão/Conta: {selectedConta}
                  </span>
                )}
                {onlyCompras && (
                  <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-bold shadow-2xs">
                    🛒 Somente Compras (Sem Recorrentes)
                  </span>
                )}
                {filters?.tipoPagamento && filters.tipoPagamento !== 'TODOS' && (
                  <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-800 font-bold shadow-2xs">
                    ⚡ {filters.tipoPagamento === 'A_VISTA' ? 'À Vista (1/1)' : 'Parcelado'}
                  </span>
                )}
              </div>

              {/* Título da Apresentação */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Título dos Slides
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-800"
                  placeholder="Título da Apresentação"
                />
              </div>

              {/* Seleção de Módulos (Checkboxes) */}
              <div>
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Selecione os Blocos que farão parte dos Slides:
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  
                  {/* 1. Capa com Logos */}
                  <div
                    onClick={() => setIncludeCover(!includeCover)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeCover ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-600">
                      {includeCover ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        1. Capa Executiva & Logotipos Oficiais
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Injeta os logotipos das empresas ativas (Mar Brasil, DZM, G2, Conectius) e dados da apuração.
                      </p>
                    </div>
                  </div>

                  {/* 2. Sumário Compras vs Recorrentes */}
                  <div
                    onClick={() => setIncludeSummary(!includeSummary)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeSummary ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-600">
                      {includeSummary ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        2. Sumário: Compras vs. Despesas Recorrentes
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tabela de separação de insumos/materiais vs. folha, aluguéis e tributos com % de cada bloco.
                      </p>
                    </div>
                  </div>

                  {/* 3. Total por Empresa */}
                  <div
                    onClick={() => setIncludeCompanyBreakdown(!includeCompanyBreakdown)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeCompanyBreakdown ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-600">
                      {includeCompanyBreakdown ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        3. Total Comprado por Cada Empresa
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Comparativo consolidado entre as empresas do grupo com valores e contagem de notas.
                      </p>
                    </div>
                  </div>

                  {/* 4. Estrutura de Pagamento (À vista vs Parcelas Novas) */}
                  <div
                    onClick={() => setIncludePaymentStructure(!includePaymentStructure)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includePaymentStructure ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-600">
                      {includePaymentStructure ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        4. Estrutura: Compras À Vista vs. Novas Parceladas
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Valores pagos em parcela 1/1 vs. 1/N, além do comprometimento financeiro futuro.
                      </p>
                    </div>
                  </div>

                  {/* 5. Amortização de Compras Passadas */}
                  <div
                    onClick={() => setIncludePastInstallments(!includePastInstallments)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includePastInstallments ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-600">
                      {includePastInstallments ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        5. Quitação de Compras Anteriores ({'>'} 1/N)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Identificação das compras efetuadas em meses passados cujas parcelas foram quitadas agora.
                      </p>
                    </div>
                  </div>

                  {/* 6. Cartões Corporativos & Flash por Projeto OU Raio-X em Foco */}
                  <div
                    onClick={() => {
                      setIncludeCardsAndFlash(!includeCardsAndFlash);
                      if (selectedConta) setIncludeSelectedAccount(!includeCardsAndFlash);
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeCardsAndFlash ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-600">
                      {includeCardsAndFlash ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        {selectedConta ? `6. Raio-X em Foco: ${selectedConta}` : '6. Cartões Corporativos & Flash por Projeto'}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {selectedConta
                          ? 'Detalhamento por Projeto, Categoria e Fornecedores específico deste cartão/conta filtrado.'
                          : 'Gastos por cartão e detalhamento do Cartão Flash por Contrato/Projeto (Santos, SmartSampa, etc.).'}
                      </p>
                    </div>
                  </div>

                  {/* 7. Top Fornecedores e Categorias */}
                  <div
                    onClick={() => setIncludeTopSuppliers(!includeTopSuppliers)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeTopSuppliers ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-600">
                      {includeTopSuppliers ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        {selectedConta ? `7. Maiores Estabelecimentos: ${selectedConta}` : '7. Principais Fornecedores & Categorias'}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {selectedConta
                          ? `Ranking dos maiores estabelecimentos e credores da conta/cartão ${selectedConta}.`
                          : 'Ranking dos maiores credores com modalidade e principais tipos de compras.'}
                      </p>
                    </div>
                  </div>

                  {/* 8. Parecer CFO */}
                  <div
                    onClick={() => setIncludeCfoInsights(!includeCfoInsights)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                      includeCfoInsights ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-600">
                      {includeCfoInsights ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-400" />}
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 block">
                        8. Parecer Executivo de CFO
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Recomendações estratégicas de liquidez, governança e prazos médios de pagamento.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* ABA PREVIEW / EDIÇÃO DO MARKDOWN */}
          {activeTab === 'preview' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  Conteúdo Markdown Compilado (Você pode ajustar os textos antes do envio):
                </span>
                {isEditingManually && (
                  <button
                    onClick={() => {
                      setIsEditingManually(false);
                      setEditedMarkdown(compiledMarkdown);
                    }}
                    className="text-emerald-700 font-bold hover:underline"
                  >
                    Restaurar Original
                  </button>
                )}
              </div>

              <textarea
                value={activeMarkdown}
                onChange={e => {
                  setIsEditingManually(true);
                  setEditedMarkdown(e.target.value);
                }}
                className="w-full h-96 p-4 text-xs font-mono bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 leading-relaxed resize-none"
              />
            </div>
          )}

          {/* TELA DE SUCESSO / LINK DA APRESENTAÇÃO */}
          {generatedUrl && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">Apresentação criada no Gamma!</h4>
                  <p className="text-xs text-emerald-800">Seus slides já foram montados pela IA.</p>
                </div>
              </div>
              <a
                href={generatedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <span>Abrir Apresentação</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {isGeneratingGamma && (
              <span className="flex items-center gap-2 text-emerald-700 font-bold">
                <Loader2 size={16} className="animate-spin text-emerald-600" />
                {statusMessage}
              </span>
            )}
            {!isGeneratingGamma && (
              <span>Os slides são criados diretamente no seu Gamma.app prontos para edição e apresentação.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateGamma}
              disabled={isGeneratingGamma}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isGeneratingGamma ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Gerar Slides no Gamma</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isGeneratingGamma}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
