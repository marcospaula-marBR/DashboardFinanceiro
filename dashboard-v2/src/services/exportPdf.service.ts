import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import domtoimage from 'dom-to-image-more';
import { DreCalculatedResult, DreFilters } from '@/types/dre';
import { ExportSelections } from '@/components/dre/DreExportModal';

export class ExportPdfService {
  
  static async buildNativePdf(
    results: DreCalculatedResult,
    selections: ExportSelections,
    empresa: string,
    periodo: string,
    filters: DreFilters,
    aiText?: string
  ): Promise<void> {
    try {
      // Determina orientação dinamicamente para evitar quebra de tabela
      const isLandscape = results.validColumns.length > 5;
      const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 12;
      const contentWidth = pdfWidth - (margin * 2);
      let currentY = margin;

      const formatCurrency = (val: number) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

      const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > pdfHeight - margin) {
          pdf.addPage();
          currentY = margin + 8; // Inicia nova página com margem
          return true;
        }
        return false;
      };

      // --- 1. CABEÇALHO (Slate Escuro com Detalhe Amber) ---
      pdf.setFillColor(15, 23, 42); // bg-slate-900
      pdf.rect(0, 0, pdfWidth, 25, 'F');
      
      pdf.setFillColor(217, 119, 6); // amber-600 (detalhe sutil de separação)
      pdf.rect(0, 25, pdfWidth, 1.5, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.text('RELATÓRIO FINANCEIRO EXECUTIVO (DRE)', margin, 15);
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const dateStr = new Date().toLocaleDateString('pt-BR');
      pdf.text(`Emitido em: ${dateStr} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, 21);
      
      currentY = 34;

      // --- 1.5 FILTROS ATIVOS (Exibição estruturada dos filtros) ---
      const formatFilterList = (list?: string[]) => {
        if (!list || list.length === 0) return 'Todos';
        if (list.length > 3) return `${list.slice(0, 3).join(', ')} (+${list.length - 3})`;
        return list.join(', ');
      };

      pdf.setDrawColor(241, 245, 249); // slate-100
      pdf.setFillColor(248, 250, 252); // slate-50
      pdf.roundedRect(margin, currentY, contentWidth, 18, 1, 1, 'FD');
      
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text("PARÂMETROS E FILTROS ATIVOS", margin + 4, currentY + 5.5);
      
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(71, 85, 105); // slate-600
      
      const filterColWidth = contentWidth / 3;
      pdf.text(`Empresa: ${formatFilterList(filters.empresas)}`, margin + 4, currentY + 10.5);
      pdf.text(`Período: ${formatFilterList(filters.periodos)}`, margin + 4 + filterColWidth, currentY + 10.5);
      pdf.text(`Depto/Centro Custo: ${formatFilterList(filters.departamentos)}`, margin + 4 + (filterColWidth * 2), currentY + 10.5);
      pdf.text(`Projeto: ${formatFilterList(filters.projetos)}`, margin + 4, currentY + 14.5);
      pdf.text(`Categoria DRE: ${formatFilterList(filters.categorias)}`, margin + 4 + filterColWidth, currentY + 14.5);
      
      currentY += 26;

      // --- 2. ANÁLISE DE IA (BrisinhAI) ---
      if (selections.includeAiAnalysis && aiText) {
        checkPageBreak(30);
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Análise Executiva (BrisinhAI)", margin, currentY);
        currentY += 6;

        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(9.5);
        pdf.setFont("helvetica", "normal");
        
        // Divide o texto para caber no documento
        const lines = pdf.splitTextToSize(aiText, contentWidth);
        
        // Garante que o texto longo não corte, adicionando páginas caso estoure
        for (let i = 0; i < lines.length; i++) {
          checkPageBreak(5);
          pdf.text(lines[i], margin, currentY);
          currentY += 4.8;
        }
        currentY += 6;
      }

      // --- 3. RESUMO KPIs ---
      if (selections.includeKpis) {
        checkPageBreak(32);
        
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Indicadores Chave de Desempenho", margin, currentY);
        currentY += 7;

        const kpiBoxWidth = (contentWidth - 10) / 3;
        const drawKpi = (title: string, value: string, xPos: number, isPositive?: boolean) => {
          pdf.setDrawColor(241, 245, 249); // slate-100
          pdf.setFillColor(248, 250, 252); // slate-50
          pdf.roundedRect(xPos, currentY, kpiBoxWidth, 18, 1, 1, 'FD');
          
          pdf.setTextColor(100, 116, 139); // slate-500
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.text(title.toUpperCase(), xPos + 5, currentY + 6);
          
          if (isPositive === true) pdf.setTextColor(16, 185, 129); // emerald-500
          else if (isPositive === false) pdf.setTextColor(244, 63, 94); // rose-500
          else pdf.setTextColor(15, 23, 42); // slate-900
          
          pdf.setFontSize(11);
          pdf.text(value, xPos + 5, currentY + 13.5);
        };

        drawKpi("Faturamento Operacional", formatCurrency(results.totais['Total Entradas Operacionais'] || 0), margin);
        const lucroLiquido = (results.kpis as any).lucroLiquido || (results.kpis as any).resultado || 0;
        drawKpi("Resultado Líquido", formatCurrency(lucroLiquido), margin + kpiBoxWidth + 5, lucroLiquido >= 0);
        drawKpi("Fluxo de Caixa Livre (FCL)", formatCurrency(results.kpis.fcl || 0), margin + (kpiBoxWidth * 2) + 10, (results.kpis.fcl || 0) >= 0);
        
        currentY += 26;
      }

      // --- 4. GRÁFICOS (Captura do Off-screen DOM com alta qualidade) ---
      const addChartToPdf = async (elementId: string, title: string) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        checkPageBreak(105);
        
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, margin, currentY);
        currentY += 6;
        
        try {
          // Captura com dom-to-image em alta resolução e fundo branco limpo
          const dataUrl = await domtoimage.toPng(el, { 
            quality: 1, 
            bgcolor: '#ffffff',
            width: 900,
            height: 400,
            style: { 
              transform: 'scale(1.3)', 
              transformOrigin: 'top left',
              width: '900px',
              height: '400px'
            } 
          });
          
          const imgWidth = contentWidth;
          const imgHeight = (400 * contentWidth) / 900; // Mantém proporção do contêiner fixo de 900x400
          
          pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 8;
        } catch (err) {
          console.error(`Erro ao converter gráfico ${elementId}:`, err);
        }
      };

      if (selections.includeEvolution) await addChartToPdf('print-chart-evolution', "Gráfico de Evolução Mensal");
      if (selections.includeWaterfall) await addChartToPdf('print-chart-waterfall', "Análise Waterfall de Formação do FCL");
      if (selections.includeDonut) await addChartToPdf('print-chart-donut', "Composição de Custos e Despesas Operacionais");

      // --- 5. TABELA DRE NATIVA (Vetorizada com autoTable) ---
      if (selections.includeTable) {
        checkPageBreak(40);
        
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Demonstrativo do Resultado do Exercício - Detalhado", margin, currentY);
        currentY += 5;

        const tableCols = ["Item / Categoria DRE", ...results.validColumns, "Total"];
        const tableBody: string[][] = [];
        const tableStyles: number[] = []; // Indices de linhas em negrito

        let rowIndex = 0;
        results.estrutura.forEach((item) => {
          if ((item as unknown as Record<string, unknown>).id === 'TOTAL_ENTRADAS_SAIDAS') return; // Pula linha em branco
          
          const isSoma = (item.tipo as string) === 'soma' || (item.tipo as string) === 'fcl' || (item.tipo as string) === 'margem';
          const isGrupo = (item.tipo as string) === 'grupo';
          
          const rowData = [item.titulo];
          let rowTotal = 0;
          
          results.validColumns.forEach(col => {
            const val = results.mensal[item.titulo]?.[col] || 0;
            rowTotal += val;
            if ((item.tipo as string) === 'margem') {
              rowData.push(val.toFixed(1) + '%');
            } else {
              rowData.push(formatCurrency(val).replace('R$', '').trim());
            }
          });
          
          if ((item.tipo as string) === 'margem') rowData.push('');
          else rowData.push(formatCurrency(rowTotal).replace('R$', '').trim());

          tableBody.push(rowData);
          
          if (isSoma || isGrupo) {
            tableStyles.push(rowIndex);
          }
          rowIndex++;
        });

        autoTable(pdf, {
          startY: currentY,
          head: [tableCols],
          body: tableBody,
          theme: 'grid',
          styles: { 
            fontSize: isLandscape ? 8 : 7.2, 
            cellPadding: isLandscape ? 2.5 : 1.8 
          },
          headStyles: { 
            fillColor: [15, 23, 42], // Slate-900 (Sem Indigo/Purple Ban)
            textColor: 255, 
            fontStyle: 'bold' 
          },
          columnStyles: { 
            0: { 
              fontStyle: 'bold', 
              cellWidth: isLandscape ? 62 : 42 
            } 
          },
          didParseCell: (data) => {
            if (data.section === 'body' && tableStyles.includes(data.row.index)) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [241, 245, 249]; // slate-100
            }
            if (data.section === 'body' && data.column.index > 0) {
              data.cell.styles.halign = 'right';
            }
          }
        });
      }

      // 6. Download
      const formattedDate = dateStr.replace(/\//g, '-');
      const filename = `DRE_Executivo_${empresa.substring(0,12).trim()}_${formattedDate}.pdf`;
      pdf.save(filename);

    } catch (error) {
      console.error("Erro ao gerar PDF Nativo:", error);
      throw error;
    }
  }

  static exportToCsv(results: DreCalculatedResult, filters: DreFilters, empresa: string, periodo: string): void {
    try {
      const headers = ["Categoria / Conta DRE", ...results.validColumns, "Total"];
      const csvRows: string[] = [];
      
      const formatFilterList = (list?: string[]) => (!list || list.length === 0) ? 'Todos' : list.join(', ');
      
      // Metadata
      csvRows.push(`"RELATÓRIO DRE EXECUTIVO (DADOS BRUTOS)"`);
      csvRows.push(`"Contexto da Exportação:";"${empresa} - ${periodo}"`);
      csvRows.push(`"Empresas:";"${formatFilterList(filters.empresas)}"`);
      csvRows.push(`"Períodos:";"${formatFilterList(filters.periodos)}"`);
      csvRows.push(`"Departamentos/Centros:";"${formatFilterList(filters.departamentos)}"`);
      csvRows.push(`"Projetos:";"${formatFilterList(filters.projetos)}"`);
      csvRows.push(`"Categorias DRE:";"${formatFilterList(filters.categorias)}"`);
      csvRows.push(`"Exportado em:";"${new Date().toLocaleString('pt-BR')}"`);
      csvRows.push(""); // Spacer
      
      // Header da Tabela
      csvRows.push(headers.map(h => `"${h}"`).join(";"));
      
      // Linhas da Tabela
      results.estrutura.forEach((item) => {
        if ((item as unknown as Record<string, unknown>).id === 'TOTAL_ENTRADAS_SAIDAS') return;
        
        const rowData: string[] = [`"${item.titulo}"`];
        let rowTotal = 0;
        
        results.validColumns.forEach(col => {
          const val = results.mensal[item.titulo]?.[col] || 0;
          rowTotal += val;
          if ((item.tipo as string) === 'margem') {
            rowData.push(`"${val.toFixed(1)}%"`);
          } else {
            rowData.push(`"${val.toFixed(2).replace('.', ',')}"`); // Excel pt-BR
          }
        });
        
        if ((item.tipo as string) === 'margem') {
          rowData.push(`""`);
        } else {
          rowData.push(`"${rowTotal.toFixed(2).replace('.', ',')}"`);
        }
        
        csvRows.push(rowData.join(";"));
      });
      
      // Adiciona BOM (\uFEFF) para garantir leitura correta de acentuação no Excel em português
      const csvContent = "\uFEFF" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      
      const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const filename = `DRE_Dados_Brutos_${empresa.substring(0,12).trim()}_${dateStr}.csv`;
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      throw error;
    }
  }

  // Fallback legada (mantida por compatibilidade e segurança)
  static async generateDashboardPdf(): Promise<void> {
    throw new Error("Use buildNativePdf para gerar o PDF executivo agora.");
  }
}
