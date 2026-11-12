import { jsPDF } from "jspdf";
import { getCompanyCreditorInfo, CompanyCreditorInfo } from "@/lib/timbrado_base64";
import { Employee, formatPjRole } from "@/types/loans";

/**
 * Converte valor numérico em reais para extenso em português do Brasil.
 */
export function valorPorExtenso(n: number): string {
  if (!n || isNaN(n) || n <= 0) return "zero reais";

  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "dez", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  function trio(val: number): string {
    if (val === 100) return "cem";
    const c = Math.floor(val / 100);
    const d = Math.floor((val % 100) / 10);
    const u = val % 10;
    const parts: string[] = [];
    if (c > 0) parts.push(centenas[c]);
    if (d === 1) {
      parts.push(especiais[u]);
    } else {
      if (d > 1) parts.push(dezenas[d]);
      if (u > 0) parts.push(unidades[u]);
    }
    return parts.join(" e ");
  }

  const inteiro = Math.floor(n);
  const centavos = Math.round((n - inteiro) * 100);

  const milhoes = Math.floor(inteiro / 1000000);
  const milhares = Math.floor((inteiro % 1000000) / 1000);
  const restos = inteiro % 1000;

  const partes: string[] = [];
  if (milhoes > 0) {
    partes.push(trio(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
  }
  if (milhares > 0) {
    partes.push(milhares === 1 ? "mil" : trio(milhares) + " mil");
  }
  if (restos > 0) {
    partes.push(trio(restos));
  }

  let resultado = "";
  if (inteiro > 0) {
    resultado = partes.join(" e ") + (inteiro === 1 ? " real" : " reais");
  }
  if (centavos > 0) {
    const centTexto = trio(centavos) + (centavos === 1 ? " centavo" : " centavos");
    resultado = resultado ? resultado + " e " + centTexto : centTexto;
  }
  return resultado || "zero reais";
}

export interface PjAdditiveParams {
  employee: Partial<Employee>;
  previousRemuneration?: number;
  newRemuneration?: number;
  previousRole?: string;
  newRole?: string;
  startDate: string; // YYYY-MM-DD
  vigencia: string; // Ex: "Prazo Indeterminado", "12 meses", "2027-11-04"
  additionalNotes?: string;
  companyName?: string;
}

export interface PendingAdditiveSlaStatus {
  hasPending: boolean;
  generatedDate?: string; // YYYY-MM-DD
  daysElapsed: number;
  isOverdue: boolean; // daysElapsed > 5
  additiveTitle?: string;
  url?: string;
}

export class PjAdditiveService {
  /**
   * Identifica se há aditivo pendente de assinatura e calcula SLA de 5 dias
   */
  static checkPendingAdditiveSla(links_aditivos?: string): PendingAdditiveSlaStatus {
    if (!links_aditivos) return { hasPending: false, daysElapsed: 0, isOverdue: false };

    // Busca linhas com padrão [Nome ... Pendente Assinatura ...](...)
    const regex = /\[([^\]]*Pendente[^\]]*)\]\(([^)]*)\)/gi;
    let match;
    let lastPending: { title: string; url: string; date?: string } | null = null;

    while ((match = regex.exec(links_aditivos)) !== null) {
      const title = match[1];
      const url = match[2];

      let foundDate: string | undefined;
      const urlDateMatch = url.match(/(?:pendente:)?(\d{4}-\d{2}-\d{2})/i);
      if (urlDateMatch) {
        foundDate = urlDateMatch[1];
      } else {
        const brDateMatch = title.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (brDateMatch) {
          foundDate = `${brDateMatch[3]}-${brDateMatch[2]}-${brDateMatch[1]}`;
        } else {
          const isoMatch = title.match(/(\d{4}-\d{2}-\d{2})/);
          if (isoMatch) foundDate = isoMatch[1];
        }
      }

      lastPending = { title, url, date: foundDate };
    }

    if (!lastPending || !lastPending.date) {
      return { hasPending: false, daysElapsed: 0, isOverdue: false };
    }

    const genDate = new Date(lastPending.date + "T12:00:00");
    const now = new Date();
    const diffTime = now.getTime() - genDate.getTime();
    const daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    return {
      hasPending: true,
      generatedDate: lastPending.date,
      daysElapsed,
      isOverdue: daysElapsed > 5,
      additiveTitle: lastPending.title,
      url: lastPending.url,
    };
  }

  /**
   * Adiciona nova entrada de aditivo pendente no campo links_aditivos
   */
  static appendPendingAdditiveToLinks(
    currentLinks: string | undefined,
    item: { date: string; amount?: number; role?: string }
  ): string {
    const lines = (currentLinks || "").split("\n").filter((l) => l.trim().length > 0);
    const amountStr = item.amount ? ` - R$ ${item.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "";
    const [y, m, d] = item.date.split("-");
    const brDate = `${d}/${m}/${y}`;
    const newEntry = `[Minuta Aditivo PJ${amountStr} - Pendente Assinatura - ${brDate}](#pendente:${item.date})`;

    // Remove pendências anteriores para não duplicar alertas
    const filtered = lines.filter((line) => !line.toLowerCase().includes("pendente assinatura"));
    filtered.unshift(newEntry);
    return filtered.join("\n");
  }

  /**
   * Converte a entrada pendente em aditivo assinado definitivo quando o arquivo for anexado
   */
  static resolvePendingAdditiveInLinks(
    currentLinks: string | undefined,
    signedUrl: string,
    signDateStr: string = new Date().toLocaleDateString("pt-BR")
  ): string {
    const lines = (currentLinks || "").split("\n").filter((l) => l.trim().length > 0);
    const signedEntry = `[Termo Aditivo PJ (Assinado ZapSign) ${signDateStr}](${signedUrl})`;

    let converted = false;
    const result = lines.map((line) => {
      if (line.toLowerCase().includes("pendente assinatura") && !converted) {
        converted = true;
        return signedEntry;
      }
      return line;
    });

    if (!converted) {
      result.unshift(signedEntry);
    }
    return result.join("\n");
  }

  /**
   * Gera a mensagem padronizada de lembrete de assinatura do Termo Aditivo no ZapSign
   */
  static buildZapSignReminderText(
    employee: Partial<Employee>,
    slaStatus?: PendingAdditiveSlaStatus
  ): string {
    const sla = slaStatus || this.checkPendingAdditiveSla(employee.links_aditivos);
    const repFirstName = (employee.responsible_name || employee.name || "Parceiro(a)").trim().split(" ")[0];
    const pjDisplay = employee.corporate_name || employee.name || "sua empresa";
    const companyDisplay = employee.company || "Grupo Mar Brasil";
    const genDateBr = sla.generatedDate
      ? sla.generatedDate.split("-").reverse().join("/")
      : new Date().toLocaleDateString("pt-BR");

    if (sla.isOverdue) {
      return `Olá, ${repFirstName}! Tudo bem?\n\nIdentificamos em nosso painel que o *Termo Aditivo de Prestação de Serviços PJ* referente à *${pjDisplay}* junto à *${companyDisplay}* (emitido em ${genDateBr}, há ${sla.daysElapsed} dias) ainda consta como *Pendente de Assinatura* no *ZapSign*.\n\nComo o prazo operacional de 5 dias já foi atingido, poderia verificar seu e-mail ou WhatsApp com o link do ZapSign para concluir a assinatura eletrônica? Caso precise que reenviemos o link ou o PDF, basta nos avisar por aqui. Muito obrigado!`;
    }

    return `Olá, ${repFirstName}! Tudo bem?\n\nPassando para lembrar que o *Termo Aditivo de Prestação de Serviços PJ* referente à *${pjDisplay}* junto à *${companyDisplay}* (emitido em ${genDateBr}) está aguardando sua assinatura eletrônica no *ZapSign*.\n\nQuando puder, por gentileza confira o link enviado pelo ZapSign em seu e-mail/WhatsApp para concluirmos a formalização dentro do prazo de 5 dias. Qualquer dúvida, estamos à disposição!`;
  }

  /**
   * Gera a URL direta do WhatsApp (wa.me) com a mensagem padronizada de lembrete do ZapSign.
   * Retorna null caso o colaborador não possua telefone profissional nem pessoal cadastrado.
   */
  static buildZapSignReminderWhatsAppUrl(
    employee: Partial<Employee>,
    slaStatus?: PendingAdditiveSlaStatus
  ): string | null {
    const rawPhone = employee.phone_professional || employee.phone || "";
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length < 10) return null;

    const fullPhone = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
    const message = this.buildZapSignReminderText(employee, slaStatus);
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Gera o texto jurídico formatado e estruturado do Termo Aditivo PJ
   */
  static getAdditiveDraft(params: PjAdditiveParams) {
    const { employee, startDate, vigencia, additionalNotes } = params;
    const companyCreditor: CompanyCreditorInfo = getCompanyCreditorInfo(params.companyName || employee.company);

    const newAmount = params.newRemuneration ?? employee.remuneration_fixed ?? employee.remuneration ?? 0;
    const prevAmount = params.previousRemuneration ?? 0;
    const newRole = formatPjRole(params.newRole || employee.job_role || "Terceirizado Prestador de Serviços");
    const prevRole = params.previousRole ? formatPjRole(params.previousRole) : undefined;

    const [sy, sm, sd] = startDate.split("-");
    const startDateBr = `${sd}/${sm}/${sy}`;

    const pjName = employee.corporate_name || employee.name || "CONTRATADA PJ";
    const pjCnpj = employee.pj_type || "---";
    const repName = employee.responsible_name || employee.name || "---";
    const repCpf = employee.responsible_cpf || employee.document_id || "---";
    const repRg = employee.responsible_rg || employee.document_rg || "---";

    const pjAddress = [
      employee.street || employee.cnpj_street,
      (employee.number || employee.cnpj_number) ? `nº ${employee.number || employee.cnpj_number}` : "",
      employee.complement || employee.cnpj_complement,
      employee.neighborhood || employee.cnpj_neighborhood,
      (employee.city || employee.cnpj_city) ? `${employee.city || employee.cnpj_city} - ${employee.state || employee.cnpj_state || "SP"}` : "",
      (employee.zip_code || employee.cnpj_zip_code) ? `CEP ${employee.zip_code || employee.cnpj_zip_code}` : "",
    ]
      .filter(Boolean)
      .join(", ") || "Endereço cadastral da CONTRATADA";

    const clauses: { title: string; text: string }[] = [];

    // Cláusula 1 - Vigência e Marco Temporal
    clauses.push({
      title: "CLÁUSULA PRIMEIRA - DA VIGÊNCIA E MARCO TEMPORAL",
      text: `As condições pactuadas no presente Termo Aditivo passam a vigorar plenamente a partir de ${startDateBr}, mantendo-se a vigência contratual estipulada em ${vigencia || "prazo indeterminado"}, permanecendo válidas até eventual distrato formal ou nova repactuação escrita entre as Partes.`,
    });

    // Cláusula 2 - Honorários / Remuneração
    const hasRemunerationChange = newAmount > 0 && prevAmount > 0 && newAmount !== prevAmount;
    if (hasRemunerationChange || newAmount > 0) {
      const extenso = valorPorExtenso(newAmount);
      const diffText =
        hasRemunerationChange && prevAmount > 0
          ? ` (reajustando o valor anteriormente praticado de R$ ${prevAmount.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })})`
          : " (ratificando-se o valor vigente)";
      clauses.push({
        title: hasRemunerationChange
          ? "CLÁUSULA SEGUNDA - DA REPACTUAÇÃO DOS HONORÁRIOS PROFISSIONAIS"
          : "CLÁUSULA SEGUNDA - DA RATIFICAÇÃO DOS HONORÁRIOS PROFISSIONAIS",
        text: `Pela execução dos serviços especializados, a CONTRATANTE pagará à CONTRATADA os honorários profissionais mensais no valor líquido de R$ ${newAmount.toLocaleString(
          "pt-BR",
          { minimumFractionDigits: 2 }
        )} (${extenso})${diffText}. O pagamento será realizado mediante apresentação e aprovação prévia da correspondente Nota Fiscal de Serviços eletrônica (NFS-e) e relatório sucinto de atividades autônomas, vedada qualquer vinculação salarial ou celetista.`,
      });
    }

    // Cláusula 3 - Escopo de Atuação
    const hasRoleChange = Boolean(
      newRole &&
        prevRole &&
        newRole.trim().toLowerCase() !== prevRole.trim().toLowerCase()
    );
    if (hasRoleChange || newRole) {
      clauses.push({
        title: hasRoleChange
          ? "CLÁUSULA TERCEIRA - DA ATUALIZAÇÃO DO ESCOPO DE ATUAÇÃO E ATIVIDADES"
          : "CLÁUSULA TERCEIRA - DO ESCOPO DE ATUAÇÃO E ATIVIDADES",
        text: `O objeto da prestação de serviços ${hasRoleChange ? "passa a contemplar" : "contempla"} especificamente as atividades técnicas e operacionais sob o escopo de ${newRole}, desempenhadas com total autonomia técnica, sem subordinação hierárquica, habitualidade cogente ou exclusividade, preservando a natureza cível e mercantil do contrato originário.`,
      });
    }

    // Cláusula 4 - Outras Alterações (se houver)
    if (additionalNotes && additionalNotes.trim().length > 0) {
      clauses.push({
        title: "CLÁUSULA QUARTA - DAS CONDIÇÕES COMPLEMENTARES ESPECÍFICAS",
        text: additionalNotes.trim(),
      });
    }

    // Cláusula Ratificação
    clauses.push({
      title: `CLÁUSULA ${clauses.length + 1 === 4 ? "QUARTA" : clauses.length + 1 === 5 ? "QUINTA" : "SEXTA"} - DA RATIFICAÇÃO E FORO`,
      text: `Permanecem inalteradas, plenamente válidas e em pleno vigor todas as demais cláusulas, prazos e obrigações do Contrato de Prestação de Serviços original que não tenham sido expressamente revogadas ou alteradas por este instrumento. Para dirimir quaisquer controvérsias decorrentes deste Termo Aditivo, as Partes elegem expressamente o Foro da Comarca de ${companyCreditor.forumCity || "Praia Grande - SP"}, com renúncia a qualquer outro, por mais privilegiado que seja.`,
    });

    return {
      companyCreditor,
      pjName,
      pjCnpj,
      repName,
      repCpf,
      repRg,
      pjAddress,
      startDateBr,
      newAmount,
      prevAmount,
      newRole,
      prevRole,
      vigencia,
      clauses,
      forumCity: companyCreditor.forumCity,
    };
  }

  /**
   * Gera o PDF timbrado oficial pronto para ZapSign / download
   */
  static async generatePjAdditivePDF(params: PjAdditiveParams): Promise<jsPDF> {
    const draft = this.getAdditiveDraft(params);
    const { companyCreditor } = draft;

    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = 40;

    const addBackground = () => {
      if (companyCreditor.timbradoB64) {
        doc.addImage(companyCreditor.timbradoB64, "JPEG", 0, 0, pageWidth, pageHeight);
      }
    };

    addBackground();

    // Título Principal
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("INSTRUMENTO PARTICULAR DE TERMO ADITIVO AO", pageWidth / 2, cursorY, { align: "center" });
    cursorY += 6;
    doc.text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS (PJ)", pageWidth / 2, cursorY, { align: "center" });
    cursorY += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);

    // Qualificação CONTRATANTE
    const contratanteText = `CONTRATANTE: ${companyCreditor.corporateName}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${companyCreditor.cnpj}, com sede em ${companyCreditor.fullAddress}, neste ato representada por ${companyCreditor.representativeFullText}.`;
    const contratanteLines = doc.splitTextToSize(contratanteText, contentWidth);
    doc.text(contratanteLines, margin, cursorY);
    cursorY += contratanteLines.length * 4.6 + 4;

    // Qualificação CONTRATADA
    const contratadaText = `CONTRATADA: ${draft.pjName}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${draft.pjCnpj}, com sede em ${draft.pjAddress}, neste ato representada por seu(sua) representante legal, ${draft.repName}, portador(a) do RG nº ${draft.repRg} e inscrito(a) no CPF/MF sob o nº ${draft.repCpf}.`;
    const contratadaLines = doc.splitTextToSize(contratadaText, contentWidth);
    doc.text(contratadaLines, margin, cursorY);
    cursorY += contratadaLines.length * 4.6 + 6;

    // Preâmbulo
    const preambulo = `As PARTES acima qualificadas têm, entre si, justo e acordado o presente Termo Aditivo, que se regerá mediante as seguintes cláusulas e condições:`;
    const preambuloLines = doc.splitTextToSize(preambulo, contentWidth);
    doc.text(preambuloLines, margin, cursorY);
    cursorY += preambuloLines.length * 4.6 + 5;

    // Renderização das Cláusulas
    for (const clause of draft.clauses) {
      if (cursorY > pageHeight - 45) {
        doc.addPage();
        addBackground();
        cursorY = 40;
      }

      doc.setFont("helvetica", "bold");
      doc.text(clause.title, margin, cursorY);
      cursorY += 5;

      doc.setFont("helvetica", "normal");
      const textLines = doc.splitTextToSize(clause.text, contentWidth);
      doc.text(textLines, margin, cursorY);
      cursorY += textLines.length * 4.6 + 5;
    }

    // Fecho e Data
    if (cursorY > pageHeight - 55) {
      doc.addPage();
      addBackground();
      cursorY = 40;
    }

    cursorY += 4;
    const dataExtenso = `${companyCreditor.city || "Praia Grande"} - ${companyCreditor.state || "SP"}, ${draft.startDateBr}.`;
    doc.setFont("helvetica", "bold");
    doc.text(`E, por estarem assim justas e contratadas, firmam o presente instrumento para que produza seus efeitos jurídicos e legais.`, margin, cursorY, { maxWidth: contentWidth });
    cursorY += 10;
    doc.text(dataExtenso, pageWidth / 2, cursorY, { align: "center" });
    cursorY += 18;

    // Linhas de Assinatura
    const colWidth = (contentWidth - 10) / 2;
    const col1X = margin;
    const col2X = margin + colWidth + 10;

    doc.setDrawColor(120, 120, 120);
    doc.line(col1X, cursorY, col1X + colWidth, cursorY);
    doc.line(col2X, cursorY, col2X + colWidth, cursorY);
    cursorY += 4;

    doc.setFontSize(8.5);
    doc.text("CONTRATANTE", col1X + colWidth / 2, cursorY, { align: "center" });
    doc.text("CONTRATADA", col2X + colWidth / 2, cursorY, { align: "center" });
    cursorY += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(companyCreditor.corporateName, col1X + colWidth / 2, cursorY, { align: "center", maxWidth: colWidth });
    doc.text(draft.pjName, col2X + colWidth / 2, cursorY, { align: "center", maxWidth: colWidth });
    cursorY += 4;

    doc.text(`Resp: ${companyCreditor.representativeName}`, col1X + colWidth / 2, cursorY, { align: "center" });
    doc.text(`Resp: ${draft.repName} (CPF ${draft.repCpf})`, col2X + colWidth / 2, cursorY, { align: "center" });

    return doc;
  }
}

