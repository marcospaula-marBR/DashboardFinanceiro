import { jsPDF } from "jspdf";
import { getCompanyCreditorInfo } from "../lib/timbrado_base64";
import { Employee } from "../types/loans";
import { supabase } from "@/lib/supabase";

export class PDFService {
  static async promptWitness(_isTestMode: boolean): Promise<[{ name: string | null, cpf: string | null }, { name: string | null, cpf: string | null }] | null> {
    // Testemunhas suprimidas por diretriz do projeto (não terá testemunhas)
    return null;
  }

  static async generateDebtTermPDF(loanData: any, emp: any, isTestMode: boolean = false, autoDownload: boolean = true): Promise<jsPDF | undefined> {
    const amount = loanData.amount || loanData.value || 0;
    
    if (!loanData || !amount) {
      alert("Este colaborador não possui empréstimo registrado para gerar o termo.");
      return;
    }

    let fullEmpDetails = { ...emp };
    try {
        const table = isTestMode ? 'employees_test' : 'employees';
        const empId = loanData.employee_id || emp.id;
        if (empId) {
            const { data } = await supabase.from(table).select('*').eq('id', empId).single();
            if (data) {
                fullEmpDetails = { ...fullEmpDetails, ...data };
            }
        }
    } catch(err) {
        console.warn("Aviso ao resgatar detalhes da pessoa", err);
    }

    // Detecta a empresa credora vinculada ao colaborador (MarBR, DZM ou G2)
    const companyCreditor = getCompanyCreditorInfo(loanData.company || fullEmpDetails.company || emp.company);

    const doc = new jsPDF('p', 'mm', 'a4');
    const today = new Date();
    
    const reqAmount = parseFloat(String(amount).replace(',', '.')) || 0;
    const reqInstallments = parseInt(loanData.installments) || 1;
    const installmentValue = reqAmount / reqInstallments;

    const fullAddress = `${fullEmpDetails.street || ''}, ${fullEmpDetails.number || ''}, ${fullEmpDetails.neighborhood || ''}, ${fullEmpDetails.city || ''} - ${fullEmpDetails.state || ''}, CEP: ${fullEmpDetails.zip_code || ''}`.replace(/^(, )+|undefined/g, '').trim();

    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatDate = (dStr: string) => {
        if (!dStr) return '---';
        const [y, m, d] = dStr.split('T')[0].split('-');
        return `${d}/${m}/${y}`;
    };

    try {
      const timbrado = companyCreditor.timbradoB64;
      if (!timbrado) throw new Error("Base64 do timbrado não carregado para a empresa vinculada.");

      const addPageWithTimbrado = () => {
        doc.addImage(timbrado, 'JPEG', 0, 0, 210, 297);
      };

      addPageWithTimbrado();

      const margin = 20;
      const pageWidth = 210;
      const contentWidth = pageWidth - (margin * 2) - 10;
      let cursorY = 35;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("TERMO DE CONFISSÃO DE DÍVIDA", pageWidth / 2, cursorY, { align: "center" });
      cursorY += 15;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const addJustifiedText = (text: string) => {
        const paragraphs = text.split('\n');
        for (const p of paragraphs) {
          if (!p.trim()) {
            cursorY += 5;
            continue;
          }
          const lines = doc.splitTextToSize(p, contentWidth);
          lines.forEach((line: string, index: number) => {
            if (cursorY > 260) {
              doc.addPage();
              addPageWithTimbrado();
              cursorY = 55;
            }
            if (index === lines.length - 1) {
              doc.text(line, margin, cursorY);
            } else {
              doc.text(line, margin, cursorY, { align: 'justify', maxWidth: contentWidth });
            }
            cursorY += 6;
          });
          cursorY += 2;
        }
      };

      // Lógica Robusta de Datas
      const rawCycle = loanData.start_cycle || loanData.startDate || "";
      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

      let refMonthName = "---";
      let refYear = today.getFullYear();
      let firstPaymentFormatted = "10/--/----";

      console.log("[PDFService] Dados Recebidos:", { loanData, rawCycle, company: companyCreditor.code });

      if (loanData.first_payment_date || loanData.firstPaymentDate) {
        firstPaymentFormatted = formatDate(loanData.first_payment_date || loanData.firstPaymentDate);
      } else if (rawCycle) {
        try {
          const parts = rawCycle.split('T')[0].split('-');
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]);
          
          if (!isNaN(y) && !isNaN(m)) {
            refYear = y;
            refMonthName = monthNames[m - 1] || "---";

            // Primeira Parcela = Ciclo + 1 Mês (Sempre dia 10)
            const nextM = m === 12 ? 1 : m + 1;
            const nextY = m === 12 ? y + 1 : y;
            firstPaymentFormatted = `10/${String(nextM).padStart(2, '0')}/${nextY}`;
          }
        } catch (e) {
          console.error("Erro no parse da data do ciclo", e);
        }
      }

      if (rawCycle && refMonthName === "---") {
        try {
          const parts = rawCycle.split('T')[0].split('-');
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]);
          if (!isNaN(y) && !isNaN(m)) {
            refYear = y;
            refMonthName = monthNames[m - 1] || "---";
          }
        } catch (e) {}
      }

      const reqDate = loanData.request_date || loanData.requestDate || loanData.created_at || today.toISOString();
      
      const isPJ = fullEmpDetails.employment_type === 'PJ' || fullEmpDetails.linkType === 'PJ';
      const razaoSocialOuNome = isPJ ? (fullEmpDetails.corporate_name || fullEmpDetails.full_name || '') : (fullEmpDetails.full_name || '');
      const tipoPessoa = isPJ ? 'pessoa jurídica de direito privado' : 'pessoa física';

      const corpoTexto = `DEVEDOR: ${razaoSocialOuNome}, ${tipoPessoa}, inscrito no ${fullEmpDetails.pj_type || 'CPF'} sob o n.º ${fullEmpDetails.document_id || ''}, estabelecido na ${fullAddress}, neste ato representada por ${fullEmpDetails.responsible_name || fullEmpDetails.full_name}, inscrito no CPF sob o n.º ${fullEmpDetails.responsible_cpf || fullEmpDetails.document_id || ''}.

CREDOR: ${companyCreditor.corporateName}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${companyCreditor.cnpj}, com sede em ${companyCreditor.fullAddress}, neste ato representada por ${companyCreditor.representativeFullText || `${companyCreditor.representativeRole}, ${companyCreditor.representativeTitle || 'a Sra.'} ${companyCreditor.representativeName}, inscrita no CPF sob n.º ${companyCreditor.representativeCpf}`}.

As partes acima qualificadas, por este instrumento particular e na melhor forma de direito, confessam e assumem como líquida, certa e exigível a dívida a seguir descrita, sujeitando-se às cláusulas e condições que se seguem:

CLÁUSULA PRIMEIRA – DO OBJETO DA DÍVIDA
1.1. O(A) DEVEDOR(A) confessa e declara dever ao(à) CREDOR(A) a importância líquida, certa e exigível de ${fmt(reqAmount)}, referente ao empréstimo concedido pela ${companyCreditor.corporateName} ao(à) DEVEDOR(A) em ${formatDate(reqDate)}.

CLÁUSULA SEGUNDA – DA FORMA DE PAGAMENTO
2.1. O valor confessado na Cláusula Primeira será quitado pelo(a) DEVEDOR(A) por meio de descontos nas futuras notas fiscais de prestação de serviços emitidas à ${companyCreditor.corporateName}, em ${reqInstallments} parcelas mensais e sucessivas, no valor de ${fmt(installmentValue)} cada uma, no dia 10 de cada mês, a partir de ${firstPaymentFormatted}.

2.2. O ciclo de referência desta confissão é ${refMonthName} de ${refYear}. Os descontos serão aplicados automaticamente pela CREDORA no momento do processamento das notas fiscais, e o valor líquido a ser pago ao(à) DEVEDOR(A) será o resultado da nota fiscal menos o valor da parcela do empréstimo.

CLÁUSULA TERCEIRA – DA INADIMPLÊNCIA
3.1. O não pagamento de qualquer parcela na data estipulada, implicará no vencimento antecipado de todo o saldo devedor, que se tornará imediatamente exigível pela CREDORA.
3.2. Em caso de inadimplência, incidirão sobre o saldo devedor vencido e não pago : a) Multa moratória de 2% (dois por cento) sobre o saldo devedor em aberto; b) Juros de mora de 1% (um por cento) ao mês, calculados pro rata die. c) Correção monetária pelo IGP-M ou outro índice que o substitua.
3.3. A CREDORA se reserva o direito de promover a execução judicial deste Termo, que é título executivo extrajudicial.
3.4. A eventual tolerância não implicará em novação ou transação.
3.5. O valor solicitado está vinculado exclusivamente ao contrato de prestação do serviço. Com o encerramento do contrato e cessação da prestação de serviço, as parcelas restantes serão automática e antecipadamente consideradas vencidas .

CLÁUSULA QUARTA – DA QUITAÇÃO ANTECIPADA
4.1. O(A) DEVEDOR(A) poderá solicitar a quitação antecipada total ou parcial do empréstimo a qualquer momento.

CLÁUSULA QUINTA – DAS DISPOSIÇÕES GERAIS
5.1. As partes declaram ter lido e compreendido todas as cláusulas deste Termo.
5.2. Fica eleito o foro da comarca de ${companyCreditor.forumCity} para dirimir quaisquer dúvidas.`;

      addJustifiedText(corpoTexto);

      cursorY += 10;
      if (cursorY > 230) {
        doc.addPage();
        addPageWithTimbrado();
        cursorY = 55;
      }

      const signatureDate = reqDate ? new Date(reqDate + 'T12:00:00') : today;
      const signatureDay = signatureDate.getDate();
      const signatureMonth = monthNames[signatureDate.getMonth()];
      const signatureYear = signatureDate.getFullYear();

      doc.text(`${companyCreditor.city} - ${companyCreditor.state}, ${signatureDay} de ${signatureMonth} de ${signatureYear}.`, margin, cursorY);

      cursorY += 28;
      if (cursorY > 255) {
        doc.addPage();
        addPageWithTimbrado();
        cursorY = 55;
      }

      // Assinatura exclusiva do devedor (empresa e testemunhas suprimidas por diretriz)
      const sigLineWidth = 110;
      const sigLineX = (pageWidth - sigLineWidth) / 2;
      doc.line(sigLineX, cursorY, sigLineX + sigLineWidth, cursorY);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("DEVEDOR(A)", pageWidth / 2, cursorY + 5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const debtorName = razaoSocialOuNome;
      doc.text(debtorName, pageWidth / 2, cursorY + 9, { align: "center" });
      if (fullEmpDetails.responsible_name && fullEmpDetails.responsible_name !== debtorName) {
        doc.text(`Rep. Legal: ${fullEmpDetails.responsible_name}`, pageWidth / 2, cursorY + 13, { align: "center" });
        doc.text(`CPF/CNPJ: ${fullEmpDetails.responsible_cpf || fullEmpDetails.document_id || ''}`, pageWidth / 2, cursorY + 17, { align: "center" });
      } else {
        doc.text(`CPF/CNPJ: ${fullEmpDetails.document_id || ''}`, pageWidth / 2, cursorY + 13, { align: "center" });
      }

      const safeName = (fullEmpDetails.full_name || 'Desconhecido').replace(/\s+/g, '_');
      const companyTag = companyCreditor.code;
      if (autoDownload) {
        doc.save(`Termo_Divida_${companyTag}_${safeName}_${Date.now()}.pdf`);
      }

      return doc;

    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      alert("Erro ao gerar PDF interno.");
      return undefined;
    }
  }
}
