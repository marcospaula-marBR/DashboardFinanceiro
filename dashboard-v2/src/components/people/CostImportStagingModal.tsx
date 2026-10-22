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
  Check,
  RotateCcw,
  Gift,
  AlertCircle
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
  sourceType: "PAYROLL_EXTRATO" | "EXCEL_RETROATIVO" | "BENEFICIOS_PDF";
  
  // Proventos e Bases da Folha
  valor_fixo: number;
  valor_holerite: number;
  valor_adiantamento: number;
  valor_hora_extra: number;
  valor_adicional_not: number;
  
  // Benefícios Recebidos (Editáveis)
  valor_vt: number; // VT RECEBIDO / RECARGA EFETIVA
  desconto_vt_6: number; // Desconto legal de 6% da folha
  valor_cesta: number; // VR / CESTA BÁSICA CONCEDIDA
  valor_vr: number; // VALE REFEIÇÃO
  valor_bonus: number; // BONIFICAÇÃO / PREMIAÇÃO
  valor_ajuda_custo: number; // AJUDA DE CUSTO
  
  // Outras Verbas
  valor_ferias: number;
  valor_rescisao: number;
  valor_decimo_terceiro: number;
  
  // Descontos da Folha
  valor_descontos: number;
  inss_empregado: number;
  irrf_empregado: number;
  valor_faltas: number;
  dias_faltas: number;
  valor_consignado: number;
  valor_pensao_alimenticia: number;
  valor_fgts: number;
  
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
  // Controle de Fonte: 'FOLHA', 'BENEFICIOS' ou 'EXCEL'
  const [sourceMode, setSourceMode] = useState<"FOLHA" | "BENEFICIOS" | "EXCEL">("FOLHA");

  // Estados de Upload e Parsing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatusText, setProcessingStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mergeSuccessMessage, setMergeSuccessMessage] = useState<string | null>(null);

  // Staging Rows
  const [stagingRows, setStagingRows] = useState<StagingCostRow[]>([]);
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>(
    defaultCompetencia || new Date().toISOString().slice(0, 7) + "-01"
  );

  // Validação com banco de dados (Já cadastrados / Auditoria de conflito)
  const [existingCostsInDb, setExistingCostsInDb] = useState<Map<string, MonthlyCost>>(new Map());
  const [isLoadingExistingCosts, setIsLoadingExistingCosts] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [conflictingRows, setConflictingRows] = useState<{ row: StagingCostRow; existingCost: MonthlyCost }[]>([]);

  // Filtro de Busca no Staging
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMatchType, setFilterMatchType] = useState<"ALL" | "MATCHED" | "NEW" | "EXISTING">("ALL");

  // Preenchimento em Massa
  const [bulkVtValue, setBulkVtValue] = useState<string>("");
  const [bulkCestaValue, setBulkCestaValue] = useState<string>("");
  const [isLoadingPreviousBenefits, setIsLoadingPreviousBenefits] = useState(false);

  // Commit / Salvar
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);

  // Modal de Detalhes da Linha
  const [inspectRow, setInspectRow] = useState<StagingCostRow | null>(null);

  // Reseta ao fechar/abrir
  useEffect(() => {
    if (!isOpen) {
      setStagingRows([]);
      setErrorMessage(null);
      setMergeSuccessMessage(null);
      setIsProcessing(false);
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
    let totalDescontos = 0;
    let totalVtRecebido = 0;
    let totalCesta = 0;
    let totalOutrosBeneficios = 0;
    let totalRecebido = 0;
    let totalLiquidoReal = 0;

    selected.forEach((r) => {
      const proventos = r.valor_holerite || (r.valor_fixo + r.valor_hora_extra + r.valor_adicional_not);
      const beneficios = (r.valor_vt || 0) + (r.valor_cesta || 0) + (r.valor_vr || 0) + (r.valor_bonus || 0) + (r.valor_ajuda_custo || 0);
      const desc = r.valor_descontos || 0;
      const rec = proventos + beneficios;
      const liq = rec - desc;

      totalHolerite += proventos;
      totalDescontos += desc;
      totalVtRecebido += r.valor_vt || 0;
      totalCesta += r.valor_cesta || 0;
      totalOutrosBeneficios += (r.valor_vr || 0) + (r.valor_bonus || 0) + (r.valor_ajuda_custo || 0);
      totalRecebido += rec;
      totalLiquidoReal += liq;
    });

    return {
      count,
      totalHolerite,
      totalDescontos,
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
      setProcessingStatusText("Enviando arquivo e extraindo colaboradores via IA...");

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

        // Tenta achar por CPF exato primeiro
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
          // Busca por similaridade de nome
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
          valor_adiantamento: rec.valor_adiantamento || 0,
          valor_hora_extra: rec.valor_hora_extra || 0,
          valor_adicional_not: rec.valor_adicional_not || 0,
          valor_vt: rec.valor_vt || 0, // VT benefício recebido
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
      setMergeSuccessMessage(`✨ ${newRows.length} colaboradores carregados da Folha Oficial.`);
    } catch (err: any) {
      console.error("Erro ao importar folha por IA:", err);
      setErrorMessage(err.message || "Falha ao processar o arquivo da folha.");
    } finally {
      setIsProcessing(false);
      setProcessingStatusText("");
    }
  };

  // 2. Processamento de Relatório de Benefícios (VT, VR/Cesta, Bonificação - PDF ou Imagem)
  const handleUploadBenefitsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setMergeSuccessMessage(null);
      setProcessingStatusText("Extraindo dados do relatório de benefícios (VT, VR/Cesta, Bônus) via IA...");

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
        throw new Error("A IA não identificou lançamentos de benefícios no documento.");
      }

      const comp = result.competencia || selectedCompetencia;
      if (result.competencia) {
        setSelectedCompetencia(result.competencia);
      }

      // Se já temos linhas no staging (ex: folha já carregada), fazemos MERGE com os colaboradores existentes!
      if (stagingRows.length > 0) {
        let mergedCount = 0;
        const updatedRows = stagingRows.map((r) => {
          const cleanCpf = (r.documentId || "").replace(/\D/g, "");
          const match = result.records.find((rec: any) => {
            const recCpf = (rec.cpf || "").replace(/\D/g, "");
            if (cleanCpf && recCpf && cleanCpf === recCpf) return true;
            if (rec.name && r.employeeName) {
              const sim = findBestNameMatch(rec.name, [{ id: r.id, name: r.employeeName } as any]);
              return sim && (sim.status === "EXACT" || sim.similarity >= 0.85);
            }
            return false;
          });

          if (match) {
            mergedCount++;
            return {
              ...r,
              valor_vt: match.valor_vt > 0 ? match.valor_vt : r.valor_vt,
              valor_cesta: match.valor_cesta > 0 ? match.valor_cesta : (match.valor_vr > 0 ? match.valor_vr : r.valor_cesta),
              valor_vr: match.valor_vr > 0 ? match.valor_vr : r.valor_vr,
              valor_bonus: match.valor_bonus > 0 ? match.valor_bonus : r.valor_bonus || 0,
              valor_ajuda_custo: match.valor_ajuda_custo > 0 ? match.valor_ajuda_custo : r.valor_ajuda_custo,
              observacao: match.observacao ? `${r.observacao || ""} | ${match.observacao}`.trim() : r.observacao,
            };
          }
          return r;
        });

        setStagingRows(updatedRows);
        setMergeSuccessMessage(`✨ Sucesso! Benefícios de VT, VR/Cesta e Bonificações mesclados para ${mergedCount} colaboradores presentes no grid.`);
      } else {
        // Grid estava vazio: cria novas linhas de staging a partir do relatório de benefícios
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
            competencia: comp,
            sourceType: "BENEFICIOS_PDF",
            valor_fixo: fixoBase,
            valor_holerite: fixoBase,
            valor_adiantamento: 0,
            valor_hora_extra: 0,
            valor_adicional_not: 0,
            valor_vt: rec.valor_vt || 0,
            desconto_vt_6: 0,
            valor_cesta: rec.valor_cesta || rec.valor_vr || 0,
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

  // 3. Processamento de Planilha Histórica Excel (.xlsx / .csv)
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
          valor_adiantamento: c.valor_adiantamento,
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

      // Mapeia custos anteriores por employee_id
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

  // 4. Gravação Final no Custo Histórico (Supabase) com trava e verificação de correção
  const handleCommitBatch = async (forceOverwrite: boolean = false, skipExisting: boolean = false) => {
    let selected = stagingRows.filter((r) => r.isSelected);
    if (selected.length === 0) {
      alert("Selecione pelo menos um colaborador para gravar.");
      return;
    }

    // Se não for forçado nem ignorado, checa se há colaboradores que já possuem dados no banco
    if (!forceOverwrite && !skipExisting) {
      const conflicts = selected
        .filter((r) => r.targetEmployeeId !== "NEW" && existingCostsInDb.has(r.targetEmployeeId))
        .map((r) => ({
          row: r,
          existingCost: existingCostsInDb.get(r.targetEmployeeId)!,
        }));

      if (conflicts.length > 0) {
        setConflictingRows(conflicts);
        setShowCorrectionModal(true);
        return; // Pausa a gravação e solicita confirmação explícita do usuário!
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

    try {
      setIsCommitting(true);
      setCommitProgress(0);

      const batchToSave: Partial<MonthlyCost>[] = [];
      const total = selected.length;
      let count = 0;

      for (const row of selected) {
        count++;
        setCommitProgress(Math.round((count / total) * 100));

        let finalEmployeeId = row.targetEmployeeId;

        // Se for NOVO colaborador, cria ficha preliminar
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
          // Cálculo financeiro dos 3 Pilares Executivos:
          const proventos = row.valor_holerite || (row.valor_fixo + row.valor_hora_extra + row.valor_adicional_not);
          const beneficios = (row.valor_vt || 0) + (row.valor_cesta || 0) + (row.valor_vr || 0) + (row.valor_bonus || 0) + (row.valor_ajuda_custo || 0);
          const totalRecebido = proventos + beneficios;
          const totalDescontos = row.valor_descontos || 0;
          const liquidoReal = totalRecebido - totalDescontos;

          batchToSave.push({
            employee_id: finalEmployeeId,
            competencia: row.competencia,
            vinculo_tipo: "CLT",
            valor_fixo: row.valor_fixo,
            valor_holerite: proventos,
            valor_adiantamento: row.valor_adiantamento,
            valor_hora_extra: row.valor_hora_extra,
            valor_adicional_not: row.valor_adicional_not,
            valor_vt: row.valor_vt, // VT recebido efetivo
            valor_cesta: row.valor_cesta, // VR / Cesta
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
            origem: row.sourceType === "PAYROLL_EXTRATO" ? "manual" : (row.sourceType === "BENEFICIOS_PDF" ? "manual" : "csv"),
            observacao: row.observacao || "Importado via Central de Ingestão de Custos",
          });
        }
      }

      await PeopleHRService.saveMonthlyCostsBatch(batchToSave);

      alert(`Sucesso! ${batchToSave.length} lançamentos gravados no Custo Histórico com precisão executiva.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao gravar custos mensais:", err);
      alert("Falha ao salvar no banco de dados: " + (err.message || err));
    } finally {
      setIsCommitting(false);
      setCommitProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-slate-50 dark:via-slate-900 to-white dark:to-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Central de Ingestão, Auditoria & Benefícios de Custos Mensais
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {stagingRows.length > 0 ? `${stagingRows.length} Carregados` : "Aguardando Arquivo"}
                </span>
                {activeConflictsCount > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <AlertTriangle size={11} />
                    ${activeConflictsCount} Já Cadastrado(s)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Importação equilibrada de Folha Oficial, Benefícios em PDF (VT, VR/Cesta, Bonificações) e Planilha Histórica
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
            title="Fechar janela"
          >
            <X size={18} />
          </button>
        </div>

        {/* FEEDBACK DE ERRO OU SUCESSO */}
        {errorMessage && (
          <div className="mx-6 mt-3 px-4 py-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {mergeSuccessMessage && (
          <div className="mx-6 mt-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{mergeSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setMergeSuccessMessage(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
            >
              ×
            </button>
          </div>
        )}

        {/* ÁREA PRINCIPAL */}
        {stagingRows.length === 0 ? (
          /* ESTADO 1: SELETOR DE FONTE DE DADOS */
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center p-12 text-center max-w-md">
                <Loader2 size={44} className="text-emerald-500 animate-spin mb-4" />
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  Processando Dados Financeiros...
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {processingStatusText || "Aguarde enquanto o documento é estruturado e auditado."}
                </p>
              </div>
            ) : (
              <div className="w-full max-w-5xl space-y-6">
                <div className="text-center space-y-1">
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    Escolha a Fonte de Dados para Alimentar o Custo Histórico
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    O sistema integra folha oficial, demonstrativos de benefícios em PDF e planilhas retroativas.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                  
                  {/* CARD FONTE 1: FOLHA OFICIAL */}
                  <div className="bg-gradient-to-b from-emerald-500/5 to-transparent border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl p-5 flex flex-col justify-between hover:border-emerald-500 transition-all shadow-sm group">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                          <FileText size={22} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Folha Mensal
                        </span>
                      </div>

                      <h5 className="text-sm font-black text-slate-900 dark:text-white">
                        Extrato da Folha (PDF/Imagem)
                      </h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Importe o extrato oficial celetista. A IA extrai múltiplos colaboradores, salários, horas extras, adiantamento e desconto legal de 6% de VT.
                      </p>
                    </div>

                    <div className="pt-5">
                      <label className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer">
                        <Upload size={14} />
                        <span>Carregar Folha (PDF/Foto)</span>
                        <input
                          type="file"
                          accept=".pdf,image/png,image/jpeg"
                          onChange={handleUploadPayrollFile}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* CARD FONTE 2: PLANILHA DE BENEFÍCIOS (NOVO!) */}
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
                        Planilha de Benefícios (PDF/Imagem)
                      </h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Importe relatórios de recarga de VT (Sodexo, Top), VR, Cesta ou Bonificação. Lê valores concedidos e permite complementar ou mesclar com o grid.
                      </p>
                    </div>

                    <div className="pt-5">
                      <label className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer">
                        <Upload size={14} />
                        <span>Carregar Benefícios (PDF)</span>
                        <input
                          type="file"
                          accept=".pdf,image/png,image/jpeg"
                          onChange={handleUploadBenefitsFile}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* CARD FONTE 3: PLANILHA EXCEL RETROATIVA */}
                  <div className="bg-gradient-to-b from-blue-500/5 to-transparent border-2 border-blue-500/30 dark:border-blue-500/20 rounded-3xl p-5 flex flex-col justify-between hover:border-blue-500 transition-all shadow-sm group">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-11 h-11 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                          <FileSpreadsheet size={22} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Retroativos • Excel
                        </span>
                      </div>

                      <h5 className="text-sm font-black text-slate-900 dark:text-white">
                        Planilha Histórica Excel (.xlsx / .csv)
                      </h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Importe histórico dos anos anteriores com meses em colunas e verbas em linhas (Holerite, VT recebido, VR/Cesta, Descontos, Total).
                      </p>
                    </div>

                    <div className="pt-5 space-y-2">
                      <label className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer">
                        <Upload size={14} />
                        <span>Enviar Planilha (.xlsx)</span>
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
                        className="w-full py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw size={12} className="text-blue-500" />
                        <span>Carregar public/CLT.xlsx</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        ) : (
          /* ESTADO 2: STAGING GRID (AUDITORIA, COMPLEMENTAÇÃO DE VT/CESTA E EDIÇÃO) */
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* BARRA SUPERIOR DE FILTROS & AÇÕES EM MASSA */}
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              
              {/* Seletor de Competência & Busca */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-2xs">
                  <Calendar size={14} className="text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-black text-slate-500 uppercase">Competência:</span>
                  <select
                    value={selectedCompetencia}
                    onChange={(e) => setSelectedCompetencia(e.target.value)}
                    className="text-xs font-black text-slate-900 dark:text-white bg-transparent outline-none cursor-pointer"
                  >
                    {availableStagingCompetencias.map((comp) => (
                      <option key={comp} value={comp} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        {comp}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar colaborador no lote..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 w-52 text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all flex items-center gap-1.5"
                >
                  {visibleRows.every((r) => r.isSelected) ? (
                    <CheckSquare size={14} className="text-emerald-600" />
                  ) : (
                    <Square size={14} className="text-slate-400" />
                  )}
                  <span>Marcar Todos</span>
                </button>
              </div>

              {/* Ferramentas em Massa para VT, VR/Cesta e Mesclagem de Benefícios */}
              <div className="flex items-center gap-2 flex-wrap">
                
                {/* Botão de Mesclagem de Benefícios PDF */}
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

                {/* Preenchimento Rápido de VT */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800/60 rounded-xl px-2 py-1 shadow-2xs">
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase">VT Padrão R$:</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="273.00"
                    value={bulkVtValue}
                    onChange={(e) => setBulkVtValue(e.target.value)}
                    className="w-16 px-1.5 py-0.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-right outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBulkVt}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded uppercase transition-all"
                  >
                    Aplicar
                  </button>
                </div>

                {/* Preenchimento Rápido de VR / Cesta */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/60 rounded-xl px-2 py-1 shadow-2xs">
                  <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase">VR / Cesta R$:</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="500.00"
                    value={bulkCestaValue}
                    onChange={(e) => setBulkCestaValue(e.target.value)}
                    className="w-16 px-1.5 py-0.5 text-xs font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-right outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBulkCesta}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black rounded uppercase transition-all"
                  >
                    Aplicar
                  </button>
                </div>

                {/* Copiar Benefícios do Mês Anterior */}
                <button
                  type="button"
                  onClick={handleCopyPreviousBenefits}
                  disabled={isLoadingPreviousBenefits}
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl hover:bg-blue-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  title="Busca os valores de VT e VR/Cesta da competência anterior cadastrada e preenche automaticamente"
                >
                  {isLoadingPreviousBenefits ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                  <span>Repetir Mês Anterior</span>
                </button>

                {/* Limpar Staging / Voltar */}
                <button
                  type="button"
                  onClick={() => setStagingRows([])}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  title="Voltar e carregar outro arquivo"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </div>

            {/* ALERTA DE DADOS JÁ CADASTRADOS SE HOUVER CONFLITO */}
            {activeConflictsCount > 0 && (
              <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 font-bold shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                  <span>
                    Atenção: <strong>{activeConflictsCount} colaborador(es)</strong> já possuem custos lançados para esta competência ({selectedCompetencia}).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterMatchType((prev) => (prev === "EXISTING" ? "ALL" : "EXISTING"))}
                  className="text-[11px] underline hover:text-amber-900 dark:hover:text-amber-200 uppercase tracking-wider"
                >
                  {filterMatchType === "EXISTING" ? "Ver Todos do Grid" : "Filtrar Somente os Conflitantes"}
                </button>
              </div>
            )}

            {/* BARRA DE KPIS CONSOLIDADOS DO LOTE (3 PILARES EXECUTIVOS) */}
            <div className="px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 overflow-x-auto shrink-0 text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Colaboradores</span>
                <span className="text-sm font-black text-slate-800 dark:text-white tabular-nums">
                  {selectedStats.count} selecionado{selectedStats.count !== 1 ? "s" : ""}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Proventos Folha</span>
                <span className="text-sm font-black text-slate-800 dark:text-white tabular-nums">
                  {formatCurrency(selectedStats.totalHolerite)}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">VT Recarga Concedido</span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(selectedStats.totalVtRecebido)}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase block">VR / Cesta</span>
                <span className="text-sm font-black text-amber-700 dark:text-amber-400 tabular-nums">
                  {formatCurrency(selectedStats.totalCesta)}
                </span>
              </div>
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase block">1. Total Recebido</span>
                <span className="text-sm font-black text-emerald-800 dark:text-emerald-200 tabular-nums">
                  {formatCurrency(selectedStats.totalRecebido)}
                </span>
              </div>
              <div className="bg-rose-50/50 dark:bg-rose-950/20 px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-800">
                <span className="text-[9px] font-black text-rose-700 dark:text-rose-400 uppercase block">2. Total Descontado</span>
                <span className="text-sm font-black text-rose-800 dark:text-rose-200 tabular-nums">
                  {formatCurrency(selectedStats.totalDescontos)}
                </span>
              </div>
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1 rounded-xl shadow-xs">
                <span className="text-[9px] font-black uppercase block text-emerald-100">3. Valor Líquido Real</span>
                <span className="text-sm font-black tabular-nums">
                  {formatCurrency(selectedStats.totalLiquidoReal)}
                </span>
              </div>
            </div>

            {/* TABELA DE STAGING / AUDITORIA */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-850 z-10 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2 w-8 text-center">
                      <button onClick={handleToggleSelectAll}>
                        {visibleRows.every((r) => r.isSelected) ? (
                          <CheckSquare size={15} className="text-emerald-600" />
                        ) : (
                          <Square size={15} className="text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500">Colaborador</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500 text-right">Proventos Folha</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 text-right">Desc. Folha (c/ 6% VT)</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 text-right bg-emerald-500/10 rounded-t">
                      VT Recebido (R$) ★
                    </th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 text-right bg-amber-500/10 rounded-t">
                      VR / Cesta (R$) ★
                    </th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 text-right">Total Recebido</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-teal-700 dark:text-teal-300 text-right">Líquido Real</th>
                    <th className="px-2 py-2 text-[10px] font-black uppercase text-slate-500 text-center">Vínculo</th>
                    <th className="px-3 py-2 text-[10px] font-black uppercase text-slate-500 text-center sticky right-0 bg-slate-100 dark:bg-slate-850">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleRows.map((row) => {
                    const proventos = row.valor_holerite || (row.valor_fixo + row.valor_hora_extra + row.valor_adicional_not);
                    const beneficios = (row.valor_vt || 0) + (row.valor_cesta || 0) + (row.valor_vr || 0) + (row.valor_bonus || 0) + (row.valor_ajuda_custo || 0);
                    const totalRecebidoRow = proventos + beneficios;
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
                        <td className="px-3 py-2 text-center align-middle">
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
                              <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                • {row.cargo}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Proventos Folha */}
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300 font-semibold align-middle">
                          {formatCurrency(proventos)}
                          {row.valor_adiantamento > 0 && (
                            <span className="text-[9px] text-blue-500 block">
                              Vale: {formatCurrency(row.valor_adiantamento)}
                            </span>
                          )}
                        </td>

                        {/* Descontos Folha */}
                        <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400 font-bold align-middle">
                          -{formatCurrency(totalDescRow)}
                          {row.desconto_vt_6 > 0 && (
                            <span className="text-[9px] text-rose-400 block font-normal">
                              Desc 6% VT: {formatCurrency(row.desconto_vt_6)}
                            </span>
                          )}
                        </td>

                        {/* VT RECEBIDO EFETIVO (INPUT EDITÁVEL INLINE) */}
                        <td className="px-3 py-2 text-right align-middle bg-emerald-500/5">
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
                              className="w-24 px-2 py-1 text-xs font-black text-right text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>
                        </td>

                        {/* VR / CESTA BÁSICA (INPUT EDITÁVEL INLINE) */}
                        <td className="px-3 py-2 text-right align-middle bg-amber-500/5">
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
                              className="w-24 px-2 py-1 text-xs font-black text-right text-amber-800 dark:text-amber-300 bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/20"
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

                        {/* AÇÕES (EXCLUIR LINHA / DETALHES) */}
                        <td className="px-3 py-2 text-center align-middle whitespace-nowrap sticky right-0 bg-white dark:bg-slate-900">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setInspectRow(row)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                              title="Ver todas as rubricas detalhadas"
                            >
                              <Eye size={14} />
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

            {/* RODAPÉ DE CONFIRMAÇÃO E GRAVAÇÃO */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Competência: <strong>{selectedCompetencia}</strong> • Total a gravar:{" "}
                  <strong>{selectedStats.count}</strong> colaboradores
                </span>
                {activeConflictsCount > 0 && (
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    ({activeConflictsCount} já existem no banco e serão revisados)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isCommitting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => handleCommitBatch(false, false)}
                  disabled={isCommitting || selectedStats.count === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isCommitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Gravando ({commitProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Database size={15} />
                      <span>Confirmar e Gravar no Custo Histórico</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE CORREÇÃO (QUANDO JÁ EXISTEM DADOS GRAVADOS) */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-300 dark:border-amber-800/80 p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  Competência com Dados Já Cadastrados
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Foram identificados <strong>{conflictingRows.length} colaborador(es)</strong> que já possuem lançamentos em <strong>{selectedCompetencia}</strong>.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Você deseja realizar uma <strong>correção / atualização</strong> dos dados gravados com as informações atuais do grid ou prefere salvar somente os novos colaboradores?
            </p>

            {/* Lista dos colaboradores em conflito */}
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 p-2 text-xs">
              {conflictingRows.map(({ row, existingCost }) => {
                const proventos = row.valor_holerite || (row.valor_fixo + row.valor_hora_extra + row.valor_adicional_not);
                const beneficios = (row.valor_vt || 0) + (row.valor_cesta || 0) + (row.valor_vr || 0) + (row.valor_bonus || 0) + (row.valor_ajuda_custo || 0);
                const liqNovo = proventos + beneficios - (row.valor_descontos || 0);

                return (
                  <div key={row.id} className="py-2 px-2 flex justify-between items-center">
                    <div>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 block">
                        {row.employeeName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        No banco: Líquido {formatCurrency(existingCost.valor_liquido)} (Origem: {existingCost.origem || "manual"})
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Novo Valor:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(liqNovo)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ações de Decisão */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="w-full sm:w-auto px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancelar e Revisar no Grid
              </button>

              <button
                type="button"
                onClick={() => handleCommitBatch(false, true)}
                className="w-full sm:w-auto px-4 py-2 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-xl hover:bg-blue-100 transition-all"
              >
                Salvar Apenas Novos
              </button>

              <button
                type="button"
                onClick={() => handleCommitBatch(true, false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Check size={14} />
                <span>Sim, Aplicar Correção</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INSPEÇÃO DETALHADA DE RUBRICAS */}
      {inspectRow && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Detalhamento de Verbas da Folha
                </h4>
                <p className="text-xs text-slate-400">{inspectRow.employeeName} ({inspectRow.competencia})</p>
              </div>
              <button onClick={() => setInspectRow(null)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-bold">Salário Fixo:</span>
                  <span className="font-extrabold">{formatCurrency(inspectRow.valor_fixo)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-bold">Horas Extras + DSR:</span>
                  <span className="font-extrabold">{formatCurrency(inspectRow.valor_hora_extra)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-bold">Adiantamento:</span>
                  <span className="font-extrabold">{formatCurrency(inspectRow.valor_adiantamento)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-bold">Adic. Noturno:</span>
                  <span className="font-extrabold">{formatCurrency(inspectRow.valor_adicional_not)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-rose-50/40 dark:bg-rose-950/20 p-3 rounded-2xl border border-rose-100 dark:border-rose-900/40">
                <div>
                  <span className="text-[10px] text-rose-500 uppercase block font-bold">INSS Descontado:</span>
                  <span className="font-extrabold text-rose-700 dark:text-rose-400">{formatCurrency(inspectRow.inss_empregado)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-500 uppercase block font-bold">Desc. VT 6%:</span>
                  <span className="font-extrabold text-rose-700 dark:text-rose-400">{formatCurrency(inspectRow.desconto_vt_6)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-500 uppercase block font-bold">IRRF Descontado:</span>
                  <span className="font-extrabold text-rose-700 dark:text-rose-400">{formatCurrency(inspectRow.irrf_empregado)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-500 uppercase block font-bold">Total Descontos:</span>
                  <span className="font-extrabold text-rose-800 dark:text-rose-300">{formatCurrency(inspectRow.valor_descontos)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase block font-bold">VT Recebido:</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400">{formatCurrency(inspectRow.valor_vt)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 uppercase block font-bold">VR / Cesta:</span>
                  <span className="font-extrabold text-amber-700 dark:text-amber-400">{formatCurrency(inspectRow.valor_cesta)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-600 uppercase block font-bold">Bonificação / Bônus:</span>
                  <span className="font-extrabold text-indigo-700 dark:text-indigo-400">{formatCurrency(inspectRow.valor_bonus)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-teal-600 uppercase block font-bold">Ajuda de Custo:</span>
                  <span className="font-extrabold text-teal-700 dark:text-teal-400">{formatCurrency(inspectRow.valor_ajuda_custo)}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInspectRow(null)}
              className="w-full py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
