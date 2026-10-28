"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  CheckSquare,
  Square,
  Loader2,
  Trash2,
  ArrowRight,
  Database,
  RefreshCw,
  Sparkles,
  DollarSign,
  Copy,
  Info,
  Calendar,
  Building2,
  SlidersHorizontal,
  ChevronDown,
  Eye,
  Edit3,
  Check,
  RotateCcw,
  Gift,
  AlertCircle,
  Banknote
} from "lucide-react";
import { parseCltFile, CltParseResult, CltParsedEmployee } from "@/utils/cltFileParser";
import { findBestNameMatch } from "@/utils/nameSimilarity";
import { PeopleHRService } from "@/services/people-hr.service";
import { Employee, MonthlyCost } from "@/types/loans";
import { formatCurrency } from "@/services/loans.service";

export interface StagingCostRow {
  id: string; // ID temporário no staging
  targetEmployeeId: string; // ID do colaborador na base ou 'NEW'
  employeeName: string;
  documentId: string;
  matchScore: number;
  matchType: "EXACT" | "SIMILAR" | "NEW";
  cargo?: string;
  competencia: string; // YYYY-MM-01
  sourceType: "PAYROLL_EXTRATO" | "EXCEL_RETROATIVO" | "BENEFICIOS_PDF" | "ADVANCE_PDF";
  
  // 1. Proventos e Bases da Folha Mensal
  valor_fixo: number; // Salário Fixo
  valor_holerite: number; // Proventos Brutos da Folha Mensal
  valor_outros_recebidos: number; // Outros Valores Recebidos (que não o especificado)
  valor_hora_extra: number;
  valor_adicional_not: number;
  
  // 2. Descontos da Folha
  valor_descontos: number;
  inss_empregado: number;
  irrf_empregado: number;
  desconto_vt_6: number; // Desconto legal de 6% da folha
  valor_faltas: number;
  dias_faltas: number;
  valor_consignado: number;
  valor_pensao_alimenticia: number;
  valor_fgts: number;

  // 3. Benefícios e Pagamentos Extras da Competência (Última Parte)
  valor_vt: number; // VT RECEBIDO / RECARGA EFETIVA
  valor_cesta: number; // VR / CESTA BÁSICA CONCEDIDA
  valor_vr: number; // VALE REFEIÇÃO
  valor_adiantamento: number; // ADIANTAMENTO FOLHA (importado da folha de adiantamento)
  valor_bonus: number; // BONIFICAÇÃO / PREMIAÇÃO
  valor_ajuda_custo: number; // AJUDA DE CUSTO
  
  // Outras Verbas
  valor_ferias: number;
  valor_rescisao: number;
  valor_decimo_terceiro: number;
  
  // Folha Líquida
  folha_liquido: number;
  
  // Observação
  observacao?: string;
  
  // Status de Seleção
  isSelected: boolean;
}

interface CostImportStagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingEmployees: Employee[];
  defaultCompetencia?: string;
}

export function CostImportStagingModal({
  isOpen,
  onClose,
  onSuccess,
  existingEmployees,
  defaultCompetencia,
}: CostImportStagingModalProps) {
  // Controle de Fonte: 'FOLHA', 'ADVANCE', 'BENEFICIOS' ou 'EXCEL'
  const [sourceMode, setSourceMode] = useState<"FOLHA" | "ADVANCE" | "BENEFICIOS" | "EXCEL">("FOLHA");

  // Estados de Upload e Parsing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mergeSuccessMessage, setMergeSuccessMessage] = useState<string | null>(null);

  // Competência selecionada
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>(() => {
    if (defaultCompetencia) return defaultCompetencia;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  });

  // Linhas do staging
  const [stagingRows, setStagingRows] = useState<StagingCostRow[]>([]);

  // Filtros de busca e visualização no staging
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMatchType, setFilterMatchType] = useState<"ALL" | "MATCHED" | "NEW" | "EXISTING">("ALL");

  // Valores em massa para VT, VR/Cesta e Adiantamento
  const [bulkVtValue, setBulkVtValue] = useState<string>("");
  const [bulkCestaValue, setBulkCestaValue] = useState<string>("");

  // Estado para linha inspecionada/editada em modal detalhado
  const [inspectRow, setInspectRow] = useState<StagingCostRow | null>(null);

  // Estados de detecção preventiva de conflitos
  const [existingCostsInDb, setExistingCostsInDb] = useState<Map<string, MonthlyCost>>(new Map());
  const [isLoadingExistingCosts, setIsLoadingExistingCosts] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [conflictingRows, setConflictingRows] = useState<{ row: StagingCostRow; existingCost: MonthlyCost }[]>([]);
  const [conflictDecisions, setConflictDecisions] = useState<Record<string, "ACCEPT_NEW" | "KEEP_DB">>({});

  // Estados de gravação
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [isLoadingPreviousBenefits, setIsLoadingPreviousBenefits] = useState(false);

  // Reset ao abrir modal
  useEffect(() => {
    if (isOpen) {
      if (defaultCompetencia) {
        setSelectedCompetencia(defaultCompetencia);
      }
      setErrorMessage(null);
      setMergeSuccessMessage(null);
      setIsCommitting(false);
      setShowCorrectionModal(false);
      setConflictingRows([]);
    }
  }, [isOpen]);

  // Carrega custos já cadastrados para a competência ativa no Supabase
  useEffect(() => {
    if (!selectedCompetencia || !isOpen) return;
    let isCancelled = false;

    const loadExisting = async () => {
      try {
        setIsLoadingExistingCosts(true);
        const costs = await PeopleHRService.getMonthlyCostsByCompetencia(selectedCompetencia);
        if (isCancelled) return;
        const map = new Map<string, MonthlyCost>();
        costs.forEach((c) => {
          map.set(c.employee_id, c);
        });
        setExistingCostsInDb(map);
      } catch (err) {
        console.error("Erro ao verificar custos existentes no banco:", err);
      } finally {
        if (!isCancelled) setIsLoadingExistingCosts(false);
      }
    };

    loadExisting();
    return () => {
      isCancelled = true;
    };
  }, [selectedCompetencia, isOpen]);

  // Lista de competências disponíveis nas linhas do staging
  const availableStagingCompetencias = useMemo(() => {
    const setComps = new Set(stagingRows.map((r) => r.competencia));
    return Array.from(setComps).sort().reverse();
  }, [stagingRows]);

  // Atualiza competência selecionada quando o staging traz novas
  useEffect(() => {
    if (availableStagingCompetencias.length > 0 && !availableStagingCompetencias.includes(selectedCompetencia)) {
      setSelectedCompetencia(availableStagingCompetencias[0]);
    }
  }, [availableStagingCompetencias, selectedCompetencia]);

  // Linhas visíveis filtradas
  const visibleRows = useMemo(() => {
    return stagingRows.filter((r) => {
      const matchSearch =
        searchQuery === "" ||
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.documentId.includes(searchQuery) ||
        (r.cargo && r.cargo.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchComp = r.competencia.slice(0, 7) === selectedCompetencia.slice(0, 7);
      const alreadyExists = r.targetEmployeeId !== "NEW" && existingCostsInDb.has(r.targetEmployeeId);

      const matchTypeOk =
        filterMatchType === "ALL" ||
        (filterMatchType === "MATCHED" && r.matchType !== "NEW") ||
        (filterMatchType === "NEW" && r.matchType === "NEW") ||
        (filterMatchType === "EXISTING" && alreadyExists);

      return matchSearch && matchComp && matchTypeOk;
    });
  }, [stagingRows, searchQuery, selectedCompetencia, filterMatchType, existingCostsInDb]);

  // Contagem de conflitos para a competência selecionada
  const activeConflictsCount = useMemo(() => {
    return stagingRows.filter(
      (r) =>
        r.isSelected &&
        r.competencia.slice(0, 7) === selectedCompetencia.slice(0, 7) &&
        r.targetEmployeeId !== "NEW" &&
        existingCostsInDb.has(r.targetEmployeeId)
    ).length;
  }, [stagingRows, selectedCompetencia, existingCostsInDb]);

  // Estatísticas do Lote Selecionado
  const selectedStats = useMemo(() => {
    const selected = stagingRows.filter((r) => r.isSelected && r.competencia.slice(0, 7) === selectedCompetencia.slice(0, 7));
    const count = selected.length;
    let totalHolerite = 0;
    let totalOutrosRecebidos = 0;
    let totalDescontos = 0;
    let totalAdiantamento = 0;
    let totalVtRecebido = 0;
    let totalCesta = 0;
    let totalOutrosBeneficios = 0;
    let totalRecebido = 0;
    let totalLiquidoReal = 0;

    selected.forEach((r) => {
      const proventos = (r.valor_holerite || (r.valor_fixo + r.valor_hora_extra + r.valor_adicional_not)) + (r.valor_outros_recebidos || 0);
      const beneficios = (r.valor_vt || 0) + (r.valor_cesta || 0) + (r.valor_vr || 0) + (r.valor_adiantamento || 0) + (r.valor_bonus || 0) + (r.valor_ajuda_custo || 0);
      const desc = r.valor_descontos || 0;
      const rec = proventos + beneficios;
      const liq = rec - desc;

      totalHolerite += proventos;
      totalOutrosRecebidos += r.valor_outros_recebidos || 0;
      totalDescontos += desc;
      totalAdiantamento += r.valor_adiantamento || 0;
      totalVtRecebido += r.valor_vt || 0;
      totalCesta += r.valor_cesta || 0;
      totalOutrosBeneficios += (r.valor_vr || 0) + (r.valor_bonus || 0) + (r.valor_ajuda_custo || 0);
      totalRecebido += rec;
      totalLiquidoReal += liq;
    });

    return {
      count,
      totalHolerite,
      totalOutrosRecebidos,
      totalDescontos,
      totalAdiantamento,
      totalVtRecebido,
      totalCesta,
      totalOutrosBeneficios,
      totalRecebido,
      totalLiquidoReal,
    };
  }, [stagingRows, selectedCompetencia]);

  // 1. Processamento de Folha de Pagamento Oficial (PDF / Imagem via IA)
  const handleUploadPayrollFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setMergeSuccessMessage(null);
      setProcessingStatusText("Enviando arquivo e extraindo colaboradores da folha via IA...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "payroll");

      const response = await fetch("/api/people/parse-payroll-batch", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro no servidor (${response.status})`);
      }

      const result = await response.json();
      if (!result.records || !Array.isArray(result.records) || result.records.length === 0) {
        throw new Error("A IA não identificou colaboradores no documento.");
      }

      const comp = result.competencia || selectedCompetencia;
      setSelectedCompetencia(comp);

      // Converte registros para StagingCostRow cruzando com colaboradores existentes
      const newRows: StagingCostRow[] = result.records.map((rec: any, idx: number) => {
        const cleanName = (rec.name || "").trim();
        const cleanCpf = (rec.cpf || "").replace(/\D/g, "");

        let matchedEmp = cleanCpf
          ? existingEmployees.find((e) => (e.document_id || "").replace(/\D/g, "") === cleanCpf || (e.responsible_cpf || "").replace(/\D/g, "") === cleanCpf)
          : undefined;

        let matchType: "EXACT" | "SIMILAR" | "NEW" = "NEW";
        let matchScore = 0;
        let targetEmployeeId = "NEW";

        if (matchedEmp) {
          matchType = "EXACT";
          matchScore = 1.0;
          targetEmployeeId = matchedEmp.id;
        } else {
          const best = findBestNameMatch(cleanName, existingEmployees);
          if (best && best.matchedEmployeeId && (best.status === "EXACT" || best.status === "SIMILAR")) {
            matchType = best.status === "EXACT" ? "EXACT" : "SIMILAR";
            matchScore = best.similarity;
            targetEmployeeId = best.matchedEmployeeId;
            matchedEmp = existingEmployees.find((e) => e.id === best.matchedEmployeeId);
          }
        }

        const holeriteBruto = rec.valor_holerite || (rec.valor_fixo + (rec.valor_hora_extra || 0) + (rec.valor_adicional_not || 0));
        const descontosTotal = rec.valor_descontos || ((rec.inss_empregado || 0) + (rec.irrf_empregado || 0) + (rec.desconto_vt_6 || 0));
        const folhaLiq = rec.valor_liquido || (holeriteBruto - descontosTotal);

        return {
          id: `payroll-${Date.now()}-${idx}`,
          targetEmployeeId,
          employeeName: cleanName || matchedEmp?.name || "Colaborador",
          documentId: rec.cpf || matchedEmp?.document_id || "",
          matchScore,
          matchType,
          cargo: rec.cargo || matchedEmp?.job_role || "",
          competencia: comp,
          sourceType: "PAYROLL_EXTRATO",
          valor_fixo: rec.valor_fixo || holeriteBruto,
          valor_holerite: holeriteBruto,
          valor_outros_recebidos: rec.outros_ajustes || 0,
          valor_adiantamento: rec.valor_adiantamento || 0,
          valor_hora_extra: rec.valor_hora_extra || 0,
          valor_adicional_not: rec.valor_adicional_not || 0,
          valor_vt: rec.valor_vt || 0,
          desconto_vt_6: rec.desconto_vt_6 || 0,
          valor_cesta: rec.valor_cesta || 0,
          valor_vr: rec.valor_vr || 0,
          valor_bonus: rec.valor_bonus || 0,
          valor_ajuda_custo: rec.valor_ajuda_custo || 0,
          valor_ferias: rec.valor_ferias || 0,
          valor_rescisao: rec.valor_rescisao || 0,
          valor_decimo_terceiro: rec.valor_decimo_terceiro || 0,
          valor_descontos: descontosTotal,
          inss_empregado: rec.inss_empregado || 0,
          irrf_empregado: rec.irrf_empregado || 0,
          valor_faltas: rec.valor_faltas || 0,
          dias_faltas: rec.dias_faltas || 0,
          valor_consignado: rec.valor_consignado || 0,
          valor_pensao_alimenticia: rec.valor_pensao_alimenticia || 0,
          valor_fgts: rec.valor_fgts || 0,
          folha_liquido: folhaLiq,
          observacao: rec.observacao || "",
          isSelected: true,
        };
      });

      setStagingRows(newRows);
    } catch (err: any) {
      console.error("Erro ao importar folha por IA:", err);
      setErrorMessage(err.message || "Falha ao processar o arquivo da folha.");
    } finally {
      setIsProcessing(false);
      setProcessingStatusText("");
    }
  };

  // 2. Processamento de Folha de Adiantamento Salarial (PDF / Imagem via IA)
  const handleUploadAdvanceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setMergeSuccessMessage(null);
      setProcessingStatusText("Extraindo adiantamentos salariais via IA...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "advance");

      const response = await fetch("/api/people/parse-payroll-batch", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro no servidor (${response.status})`);
      }

      const result = await response.json();
      if (!result.records || !Array.isArray(result.records) || result.records.length === 0) {
        throw new Error("A IA não identificou colaboradores no documento de adiantamento.");
      }

      const comp = result.competencia || selectedCompetencia;
      if (comp) setSelectedCompetencia(comp);

      // Se JÁ houver registros no staging, executa a mesclagem inteligente!
      if (stagingRows.length > 0) {
        let matchedCount = 0;
        setStagingRows((prev) =>
          prev.map((r) => {
            const cleanCpfRow = (r.documentId || "").replace(/\D/g, "");
            const matchRec = result.records.find((rec: any) => {
              const recCpf = (rec.cpf || "").replace(/\D/g, "");
              if (recCpf && cleanCpfRow && recCpf === cleanCpfRow) return true;
              return findBestNameMatch(rec.name || "", [{ id: r.targetEmployeeId, name: r.employeeName } as any])?.similarity > 0.82;
            });

            if (matchRec && (matchRec.valor_adiantamento !== undefined && matchRec.valor_adiantamento !== null)) {
              matchedCount++;
              return {
                ...r,
                valor_adiantamento: matchRec.valor_adiantamento || r.valor_adiantamento,
              };
            }
            return r;
          })
        );
        setMergeSuccessMessage(`✨ Adiantamentos mesclados com sucesso para ${matchedCount} colaboradores no grid.`);
      } else {
        // Se o grid estiver vazio, cria linhas no staging com os adiantamentos
        const newRows: StagingCostRow[] = result.records.map((rec: any, idx: number) => {
          const cleanName = (rec.name || "").trim();
          const cleanCpf = (rec.cpf || "").replace(/\D/g, "");

          let matchedEmp = cleanCpf
            ? existingEmployees.find((e) => (e.document_id || "").replace(/\D/g, "") === cleanCpf || (e.responsible_cpf || "").replace(/\D/g, "") === cleanCpf)
            : undefined;

          let matchType: "EXACT" | "SIMILAR" | "NEW" = "NEW";
          let matchScore = 0;
          let targetEmployeeId = "NEW";

          if (matchedEmp) {
            matchType = "EXACT";
            matchScore = 1.0;
            targetEmployeeId = matchedEmp.id;
          } else {
            const best = findBestNameMatch(cleanName, existingEmployees);
            if (best && best.matchedEmployeeId && (best.status === "EXACT" || best.status === "SIMILAR")) {
              matchType = best.status === "EXACT" ? "EXACT" : "SIMILAR";
              matchScore = best.similarity;
              targetEmployeeId = best.matchedEmployeeId;
              matchedEmp = existingEmployees.find((e) => e.id === best.matchedEmployeeId);
            }
          }

          const fixoBase = matchedEmp?.remuneration_fixed || matchedEmp?.remuneration || 0;

          return {
            id: `advance-${Date.now()}-${idx}`,
            targetEmployeeId,
            employeeName: cleanName || matchedEmp?.name || "Colaborador",
            documentId: rec.cpf || matchedEmp?.document_id || "",
            matchScore,
            matchType,
            cargo: rec.cargo || matchedEmp?.job_role || "",
            competencia: comp || selectedCompetencia,
            sourceType: "ADVANCE_PDF",
            valor_fixo: fixoBase,
            valor_holerite: fixoBase,
            valor_outros_recebidos: 0,
            valor_adiantamento: rec.valor_adiantamento || 0,
            valor_hora_extra: 0,
            valor_adicional_not: 0,
            valor_vt: 0,
            desconto_vt_6: 0,
            valor_cesta: 0,
            valor_vr: 0,
            valor_bonus: 0,
            valor_ajuda_custo: 0,
            valor_ferias: 0,
            valor_rescisao: 0,
            valor_decimo_terceiro: 0,
            valor_descontos: 0,
            inss_empregado: 0,
            irrf_empregado: 0,
            valor_faltas: 0,
            dias_faltas: 0,
            valor_consignado: 0,
            valor_pensao_alimenticia: 0,
            valor_fgts: 0,
            folha_liquido: fixoBase + (rec.valor_adiantamento || 0),
            observacao: rec.observacao || "Importado de Folha de Adiantamento Salarial",
            isSelected: true,
          };
        });

        setStagingRows(newRows);
        setMergeSuccessMessage(`✨ Sucesso! ${newRows.length} colaboradores carregados a partir da Folha de Adiantamento.`);
      }
    } catch (err: any) {
      console.error("Erro ao importar adiantamento por IA:", err);
      setErrorMessage(err.message || "Falha ao processar arquivo de adiantamento.");
    } finally {
      setIsProcessing(false);
      setProcessingStatusText("");
    }
  };

  // 3. Processamento de Relatório de Benefícios (PDF / Imagem via IA)
  const handleUploadBenefitsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setMergeSuccessMessage(null);
      setProcessingStatusText("Extraindo relatório de benefícios via IA...");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "benefits");

      const response = await fetch("/api/people/parse-payroll-batch", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro no servidor (${response.status})`);
      }

      const result = await response.json();
      if (!result.records || !Array.isArray(result.records) || result.records.length === 0) {
        throw new Error("A IA não identificou colaboradores no documento de benefícios.");
      }

      const comp = result.competencia || selectedCompetencia;
      if (comp) setSelectedCompetencia(comp);

      if (stagingRows.length > 0) {
        let matchedCount = 0;
        setStagingRows((prev) =>
          prev.map((r) => {
            const cleanCpfRow = (r.documentId || "").replace(/\D/g, "");
            const matchRec = result.records.find((rec: any) => {
              const recCpf = (rec.cpf || "").replace(/\D/g, "");
              if (recCpf && cleanCpfRow && recCpf === cleanCpfRow) return true;
              return findBestNameMatch(rec.name || "", [{ id: r.targetEmployeeId, name: r.employeeName } as any])?.similarity > 0.82;
            });

            if (matchRec) {
              matchedCount++;
              return {
                ...r,
                valor_vt: matchRec.valor_vt !== undefined && matchRec.valor_vt > 0 ? matchRec.valor_vt : r.valor_vt,
                valor_cesta: matchRec.valor_cesta !== undefined && matchRec.valor_cesta > 0 ? matchRec.valor_cesta : r.valor_cesta,
                valor_vr: matchRec.valor_vr !== undefined && matchRec.valor_vr > 0 ? matchRec.valor_vr : r.valor_vr,
                valor_bonus: matchRec.valor_bonus !== undefined && matchRec.valor_bonus > 0 ? matchRec.valor_bonus : r.valor_bonus,
                valor_ajuda_custo: matchRec.valor_ajuda_custo !== undefined && matchRec.valor_ajuda_custo > 0 ? matchRec.valor_ajuda_custo : r.valor_ajuda_custo,
              };
            }
            return r;
          })
        );
        setMergeSuccessMessage(`✨ Benefícios mesclados com sucesso para ${matchedCount} colaboradores no grid.`);
      } else {
        const newRows: StagingCostRow[] = result.records.map((rec: any, idx: number) => {
          const cleanName = (rec.name || "").trim();
          const cleanCpf = (rec.cpf || "").replace(/\D/g, "");

          let matchedEmp = cleanCpf
            ? existingEmployees.find((e) => (e.document_id || "").replace(/\D/g, "") === cleanCpf || (e.responsible_cpf || "").replace(/\D/g, "") === cleanCpf)
            : undefined;

          let matchType: "EXACT" | "SIMILAR" | "NEW" = "NEW";
          let matchScore = 0;
          let targetEmployeeId = "NEW";

          if (matchedEmp) {
            matchType = "EXACT";
            matchScore = 1.0;
            targetEmployeeId = matchedEmp.id;
          } else {
            const best = findBestNameMatch(cleanName, existingEmployees);
            if (best && best.matchedEmployeeId && (best.status === "EXACT" || best.status === "SIMILAR")) {
              matchType = best.status === "EXACT" ? "EXACT" : "SIMILAR";
              matchScore = best.similarity;
              targetEmployeeId = best.matchedEmployeeId;
              matchedEmp = existingEmployees.find((e) => e.id === best.matchedEmployeeId);
            }
          }

          const fixoBase = matchedEmp?.remuneration_fixed || matchedEmp?.remuneration || 0;

          return {
            id: `benefit-${Date.now()}-${idx}`,
            targetEmployeeId,
            employeeName: cleanName || matchedEmp?.name || "Colaborador",
            documentId: rec.cpf || matchedEmp?.document_id || "",
            matchScore,
            matchType,
            cargo: rec.cargo || matchedEmp?.job_role || "",
            competencia: comp || selectedCompetencia,
            sourceType: "BENEFICIOS_PDF",
            valor_fixo: fixoBase,
            valor_holerite: fixoBase,
            valor_outros_recebidos: 0,
            valor_adiantamento: 0,
            valor_hora_extra: 0,
            valor_adicional_not: 0,
            valor_vt: rec.valor_vt || 0,
            desconto_vt_6: 0,
            valor_cesta: rec.valor_cesta || 0,
            valor_vr: rec.valor_vr || 0,
            valor_bonus: rec.valor_bonus || 0,
            valor_ajuda_custo: rec.valor_ajuda_custo || 0,
            valor_ferias: 0,
            valor_rescisao: 0,
            valor_decimo_terceiro: 0,
            valor_descontos: 0,
            inss_empregado: 0,
            irrf_empregado: 0,
            valor_faltas: 0,
            dias_faltas: 0,
            valor_consignado: 0,
            valor_pensao_alimenticia: 0,
            valor_fgts: 0,
            folha_liquido: fixoBase + (rec.valor_vt || 0) + (rec.valor_cesta || rec.valor_vr || 0) + (rec.valor_bonus || 0),
            observacao: rec.observacao || "Importado de relatório de benefícios",
            isSelected: true,
          };
        });

        setStagingRows(newRows);
        setMergeSuccessMessage(`✨ Sucesso! ${newRows.length} colaboradores carregados a partir do relatório de benefícios.`);
      }
    } catch (err: any) {
      console.error("Erro ao importar benefícios por IA:", err);
      setErrorMessage(err.message || "Falha ao processar arquivo de benefícios.");
    } finally {
      setIsProcessing(false);
      setProcessingStatusText("");
    }
  };

  // 4. Processamento de Planilha Histórica Excel (.xlsx / .csv)
  const handleUploadExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setMergeSuccessMessage(null);
      setProcessingStatusText("Lendo planilha histórica e mapeando competências...");

      const parseResult = await parseCltFile(file, file.name);
      processExcelParseResult(parseResult);
    } catch (err: any) {
      console.error("Erro ao processar planilha Excel:", err);
      setErrorMessage(err.message || "Falha ao ler a planilha Excel.");
    } finally {
      setIsProcessing(false);
      setProcessingStatusText("");
    }
  };

  const handleLoadDefaultClt = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setMergeSuccessMessage(null);
      setProcessingStatusText("Carregando planilha padrão public/CLT.xlsx...");

      const res = await fetch("/CLT.xlsx");
      if (!res.ok) throw new Error("Planilha padrão public/CLT.xlsx não encontrada.");
      const buffer = await res.arrayBuffer();
      const parseResult = await parseCltFile(buffer, "CLT.xlsx");
      processExcelParseResult(parseResult);
    } catch (err: any) {
      console.error("Erro ao carregar CLT.xlsx:", err);
      setErrorMessage(err.message || "Erro ao carregar arquivo padrão.");
    } finally {
      setIsProcessing(false);
      setProcessingStatusText("");
    }
  };

  const processExcelParseResult = (parseResult: CltParseResult) => {
    const rows: StagingCostRow[] = [];

    parseResult.employees.forEach((pEmp, empIdx) => {
      const best = findBestNameMatch(pEmp.cleanName, existingEmployees);
      let targetEmployeeId = "NEW";
      let matchType: "EXACT" | "SIMILAR" | "NEW" = "NEW";
      let matchScore = 0;
      let matchedEmp: Employee | undefined = undefined;

      if (best && best.matchedEmployeeId && (best.status === "EXACT" || best.status === "SIMILAR")) {
        matchType = best.status === "EXACT" ? "EXACT" : "SIMILAR";
        matchScore = best.similarity;
        targetEmployeeId = best.matchedEmployeeId;
        matchedEmp = existingEmployees.find((e) => e.id === best.matchedEmployeeId);
      }

      for (const comp in pEmp.costsByCompetencia) {
        const c = pEmp.costsByCompetencia[comp];
        rows.push({
          id: `excel-${empIdx}-${comp}-${Date.now()}`,
          targetEmployeeId,
          employeeName: pEmp.cleanName || matchedEmp?.name || "Colaborador",
          documentId: matchedEmp?.document_id || "",
          matchScore,
          matchType,
          cargo: pEmp.ultimoCargo || pEmp.cargoInicial || matchedEmp?.job_role || "",
          competencia: comp,
          sourceType: "EXCEL_RETROATIVO",
          valor_fixo: c.valor_fixo,
          valor_holerite: c.valor_fixo,
          valor_outros_recebidos: c.outros_ajustes || 0,
          valor_adiantamento: c.valor_adiantamento || 0,
          valor_hora_extra: c.valor_hora_extra,
          valor_adicional_not: c.valor_adicional_not,
          valor_vt: c.valor_vt,
          desconto_vt_6: 0,
          valor_cesta: c.valor_cesta,
          valor_vr: c.valor_vr,
          valor_bonus: c.valor_bonus,
          valor_ajuda_custo: c.valor_ajuda_custo,
          valor_ferias: c.valor_ferias,
          valor_rescisao: c.valor_rescisao,
          valor_decimo_terceiro: c.valor_decimo_terceiro,
          valor_descontos: c.valor_descontos,
          inss_empregado: 0,
          irrf_empregado: 0,
          valor_faltas: 0,
          dias_faltas: 0,
          valor_consignado: 0,
          valor_pensao_alimenticia: 0,
          valor_fgts: 0,
          folha_liquido: c.total_liquido,
          observacao: "Planilha Histórica",
          isSelected: true,
        });
      }
    });

    setStagingRows(rows);
    setMergeSuccessMessage(`✨ ${rows.length} lançamentos de competência carregados da Planilha Excel.`);
  };

  // Atualização inline de qualquer campo
  const handleUpdateRowField = (rowId: string, field: keyof StagingCostRow, val: any) => {
    setStagingRows((prev) =>
      prev.map((r) => {
        if (r.id === rowId) {
          return { ...r, [field]: val };
        }
        return r;
      })
    );
  };

  // Excluir linha do staging
  const handleDeleteRow = (rowId: string) => {
    setStagingRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Selecionar / Desmarcar todos da competência visível
  const handleToggleSelectAll = () => {
    const allSelected = visibleRows.every((r) => r.isSelected);
    const visibleIds = new Set(visibleRows.map((r) => r.id));
    setStagingRows((prev) =>
      prev.map((r) => (visibleIds.has(r.id) ? { ...r, isSelected: !allSelected } : r))
    );
  };

  // Preenchimento em massa de VT
  const handleApplyBulkVt = () => {
    const val = parseFloat(bulkVtValue);
    if (isNaN(val) || val < 0) {
      alert("Informe um valor numérico válido para o VT.");
      return;
    }
    setStagingRows((prev) =>
      prev.map((r) =>
        r.competencia.slice(0, 7) === selectedCompetencia.slice(0, 7) && r.isSelected
          ? { ...r, valor_vt: val }
          : r
      )
    );
  };

  // Preenchimento em massa de VR / Cesta
  const handleApplyBulkCesta = () => {
    const val = parseFloat(bulkCestaValue);
    if (isNaN(val) || val < 0) {
      alert("Informe um valor numérico válido para VR / Cesta.");
      return;
    }
    setStagingRows((prev) =>
      prev.map((r) =>
        r.competencia.slice(0, 7) === selectedCompetencia.slice(0, 7) && r.isSelected
          ? { ...r, valor_cesta: val }
          : r
      )
    );
  };

  // Copiar benefícios (VT, VR/Cesta) do mês anterior cadastrado no Supabase
  const handleCopyPreviousBenefits = async () => {
    try {
      setIsLoadingPreviousBenefits(true);
      const [yearStr, monthStr] = selectedCompetencia.split("-");
      let year = parseInt(yearStr, 10);
      let month = parseInt(monthStr, 10) - 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
      const prevComp = `${year}-${String(month).padStart(2, "0")}-01`;

      const prevCosts = await PeopleHRService.getMonthlyCostsByCompetencia(prevComp);
      if (!prevCosts || prevCosts.length === 0) {
        alert(`Nenhum lançamento encontrado na competência anterior (${prevComp}).`);
        return;
      }

      const prevMap = new Map<string, MonthlyCost>();
      prevCosts.forEach((c) => prevMap.set(c.employee_id, c));

      let matchedCount = 0;
      setStagingRows((prev) =>
        prev.map((r) => {
          if (r.competencia.slice(0, 7) === selectedCompetencia.slice(0, 7) && r.targetEmployeeId !== "NEW") {
            const prevCost = prevMap.get(r.targetEmployeeId);
            if (prevCost) {
              matchedCount++;
              return {
                ...r,
                valor_vt: prevCost.valor_vt || r.valor_vt,
                valor_cesta: prevCost.valor_cesta || r.valor_cesta,
                valor_vr: prevCost.valor_vr || r.valor_vr,
                valor_ajuda_custo: prevCost.valor_ajuda_custo || r.valor_ajuda_custo,
              };
            }
          }
          return r;
        })
      );

      alert(`Benefícios copiados com sucesso para ${matchedCount} colaboradores da competência ${prevComp}.`);
    } catch (err: any) {
      console.error("Erro ao buscar benefícios da competência anterior:", err);
      alert("Falha ao buscar benefícios anteriores: " + (err.message || err));
    } finally {
      setIsLoadingPreviousBenefits(false);
    }
  };

  // 5. Gravação Final no Custo Histórico (Supabase) com trava e verificação de correção
  const handleCommitBatch = async (forceOverwrite: boolean = false, skipExisting: boolean = false) => {
    let selected = stagingRows.filter((r) => r.isSelected);
    if (selected.length === 0) {
      alert("Selecione pelo menos um colaborador para gravar.");
      return;
    }

    // REGRA DE SEGURANÇA ABSOLUTA (RISCO ZERO):
    // Nunca permitir alteração de lançamentos CLT anteriores a Junho/2026
    const invalidHistoricalClt = selected.filter((r) => r.competencia < "2026-06-01");
    if (invalidHistoricalClt.length > 0) {
      alert("BLOQUEIO DE SEGURANÇA (Risco Zero Ativado):\nLançamentos CLT anteriores a Junho/2026 são registros históricos consolidados e não podem ser alterados ou sobrescritos.");
      return;
    }

    if (!forceOverwrite && !skipExisting) {
      const conflicts = selected
        .filter((r) => r.targetEmployeeId !== "NEW" && existingCostsInDb.has(r.targetEmployeeId))
        .map((r) => ({
          row: r,
          existingCost: existingCostsInDb.get(r.targetEmployeeId)!,
        }));

      if (conflicts.length > 0) {
        // Inicializa todas as decisões como 'ACCEPT_NEW' por padrão
        const initialDecisions: Record<string, "ACCEPT_NEW" | "KEEP_DB"> = {};
        conflicts.forEach((c) => {
          initialDecisions[c.row.id] = "ACCEPT_NEW";
        });
        setConflictDecisions(initialDecisions);
        setConflictingRows(conflicts);
        setShowCorrectionModal(true);
        return;
      }
    }

    if (skipExisting) {
      selected = selected.filter((r) => r.targetEmployeeId === "NEW" || !existingCostsInDb.has(r.targetEmployeeId));
      if (selected.length === 0) {
        alert("Todos os colaboradores selecionados já possuem lançamento nesta competência. Nenhum novo registro a salvar.");
        setShowCorrectionModal(false);
        return;
      }
    }

    setShowCorrectionModal(false);
    executeSaveRows(selected);
  };

  // Confirmação com base nas decisões lado a lado do usuário
  const handleConfirmConflictDecisions = () => {
    let selected = stagingRows.filter((r) => r.isSelected);

    // Filtra: se estava em conflito e usuário escolheu KEEP_DB, remove do lote para não alterar o banco!
    const filteredToSave = selected.filter((r) => {
      const hasConflict = r.targetEmployeeId !== "NEW" && existingCostsInDb.has(r.targetEmployeeId);
      if (hasConflict) {
        return conflictDecisions[r.id] === "ACCEPT_NEW";
      }
      return true;
    });

    if (filteredToSave.length === 0) {
      alert("Todos os lançamentos em conflito foram mantidos com os valores atuais do banco. Nenhum novo dado a salvar.");
      setShowCorrectionModal(false);
      return;
    }

    setShowCorrectionModal(false);
    executeSaveRows(filteredToSave);
  };

  const executeSaveRows = async (rowsToSave: StagingCostRow[]) => {
    try {
      setIsCommitting(true);
      setCommitProgress(0);

      const batchToSave: Partial<MonthlyCost>[] = [];
      const total = rowsToSave.length;
      let count = 0;

      for (const row of rowsToSave) {
        count++;
        setCommitProgress(Math.round((count / total) * 100));

        let finalEmployeeId = row.targetEmployeeId;

        if (finalEmployeeId === "NEW") {
          const created = await PeopleHRService.insertEmployee({
            name: row.employeeName,
            corporate_name: row.employeeName,
            company: "MarBR",
            linkType: "CLT",
            status: "Ativo",
            job_role: row.cargo || "Colaborador",
            document_id: row.documentId || undefined,
            remuneration_fixed: row.valor_fixo || row.valor_holerite,
            remuneration: row.valor_fixo || row.valor_holerite,
          });
          if (created && created.id) {
            finalEmployeeId = created.id;
          }
        }

        if (finalEmployeeId && finalEmployeeId !== "NEW") {
          // Cálculo financeiro dos 5 Pilares Executivos:
          // Pilar 1: Total Proventos Brutos da Folha
          const proventos = (row.valor_holerite || (row.valor_fixo + row.valor_hora_extra + row.valor_adicional_not)) + (row.valor_outros_recebidos || 0);
          // Pilar 2: Total Descontos da Folha
          const totalDescontos = row.valor_descontos || 0;
          // Pilar 3: Salário Líquido da Folha
          const folhaLiquido = proventos - totalDescontos;
          // Pilar 4: Extra-folha (Adiantamento + Benefícios)
          const adiantamento = row.valor_adiantamento || 0;
          const beneficiosExtras = (row.valor_vt || 0) + (row.valor_cesta || 0) + (row.valor_vr || 0) + (row.valor_bonus || 0) + (row.valor_ajuda_custo || 0);
          // Pilar 5: Total Real Pago / Desembolsado
          const liquidoReal = folhaLiquido + adiantamento + beneficiosExtras;

          batchToSave.push({
            employee_id: finalEmployeeId,
            competencia: row.competencia,
            vinculo_tipo: "CLT",
            valor_fixo: row.valor_fixo,
            valor_holerite: proventos,
            valor_adiantamento: adiantamento, // Adiantamento Salarial quinzenal (nunca de férias)
            outros_ajustes: row.valor_outros_recebidos,
            valor_hora_extra: row.valor_hora_extra,
            valor_adicional_not: row.valor_adicional_not,
            valor_vt: row.valor_vt,
            valor_cesta: row.valor_cesta,
            valor_vr: row.valor_vr,
            valor_bonus: row.valor_bonus,
            valor_ajuda_custo: row.valor_ajuda_custo,
            valor_ferias: row.valor_ferias,
            valor_rescisao: row.valor_rescisao,
            valor_decimo_terceiro: row.valor_decimo_terceiro,
            valor_descontos: totalDescontos,
            inss_empregado: row.inss_empregado,
            irrf_empregado: row.irrf_empregado,
            valor_faltas: row.valor_faltas,
            dias_faltas: row.dias_faltas,
            valor_consignado: row.valor_consignado,
            valor_pensao_alimenticia: row.valor_pensao_alimenticia,
            valor_fgts: row.valor_fgts,
            valor_liquido: liquidoReal,
            origem: row.sourceType === "PAYROLL_EXTRATO" ? "manual" : (row.sourceType === "EXCEL_RETROATIVO" ? "csv" : "manual"),
            observacao: row.observacao || "Importado via Central de Ingestão de Custos",
          });
        }
      }

      await PeopleHRService.saveMonthlyCostsBatch(batchToSave);

      alert(`Sucesso! ${batchToSave.length} lançamentos gravados no Custo Histórico com conciliação executiva.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao gravar custos mensais:", err);
      alert("Erro ao gravar lançamentos: " + (err.message || err));
    } finally {
      setIsCommitting(false);
      setCommitProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                Central de Ingestão e Conciliação de Custos
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Dual Source + Adiantamento & Benefícios
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Alimente a competência a partir da Folha Oficial, Folha de Adiantamento, Relatórios de Benefícios ou Planilha Excel com auditoria e edição antes de gravar.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* FEEDBACK DE MENSAGENS E SUCESSO DE MESCLAGEM */}
        {mergeSuccessMessage && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span className="font-bold">{mergeSuccessMessage}</span>
            </div>
            <button
              onClick={() => setMergeSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 text-[10px] font-black uppercase"
            >
              OK
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-800 text-[10px] font-black uppercase"
            >
              Fechar
            </button>
          </div>
        )}

        {/* ÁREA CENTRAL */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {stagingRows.length === 0 ? (
            /* VISÃO INICIAL: 4 CARDS DE ESCOLHA DA FONTE */
            <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
              <div className="text-center max-w-xl mx-auto mb-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Passo 1 • Escolha a Fonte de Alimentação
                </span>
                <h4 className="text-xl font-black text-slate-900 dark:text-white mt-2">
                  De onde você deseja importar os dados desta competência?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Você pode iniciar por qualquer fonte e depois mesclar as demais com 1 clique.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
                {/* CARD 1: FOLHA MENSAL */}
                <div className="bg-gradient-to-b from-emerald-500/5 to-transparent border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl p-5 flex flex-col justify-between hover:border-emerald-500 transition-all shadow-sm group">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <FileText size={22} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Recomendado • Recente
                      </span>
                    </div>

                    <h5 className="text-sm font-black text-slate-900 dark:text-white">
                      Folha Mensal (PDF/Foto)
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Envie o extrato mensal da folha de pagamento. A IA extrai salários, proventos, INSS, IRRF e descontos com precisão centavo a centavo.
                    </p>
                  </div>

                  <div className="pt-5">
                    <label className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer">
                      <Upload size={14} />
                      <span>Carregar Folha Mensal</span>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg"
                        onChange={handleUploadPayrollFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* CARD 2: FOLHA DE ADIANTAMENTO (NOVO!) */}
                <div className="bg-gradient-to-b from-blue-500/5 to-transparent border-2 border-blue-500/30 dark:border-blue-500/20 rounded-3xl p-5 flex flex-col justify-between hover:border-blue-500 transition-all shadow-sm group">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Banknote size={22} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Vales Quinzenais
                      </span>
                    </div>

                    <h5 className="text-sm font-black text-slate-900 dark:text-white">
                      Folha de Adiantamento (PDF/Foto)
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Envie a folha de adiantamento salarial quinzenal. Lê os valores líquidos concedidos a cada colaborador para alimentar a coluna de adiantamento.
                    </p>
                  </div>

                  <div className="pt-5">
                    <label className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer">
                      <Upload size={14} />
                      <span>Carregar Adiantamentos</span>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg"
                        onChange={handleUploadAdvanceFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* CARD 3: PLANILHA DE BENEFÍCIOS */}
                <div className="bg-gradient-to-b from-amber-500/5 to-transparent border-2 border-amber-500/30 dark:border-amber-500/20 rounded-3xl p-5 flex flex-col justify-between hover:border-amber-500 transition-all shadow-sm group">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Gift size={22} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        VT, VR/Cesta & Bônus
                      </span>
                    </div>

                    <h5 className="text-sm font-black text-slate-900 dark:text-white">
                      Benefícios & Bônus (PDF)
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Importe relatórios de recarga de VT (Sodexo, Top), VR, Cesta ou Bonificação. Lê valores concedidos e permite complementar ou mesclar com o grid.
                    </p>
                  </div>

                  <div className="pt-5">
                    <label className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer">
                      <Upload size={14} />
                      <span>Carregar Benefícios</span>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg"
                        onChange={handleUploadBenefitsFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* CARD 4: PLANILHA EXCEL RETROATIVA */}
                <div className="bg-gradient-to-b from-slate-500/5 to-transparent border-2 border-slate-300 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-slate-400 transition-all shadow-sm group">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-2xl bg-slate-500/15 text-slate-600 dark:text-slate-400 flex items-center justify-center">
                        <FileSpreadsheet size={22} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                        Retroativos • Excel
                      </span>
                    </div>

                    <h5 className="text-sm font-black text-slate-900 dark:text-white">
                      Planilha Excel (.xlsx)
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Importe histórico dos anos anteriores com meses em colunas e verbas em linhas (Holerite, VT recebido, VR/Cesta, Descontos, Total).
                    </p>
                  </div>

                  <div className="pt-5 space-y-2">
                    <label className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer">
                      <Upload size={14} />
                      <span>Carregar Excel</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleUploadExcelFile}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleLoadDefaultClt}
                      className="w-full py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 transition-all text-center block"
                    >
                      Usar CLT.xlsx do Sistema
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD DE ORIENTAÇÃO PEDAGÓGICA */}
              <div className="max-w-4xl mx-auto mt-8 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
                <Info size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <span className="font-black text-emerald-800 dark:text-emerald-300 block">
                    Equilíbrio Perfeito entre as Fontes & Regras de Negócio:
                  </span>
                  <p>
                    • <strong>Folha Mensal:</strong> Traz o Salário Fixo, Proventos, Desconto legal dos 6% de VT (rubrica 48) e deduções oficiais.<br />
                    • <strong>Folha de Adiantamento:</strong> Traz os adiantamentos concedidos quinzenalmente para alimentar a coluna Adiantamento Folha.<br />
                    • <strong>Benefícios / Bonificação:</strong> Traz o valor do VT real recarregado e VR/Cesta concedida.<br />
                    • <strong>Edição Total:</strong> Você pode ajustar qualquer valor diretamente nas células da tabela ou no botão de lápis (✏️).
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* VISÃO DO GRID DE STAGING E AUDITORIA */
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* BARRA SUPERIOR DE FILTROS E AÇÕES EM MASSA */}
              <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
                
                {/* SELETOR DE COMPETÊNCIA */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 shadow-2xs">
                    <Calendar size={14} className="text-emerald-600" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Competência:</span>
                    <input
                      type="month"
                      value={selectedCompetencia.slice(0, 7)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedCompetencia(`${e.target.value}-01`);
                        }
                      }}
                      className="text-xs font-black bg-transparent text-slate-900 dark:text-white outline-none cursor-pointer"
                    />
                  </div>

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar colaborador no lote..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 text-slate-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    {visibleRows.every((r) => r.isSelected) ? (
                      <CheckSquare size={14} className="text-emerald-600" />
                    ) : (
                      <Square size={14} className="text-slate-400" />
                    )}
                    <span>Marcar Todos</span>
                  </button>
                </div>

                {/* FERRAMENTAS DE MESCLAGEM E PREENCHIMENTO EM MASSA */}
                <div className="flex items-center gap-2 flex-wrap">
                  
                  {/* MESCLAR FOLHA DE ADIANTAMENTO (NOVO!) */}
                  <label className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-black rounded-xl hover:bg-blue-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs">
                    <Banknote size={13} className="text-blue-600" />
                    <span>Mesclar Folha de Adiantamento</span>
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg"
                      onChange={handleUploadAdvanceFile}
                      className="hidden"
                    />
                  </label>

                  {/* MESCLAR BENEFÍCIOS PDF */}
                  <label className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-black rounded-xl hover:bg-amber-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs">
                    <Gift size={13} className="text-amber-600" />
                    <span>Mesclar PDF de Benefícios</span>
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg"
                      onChange={handleUploadBenefitsFile}
                      className="hidden"
                    />
                  </label>

                  {/* VT Padrão */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800/60 rounded-xl px-2 py-1 shadow-2xs">
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase">VT R$:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="273.00"
                      value={bulkVtValue}
                      onChange={(e) => setBulkVtValue(e.target.value)}
                      className="w-14 px-1.5 py-0.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-right outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulkVt}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded uppercase transition-all"
                    >
                      Aplicar
                    </button>
                  </div>

                  {/* VR / Cesta Padrão */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 rounded-xl px-2 py-1 shadow-2xs">
                    <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase">VR/Cesta R$:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="500.00"
                      value={bulkCestaValue}
                      onChange={(e) => setBulkCestaValue(e.target.value)}
                      className="w-14 px-1.5 py-0.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-right outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulkCesta}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black rounded uppercase transition-all"
                    >
                      Aplicar
                    </button>
                  </div>

                  {/* Copiar do Mês Anterior */}
                  <button
                    type="button"
                    onClick={handleCopyPreviousBenefits}
                    disabled={isLoadingPreviousBenefits}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-2xs"
                    title="Copiar VT e VR/Cesta do mês anterior do Supabase"
                  >
                    <Copy size={13} />
                    <span>{isLoadingPreviousBenefits ? "Copiando..." : "Copiar Mês Anterior"}</span>
                  </button>
                </div>
              </div>

              {/* CARDS COM OS 3 PILARES EXECUTIVOS DO LOTE */}
              <div className="p-3 bg-slate-100/70 dark:bg-slate-850/50 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Colaboradores</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedStats.count}</span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[9px] font-black text-slate-500 uppercase block">Salários / Proventos</span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300 tabular-nums">
                    {formatCurrency(selectedStats.totalHolerite)}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/50">
                  <span className="text-[9px] font-black text-blue-600 uppercase block">Adiantamento Folha</span>
                  <span className="text-sm font-black text-blue-700 dark:text-blue-300 tabular-nums">
                    +{formatCurrency(selectedStats.totalAdiantamento)}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-900/50">
                  <span className="text-[9px] font-black text-rose-600 uppercase block">Total Descontos</span>
                  <span className="text-sm font-black text-rose-700 dark:text-rose-400 tabular-nums">
                    -{formatCurrency(selectedStats.totalDescontos)}
                  </span>
                </div>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase block">
                    1. Total Recebido
                  </span>
                  <span className="text-sm font-black text-emerald-800 dark:text-emerald-300 tabular-nums">
                    {formatCurrency(selectedStats.totalRecebido)}
                  </span>
                </div>
                <div className="p-2 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-800">
                  <span className="text-[9px] font-black text-teal-700 dark:text-teal-400 uppercase block">
                    3. Valor Líquido Real
                  </span>
                  <span className="text-sm font-black text-teal-800 dark:text-teal-300 tabular-nums">
                    {formatCurrency(selectedStats.totalLiquidoReal)}
                  </span>
                </div>
              </div>

              {/* TABELA DE STAGING / AUDITORIA COM INPUTS DIRETOS */}
              <div className="flex-1 overflow-y-auto overflow-x-auto p-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-850 z-10 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-2 py-2 w-7 text-center">
                        <button onClick={handleToggleSelectAll}>
                          {visibleRows.every((r) => r.isSelected) ? (
                            <CheckSquare size={15} className="text-emerald-600" />
                          ) : (
                            <Square size={15} className="text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Colaborador</th>
                      <th className="px-2 py-2 text-[10px] font-black uppercase text-slate-600 text-right">Salário Fixo (R$) ✏️</th>
                      <th className="px-2 py-2 text-[10px] font-black uppercase text-blue-600 text-right">Outros Recebidos ✏️</th>
                      <th className="px-2 py-2 text-[10px] font-black uppercase text-rose-600 text-right">Desc. Folha ✏️</th>
                      <th className="px-2 py-2 text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 text-right bg-blue-500/10 rounded-t">
                        Adiantamento Folha ✏️
                      </th>
                      <th className="px-2 py-2 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 text-right bg-emerald-500/10 rounded-t">
                        VT Recebido (R$) ✏️
                      </th>
                      <th className="px-2 py-2 text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 text-right bg-amber-500/10 rounded-t">
                        VR / Cesta (R$) ✏️
                      </th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 text-right">Total Recebido</th>
                      <th className="px-3 py-2 text-[10px] font-black uppercase text-teal-700 dark:text-teal-300 text-right">Líquido Real</th>
                      <th className="px-2 py-2 text-[10px] font-black uppercase text-slate-500 text-center">Vínculo</th>
                      <th className="px-2 py-2 text-[10px] font-black uppercase text-slate-500 text-center sticky right-0 bg-slate-100 dark:bg-slate-850">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleRows.map((row) => {
                      const proventos = (row.valor_holerite || (row.valor_fixo + row.valor_hora_extra + row.valor_adicional_not)) + (row.valor_outros_recebidos || 0);
                      const beneficiosExtras = (row.valor_vt || 0) + (row.valor_cesta || 0) + (row.valor_vr || 0) + (row.valor_adiantamento || 0) + (row.valor_bonus || 0) + (row.valor_ajuda_custo || 0);
                      const totalRecebidoRow = proventos + beneficiosExtras;
                      const totalDescRow = row.valor_descontos || 0;
                      const liquidoRealRow = totalRecebidoRow - totalDescRow;

                      const existingDbRecord = row.targetEmployeeId !== "NEW" ? existingCostsInDb.get(row.targetEmployeeId) : undefined;

                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors ${
                            !row.isSelected ? "opacity-40" : ""
                          } ${existingDbRecord ? "bg-amber-500/5 dark:bg-amber-950/10" : ""}`}
                        >
                          {/* Checkbox */}
                          <td className="px-2 py-2 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => handleUpdateRowField(row.id, "isSelected", !row.isSelected)}
                            >
                              {row.isSelected ? (
                                <CheckSquare size={15} className="text-emerald-600" />
                              ) : (
                                <Square size={15} className="text-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* Colaborador */}
                          <td className="px-3 py-2 align-middle">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs">
                                {row.employeeName}
                              </span>
                              {existingDbRecord && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  <AlertTriangle size={10} className="shrink-0" />
                                  Já Cadastrado ({formatCurrency(existingDbRecord.valor_liquido)})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {row.documentId && (
                                <span className="text-[10px] text-slate-400 font-mono">{row.documentId}</span>
                              )}
                              {row.cargo && (
                                <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
                                  • {row.cargo}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* SALÁRIO FIXO (EDITÁVEL INLINE) */}
                          <td className="px-2 py-2 text-right align-middle">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-slate-400 font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.valor_fixo === 0 ? "" : row.valor_fixo}
                                onChange={(e) =>
                                  handleUpdateRowField(row.id, "valor_fixo", parseFloat(e.target.value) || 0)
                                }
                                placeholder="0,00"
                                className="w-20 px-1.5 py-1 text-xs font-bold text-right text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                          </td>

                          {/* OUTROS VALORES RECEBIDOS (EDITÁVEL INLINE) */}
                          <td className="px-2 py-2 text-right align-middle">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-blue-500 font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.valor_outros_recebidos === 0 ? "" : row.valor_outros_recebidos}
                                onChange={(e) =>
                                  handleUpdateRowField(row.id, "valor_outros_recebidos", parseFloat(e.target.value) || 0)
                                }
                                placeholder="0,00"
                                className="w-20 px-1.5 py-1 text-xs font-bold text-right text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-800 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </td>

                          {/* DESCONTOS FOLHA (EDITÁVEL INLINE) */}
                          <td className="px-2 py-2 text-right align-middle bg-rose-500/5">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-rose-500 font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.valor_descontos === 0 ? "" : row.valor_descontos}
                                onChange={(e) =>
                                  handleUpdateRowField(row.id, "valor_descontos", parseFloat(e.target.value) || 0)
                                }
                                placeholder="0,00"
                                className="w-20 px-1.5 py-1 text-xs font-bold text-right text-rose-700 dark:text-rose-400 bg-white dark:bg-slate-950 border border-rose-300 dark:border-rose-700 rounded-lg outline-none focus:ring-1 focus:ring-rose-500"
                              />
                            </div>
                            {row.desconto_vt_6 > 0 && (
                              <span className="text-[9px] text-rose-400 block font-normal text-right mt-0.5">
                                Desc 6% VT: {formatCurrency(row.desconto_vt_6)}
                              </span>
                            )}
                          </td>

                          {/* ADIANTAMENTO FOLHA (EDITÁVEL INLINE) */}
                          <td className="px-2 py-2 text-right align-middle bg-blue-500/5">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.valor_adiantamento === 0 ? "" : row.valor_adiantamento}
                                onChange={(e) =>
                                  handleUpdateRowField(row.id, "valor_adiantamento", parseFloat(e.target.value) || 0)
                                }
                                placeholder="0,00"
                                className="w-20 px-1.5 py-1 text-xs font-black text-right text-blue-800 dark:text-blue-300 bg-white dark:bg-slate-950 border border-blue-400 dark:border-blue-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            </div>
                          </td>

                          {/* VT RECEBIDO EFETIVO (EDITÁVEL INLINE) */}
                          <td className="px-2 py-2 text-right align-middle bg-emerald-500/5">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.valor_vt === 0 ? "" : row.valor_vt}
                                onChange={(e) =>
                                  handleUpdateRowField(row.id, "valor_vt", parseFloat(e.target.value) || 0)
                                }
                                placeholder="0,00"
                                className="w-20 px-1.5 py-1 text-xs font-black text-right text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20"
                              />
                            </div>
                          </td>

                          {/* VR / CESTA (EDITÁVEL INLINE) */}
                          <td className="px-2 py-2 text-right align-middle bg-amber-500/5">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={row.valor_cesta === 0 ? "" : row.valor_cesta}
                                onChange={(e) =>
                                  handleUpdateRowField(row.id, "valor_cesta", parseFloat(e.target.value) || 0)
                                }
                                placeholder="0,00"
                                className="w-20 px-1.5 py-1 text-xs font-black text-right text-amber-800 dark:text-amber-300 bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/20"
                              />
                            </div>
                          </td>

                          {/* TOTAL RECEBIDO REAL */}
                          <td className="px-3 py-2 text-right tabular-nums font-black text-emerald-700 dark:text-emerald-400 align-middle">
                            {formatCurrency(totalRecebidoRow)}
                          </td>

                          {/* LÍQUIDO REAL PAGO */}
                          <td className="px-3 py-2 text-right tabular-nums font-black text-slate-900 dark:text-white align-middle">
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300">
                              {formatCurrency(liquidoRealRow)}
                            </span>
                          </td>

                          {/* STATUS DO VÍNCULO */}
                          <td className="px-2 py-2 text-center align-middle whitespace-nowrap">
                            {row.matchType === "EXACT" ? (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-800">
                                Exato
                              </span>
                            ) : row.matchType === "SIMILAR" ? (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800">
                                Similar
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
                                Novo
                              </span>
                            )}
                          </td>

                          {/* AÇÕES (EDITAR VERBAS DETALHADAS / EXCLUIR LINHA) */}
                          <td className="px-2 py-2 text-center align-middle whitespace-nowrap sticky right-0 bg-white dark:bg-slate-900">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setInspectRow({ ...row })}
                                className="p-1 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                title="Editar todas as verbas detalhadas deste colaborador"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                                title="Remover este colaborador do lote"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* BARRA INFERIOR DE FINALIZAÇÃO */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Deseja realmente limpar todos os colaboradores carregados no lote?")) {
                        setStagingRows([]);
                      }
                    }}
                    className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} />
                    <span>Descartar Lote</span>
                  </button>

                  <span className="text-xs text-slate-400">
                    {stagingRows.filter((r) => r.isSelected).length} de {stagingRows.length} selecionados para gravação
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCommitBatch(false, false)}
                    disabled={isCommitting || stagingRows.filter((r) => r.isSelected).length === 0}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
                  >
                    {isCommitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Gravando ({commitProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Database size={16} />
                        <span>Gravar e Alimentar Custo Histórico</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FEEDBACK DE LOADING GERAL */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl flex flex-col items-center max-w-sm text-center space-y-3 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
              <Loader2 size={32} className="animate-spin text-emerald-600" />
              <h5 className="font-black text-sm text-slate-900 dark:text-white">Processando Documento via IA</h5>
              <p className="text-xs text-slate-500">{processingStatusText || "Por favor, aguarde..."}</p>
            </div>
          </div>
        )}

        {/* MODAL DE CONCILIAÇÃO E COMPARAÇÃO LADO A LADO (DB vs NOVA FOLHA) */}
        {showCorrectionModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95">
              
              {/* CABEÇALHO DO MODAL DE CONCILIAÇÃO */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <SlidersHorizontal size={22} />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Comparação Lado a Lado & Decisão de Valores</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 uppercase">
                        {conflictingRows.length} Conflito{conflictingRows.length !== 1 ? 's' : ''}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Competência {selectedCompetencia.slice(0, 7)}: Foram detectados registros já existentes. Escolha individualmente se acata o novo valor extraído ou se mantém o atual do banco.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* BARRA DE AÇÕES GLOBAIS RÁPIDAS */}
              <div className="py-3 px-3 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 my-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Decisão em Massa:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const allNew: Record<string, "ACCEPT_NEW" | "KEEP_DB"> = {};
                      conflictingRows.forEach((c) => {
                        allNew[c.row.id] = "ACCEPT_NEW";
                      });
                      setConflictDecisions(allNew);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs"
                  >
                    Acatar Todos os Novos da Folha
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allDb: Record<string, "ACCEPT_NEW" | "KEEP_DB"> = {};
                      conflictingRows.forEach((c) => {
                        allDb[c.row.id] = "KEEP_DB";
                      });
                      setConflictDecisions(allDb);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs"
                  >
                    Manter Todos Atuais do DB
                  </button>
                </div>

                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                    {Object.values(conflictDecisions).filter((d) => d === "ACCEPT_NEW").length} Novos
                  </span>{" "}
                  •{" "}
                  <span className="text-amber-700 dark:text-amber-400 font-bold">
                    {Object.values(conflictDecisions).filter((d) => d === "KEEP_DB").length} Mantidos do DB
                  </span>
                </div>
              </div>

              {/* LISTA COMPARATIVA LADO A LADO POR COLABORADOR */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {conflictingRows.map(({ row, existingCost }) => {
                  const decision = conflictDecisions[row.id] || "ACCEPT_NEW";
                  
                  // Valores Atuais no Banco
                  const dbFixo = existingCost.valor_fixo || 0;
                  const dbProventos = existingCost.valor_holerite || (dbFixo + (existingCost.valor_hora_extra || 0) + (existingCost.valor_adicional_not || 0));
                  const dbDescontos = existingCost.valor_descontos || 0;
                  const dbLiqFolha = Math.max(0, dbProventos - dbDescontos);
                  const dbAdiantamento = existingCost.valor_adiantamento || 0;
                  const dbBeneficios = (existingCost.valor_vt || 0) + (existingCost.valor_cesta || 0) + (existingCost.valor_vr || 0) + (existingCost.valor_bonus || 0) + (existingCost.valor_ajuda_custo || 0);
                  const dbTotalPago = (existingCost.valor_liquido || 0) + (existingCost.vinculo_tipo === 'CLT' && existingCost.valor_liquido === dbLiqFolha ? dbAdiantamento : 0);

                  // Novos Valores Extraídos
                  const newFixo = row.valor_fixo || 0;
                  const newProventos = (row.valor_holerite || (newFixo + row.valor_hora_extra + row.valor_adicional_not)) + (row.valor_outros_recebidos || 0);
                  const newDescontos = row.valor_descontos || 0;
                  const newLiqFolha = Math.max(0, newProventos - newDescontos);
                  const newAdiantamento = row.valor_adiantamento || 0;
                  const newBeneficios = (row.valor_vt || 0) + (row.valor_cesta || 0) + (row.valor_vr || 0) + (row.valor_bonus || 0) + (row.valor_ajuda_custo || 0);
                  const newTotalPago = newLiqFolha + newAdiantamento + newBeneficios;

                  return (
                    <div
                      key={row.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        decision === "ACCEPT_NEW"
                          ? "bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-50/20 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      {/* HEADER DO CARD DO COLABORADOR */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-tight">
                              {row.employeeName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {row.documentId ? `CPF: ${row.documentId}` : "CLT"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Cargo: {row.cargo || "Colaborador"} • Origem DB: {existingCost.origem || "Histórico"}
                          </p>
                        </div>

                        {/* SELETOR DE DECISÃO */}
                        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                          <button
                            type="button"
                            onClick={() =>
                              setConflictDecisions((prev) => ({
                                ...prev,
                                [row.id]: "ACCEPT_NEW",
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                              decision === "ACCEPT_NEW"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-emerald-700"
                            }`}
                          >
                            <CheckCircle2 size={13} />
                            <span>Acatar Novo da Folha</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConflictDecisions((prev) => ({
                                ...prev,
                                [row.id]: "KEEP_DB",
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 ${
                              decision === "KEEP_DB"
                                ? "bg-amber-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-amber-700"
                            }`}
                          >
                            <Database size={13} />
                            <span>Manter Atual do DB</span>
                          </button>
                        </div>
                      </div>

                      {/* GRADE COMPARATIVA LADO A LADO */}
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200/50">
                              <th className="py-1">Pilar / Rubrica</th>
                              <th className="py-1 text-right text-slate-600 dark:text-slate-400">Atual no Banco (DB)</th>
                              <th className="py-1 text-right text-emerald-700 dark:text-emerald-400">Novo Extraído (Folha)</th>
                              <th className="py-1 text-right text-slate-500">Variação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-[11px] tabular-nums font-semibold">
                            <tr>
                              <td className="py-1 text-slate-600 dark:text-slate-400">1. Salário Fixo / Base</td>
                              <td className="py-1 text-right">{formatCurrency(dbFixo)}</td>
                              <td className="py-1 text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(newFixo)}</td>
                              <td className="py-1 text-right text-slate-400">{formatCurrency(newFixo - dbFixo)}</td>
                            </tr>
                            <tr>
                              <td className="py-1 text-slate-600 dark:text-slate-400">1. Proventos Brutos da Folha</td>
                              <td className="py-1 text-right">{formatCurrency(dbProventos)}</td>
                              <td className="py-1 text-right text-emerald-700 dark:text-emerald-400">{formatCurrency(newProventos)}</td>
                              <td className="py-1 text-right text-slate-400">{formatCurrency(newProventos - dbProventos)}</td>
                            </tr>
                            <tr>
                              <td className="py-1 text-rose-600 dark:text-rose-400">2. Descontos em Folha</td>
                              <td className="py-1 text-right text-rose-600">-{formatCurrency(dbDescontos)}</td>
                              <td className="py-1 text-right text-rose-600">-{formatCurrency(newDescontos)}</td>
                              <td className="py-1 text-right text-slate-400">{formatCurrency(newDescontos - dbDescontos)}</td>
                            </tr>
                            <tr>
                              <td className="py-1 text-slate-800 dark:text-slate-200 font-bold">3. Salário Líquido da Folha</td>
                              <td className="py-1 text-right font-bold">{formatCurrency(dbLiqFolha)}</td>
                              <td className="py-1 text-right text-emerald-700 dark:text-emerald-400 font-bold">{formatCurrency(newLiqFolha)}</td>
                              <td className="py-1 text-right text-slate-400">{formatCurrency(newLiqFolha - dbLiqFolha)}</td>
                            </tr>
                            <tr>
                              <td className="py-1 text-blue-600 dark:text-blue-400">4. Adiantamento Salarial</td>
                              <td className="py-1 text-right text-blue-600">+{formatCurrency(dbAdiantamento)}</td>
                              <td className="py-1 text-right text-blue-600">+{formatCurrency(newAdiantamento)}</td>
                              <td className="py-1 text-right text-slate-400">{formatCurrency(newAdiantamento - dbAdiantamento)}</td>
                            </tr>
                            <tr>
                              <td className="py-1 text-emerald-600 dark:text-emerald-400">4. Benefícios Extras (VT, VR, Bônus)</td>
                              <td className="py-1 text-right text-emerald-600">+{formatCurrency(dbBeneficios)}</td>
                              <td className="py-1 text-right text-emerald-600">+{formatCurrency(newBeneficios)}</td>
                              <td className="py-1 text-right text-slate-400">{formatCurrency(newBeneficios - dbBeneficios)}</td>
                            </tr>
                            <tr className="bg-slate-100/60 dark:bg-slate-800/40 font-black text-xs">
                              <td className="py-1.5 text-slate-900 dark:text-white uppercase">5. Total Pago ao Colaborador</td>
                              <td className="py-1.5 text-right text-slate-900 dark:text-white">{formatCurrency(dbTotalPago)}</td>
                              <td className="py-1.5 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(newTotalPago)}</td>
                              <td className="py-1.5 text-right text-emerald-700 dark:text-emerald-300 font-extrabold">
                                {formatCurrency(newTotalPago - dbTotalPago)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RODAPÉ DO MODAL DE DECISÕES */}
              <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <span className="text-xs text-slate-500">
                  Total de <strong>{conflictingRows.length}</strong> decisões prontas para gravação com rastreabilidade auditada.
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowCorrectionModal(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancelar e Revisar no Grid
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmConflictDecisions}
                    className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    <span>Confirmar e Gravar Decisões</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* MODAL DE EDIÇÃO E DETALHAMENTO DE TODAS AS VERBAS DA FOLHA */}
        {inspectRow && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
              
              <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800 shrink-0">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Detalhamento e Edição de Verbas da Folha</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold uppercase">
                      Editável
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">{inspectRow.employeeName} ({inspectRow.competencia})</p>
                </div>
                <button onClick={() => setInspectRow(null)} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs overflow-y-auto pr-1 flex-1">
                {/* SEÇÃO 1: PROVENTOS DA FOLHA MENSAL */}
                <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                    1. Proventos da Folha Mensal
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block font-bold mb-1">Salário Fixo / Base:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_fixo || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_fixo: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block font-bold mb-1">Horas Extras + DSR:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_hora_extra || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_hora_extra: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-blue-600 dark:text-blue-400 uppercase block font-bold mb-1">
                        Outros Valores Recebidos:
                      </label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-blue-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_outros_recebidos || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_outros_recebidos: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-blue-700 dark:text-blue-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block font-bold mb-1">Adicional Noturno:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_adicional_not || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_adicional_not: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 2: DESCONTOS DA FOLHA */}
                <div className="bg-rose-50/40 dark:bg-rose-950/20 p-3.5 rounded-2xl border border-rose-100 dark:border-rose-900/40 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                    2. Descontos e Deduções da Folha
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-rose-600 uppercase block font-bold mb-1">INSS Descontado:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-rose-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.inss_empregado || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, inss_empregado: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-rose-700 dark:text-rose-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-rose-600 uppercase block font-bold mb-1">Desc. VT 6%:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-rose-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.desconto_vt_6 || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, desconto_vt_6: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-rose-700 dark:text-rose-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-rose-600 uppercase block font-bold mb-1">IRRF Descontado:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-rose-400 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.irrf_empregado || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, irrf_empregado: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-rose-700 dark:text-rose-300"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-rose-700 uppercase block font-black mb-1">Total Descontos:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-rose-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_descontos || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_descontos: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-rose-800 dark:text-rose-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO 3: BENEFÍCIOS E PAGAMENTOS EXTRAS DA COMPETÊNCIA (ÚLTIMA PARTE) */}
                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                    3. Benefícios e Pagamentos Extras da Competência
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-emerald-700 uppercase block font-bold mb-1">VT Recebido:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-emerald-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_vt || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_vt: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-emerald-800 dark:text-emerald-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-amber-700 uppercase block font-bold mb-1">VR / Cesta:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-amber-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_cesta || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_cesta: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-amber-800 dark:text-amber-200"
                        />
                      </div>
                    </div>

                    {/* ADIANTAMENTO FOLHA NA ÚLTIMA PARTE COM BENEFÍCIOS */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] text-blue-700 dark:text-blue-300 uppercase block font-black mb-1">
                        Adiantamento Folha:
                      </label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-600 rounded-lg px-2 py-1 shadow-2xs">
                        <span className="text-[10px] text-blue-600 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_adiantamento || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_adiantamento: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-blue-800 dark:text-blue-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-indigo-700 uppercase block font-bold mb-1">Bonificação / Bônus:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-indigo-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_bonus || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_bonus: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-indigo-800 dark:text-indigo-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-teal-700 uppercase block font-bold mb-1">Ajuda de Custo:</label>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-teal-500 font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={inspectRow.valor_ajuda_custo || ""}
                          onChange={(e) => setInspectRow({ ...inspectRow, valor_ajuda_custo: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-xs font-black text-right bg-transparent outline-none text-teal-800 dark:text-teal-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* TOTALIZADORES RECALCULADOS AO VIVO */}
                {(() => {
                  const prov = (inspectRow.valor_fixo || 0) + (inspectRow.valor_hora_extra || 0) + (inspectRow.valor_outros_recebidos || 0) + (inspectRow.valor_adicional_not || 0);
                  const ben = (inspectRow.valor_vt || 0) + (inspectRow.valor_cesta || 0) + (inspectRow.valor_adiantamento || 0) + (inspectRow.valor_bonus || 0) + (inspectRow.valor_ajuda_custo || 0);
                  const rec = prov + ben;
                  const desc = inspectRow.valor_descontos || 0;
                  const liq = rec - desc;

                  return (
                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900 text-white rounded-2xl">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-bold">Total Recebido</span>
                        <span className="text-xs font-black text-emerald-400 tabular-nums">{formatCurrency(rec)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-bold">Total Descontado</span>
                        <span className="text-xs font-black text-rose-400 tabular-nums">-{formatCurrency(desc)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block font-bold">Líquido Real</span>
                        <span className="text-xs font-black text-teal-300 tabular-nums">{formatCurrency(liq)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (inspectRow) {
                      setStagingRows((prev) => prev.map((r) => (r.id === inspectRow.id ? inspectRow : r)));
                    }
                    setInspectRow(null);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all"
                >
                  <Check size={14} />
                  <span>Salvar Alterações do Colaborador</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectRow(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
