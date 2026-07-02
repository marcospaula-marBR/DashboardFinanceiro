"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Coins, AlertCircle, Building2, UserCheck, Calendar, ShieldAlert, Award, Landmark, Percent, Target, HeartPulse, HelpCircle, ArrowUpRight, Info } from "lucide-react";
import { Employee, MonthlyCost, LoanStats, AuditIssue } from "@/types/loans";
import { formatCurrency } from "@/services/loans.service";
import { isExternalEntity, calculateEmployeeHealth } from "@/components/people/PeopleBadges";
import { getPBClassification, inferEntityType } from "@/types/loans";

interface KPIStatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "headcount" | "headcount_clt" | "headcount_pj" | "payroll_clt" | "payroll_pj" | "loans" | "health" | "audit" | "strategic" | "nopbid" | null;
  employees: Employee[];
  monthlyCosts: MonthlyCost[];
  loanStats: LoanStats | null;
  auditIssues?: Record<string, AuditIssue[]>;
}

export function KPIStatsDrawer({ isOpen, onClose, mode, employees, monthlyCosts, loanStats, auditIssues = {} }: KPIStatsDrawerProps) {
  if (!mode) return null;

  const filteredEmployees = employees;
  const activeEmployees = employees.filter(e => e.status === "Ativo" || e.status === "Férias" || e.status === "Provisão");

  // --- Calculations for Headcount (Total) ---
  const headcountStats = (() => {
    const clt = activeEmployees.filter(e => e.linkType === "CLT").length;
    const mei = activeEmployees.filter(e => e.linkType === "MEI" || e.linkType === "PJ").length;
    const est = activeEmployees.filter(e => e.linkType === "Estagiário").length;
    const marBR = activeEmployees.filter(e => e.company === "MarBR").length;
    const dzm = activeEmployees.filter(e => e.company === "DZM").length;
    const g2 = activeEmployees.filter(e => e.company === "G2").length;
    const ferias = employees.filter(e => e.status === "Férias").length;

    // Average Tenure
    const tenures = activeEmployees
      .filter(e => e.start_date)
      .map(e => {
        const d = new Date(e.start_date! + "T00:00:00");
        const now = new Date();
        return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      });
    const avgMonths = tenures.length > 0 ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : 0;
    const avgYears = Math.floor(avgMonths / 12);
    const avgRemMonths = avgMonths % 12;
    const avgTenure = avgYears > 0 ? `${avgYears}a ${avgRemMonths > 0 ? avgRemMonths + "m" : ""}` : `${avgMonths}m`;

    return { clt, mei, est, marBR, dzm, g2, ferias, avgTenure };
  })();

  // --- Calculations for Headcount CLT / PF ---
  const headcountCltStats = (() => {
    const cltList = activeEmployees.filter(e => !isExternalEntity(e.entityType || inferEntityType(e)) && (e.linkType === "CLT" || e.linkType === "Estagiário"));
    const cltCount = cltList.filter(e => e.linkType === "CLT").length;
    const estCount = cltList.filter(e => e.linkType === "Estagiário").length;
    const avgSalary = cltList.length > 0 
      ? Math.round(cltList.reduce((sum, e) => sum + (e.remuneration_fixed || e.remuneration || 0), 0) / cltList.length)
      : 0;
    const marBR = cltList.filter(e => e.company === "MarBR").length;
    const dzm = cltList.filter(e => e.company === "DZM").length;
    const g2 = cltList.filter(e => e.company === "G2").length;
    return { cltList, cltCount, estCount, avgSalary, marBR, dzm, g2 };
  })();

  // --- Calculations for Headcount PJ / Prestadores ---
  const headcountPjStats = (() => {
    const pjList = activeEmployees.filter(e => isExternalEntity(e.entityType || inferEntityType(e)));
    const avgContract = pjList.length > 0
      ? Math.round(pjList.reduce((sum, e) => sum + (e.remuneration_fixed || e.remuneration || 0), 0) / pjList.length)
      : 0;
    const meiCount = pjList.filter(e => e.tax_regime === "MEI" || e.linkType === "MEI").length;
    const simplesCount = pjList.filter(e => e.tax_regime === "Simples Nacional").length;
    const otherTaxCount = pjList.length - meiCount - simplesCount;
    return { pjList, avgContract, meiCount, simplesCount, otherTaxCount };
  })();

  // --- Calculations for Payroll CLT ---
  const payrollCltStats = (() => {
    const cltList = activeEmployees.filter(e => !isExternalEntity(e.entityType || inferEntityType(e)) && (e.linkType === "CLT" || e.linkType === "Estagiário"));
    const totalFixed = cltList.reduce((sum, e) => sum + (e.remuneration_fixed || e.remuneration || 0), 0);
    const totalBonus = cltList.reduce((sum, e) => sum + (e.remuneration_bonus || 0), 0);
    const totalCommission = cltList.reduce((sum, e) => sum + (e.remuneration_commission || 0), 0);
    const sumTotal = totalFixed + totalBonus + totalCommission;

    // Sector costs
    const sectorTotals: Record<string, { total: number; count: number }> = {};
    cltList.forEach(e => {
      const sector = e.department?.trim() || "Não Informado";
      const remuneration = e.remuneration || (e.remuneration_fixed || 0) + (e.remuneration_bonus || 0) + (e.remuneration_commission || 0);
      if (!sectorTotals[sector]) {
        sectorTotals[sector] = { total: 0, count: 0 };
      }
      sectorTotals[sector].total += remuneration;
      sectorTotals[sector].count += 1;
    });

    const sectorsSorted = Object.entries(sectorTotals)
      .map(([name, data]) => ({
        name,
        total: data.total,
        average: Math.round(data.total / data.count),
        count: data.count
      }))
      .sort((a, b) => b.total - a.total);

    return { totalFixed, totalBonus, totalCommission, sumTotal, sectorsSorted };
  })();

  // --- Calculations for Payroll PJ ---
  const payrollPjStats = (() => {
    const pjList = activeEmployees.filter(e => isExternalEntity(e.entityType || inferEntityType(e)));
    const totalFixed = pjList.reduce((sum, e) => sum + (e.remuneration_fixed || e.remuneration || 0), 0);
    const totalBonus = pjList.reduce((sum, e) => sum + (e.remuneration_bonus || 0), 0);
    const totalCommission = pjList.reduce((sum, e) => sum + (e.remuneration_commission || 0), 0);
    const sumTotal = totalFixed + totalBonus + totalCommission;

    // Sector costs
    const sectorTotals: Record<string, { total: number; count: number }> = {};
    pjList.forEach(e => {
      const sector = e.department?.trim() || "Não Informado";
      const remuneration = e.remuneration || (e.remuneration_fixed || 0) + (e.remuneration_bonus || 0) + (e.remuneration_commission || 0);
      if (!sectorTotals[sector]) {
        sectorTotals[sector] = { total: 0, count: 0 };
      }
      sectorTotals[sector].total += remuneration;
      sectorTotals[sector].count += 1;
    });

    const sectorsSorted = Object.entries(sectorTotals)
      .map(([name, data]) => ({
        name,
        total: data.total,
        average: Math.round(data.total / data.count),
        count: data.count
      }))
      .sort((a, b) => b.total - a.total);

    return { totalFixed, totalBonus, totalCommission, sumTotal, sectorsSorted };
  })();

  // --- Calculations for Loans ---
  const loansStats = (() => {
    const totalBalance = employees.reduce((sum, e) => sum + (e.balance || 0), 0);
    const totalTaken = employees.reduce((sum, e) => sum + (e.totalTaken || 0), 0);
    const monthlyReceivable = loanStats?.recebivelMes || employees.reduce((sum, e) => sum + (e.monthInstallment || 0), 0);

    // High exposure risk (active loan and contract expiring within 60 days)
    const expiringSoonWithLoans = employees.filter(e => {
      if (!e.balance || e.balance <= 0 || !e.contract_expiry_date) return false;
      const expiry = new Date(e.contract_expiry_date + "T12:00:00");
      const now = new Date();
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 60;
    });

    // High commitment ratio (loan installment / salary > 30%)
    const highCommitment = activeEmployees.filter(e => {
      const rem = e.remuneration || 1;
      const installment = e.monthInstallment || 0;
      return (installment / rem) > 0.3;
    });

    const activeDebtors = employees.filter(e => (e.balance || 0) > 0).sort((a, b) => (b.balance || 0) - (a.balance || 0));

    return { totalBalance, totalTaken, monthlyReceivable, expiringSoonWithLoans, highCommitment, activeDebtors };
  })();

  // --- Calculations for Critical Health ---
  const healthStats = (() => {
    const activeFiltered = filteredEmployees.filter(e => e.status !== 'Inativo');
    const criticalList = activeFiltered.filter(e => {
      const health = calculateEmployeeHealth(e);
      return health.status === "Crítico";
    }).map(e => ({ employee: e, health: calculateEmployeeHealth(e) }))
      .sort((a, b) => a.health.score - b.health.score);

    const incompleteList = activeFiltered.filter(e => {
      const health = calculateEmployeeHealth(e);
      return health.status === "Incompleto";
    });

    const completeList = activeFiltered.filter(e => {
      const health = calculateEmployeeHealth(e);
      return health.status === "Completo" || health.status === "Atenção";
    });

    let missingCpf = 0;
    let missingRole = 0;
    let missingPix = 0;
    let missingPhone = 0;
    let missingEmail = 0;

    activeFiltered.forEach(e => {
      const isPF = !isExternalEntity(e.entityType || inferEntityType(e));
      if (isPF) {
        if (!e.document_id) missingCpf++;
        if (!e.job_role) missingRole++;
        if (!e.pix_key) missingPix++;
        if (!e.phone_professional) missingPhone++;
        if (!e.email_professional) missingEmail++;
      } else {
        if (!e.corporate_name) missingRole++;
        if (!e.pj_type) missingCpf++;
        if (!e.responsible_name) missingEmail++;
      }
    });

    return { criticalList, incompleteList, completeList, missingCpf, missingRole, missingPix, missingPhone, missingEmail };
  })();

  // --- Calculations for Levels (E, T, O) ---
  const strategicStats = (() => {
    const activeFiltered = filteredEmployees.filter(e => e.status !== 'Inativo');
    
    const eList = activeFiltered.filter(e => getPBClassification(e.nivel, e.grau).startsWith("E"));
    const tList = activeFiltered.filter(e => getPBClassification(e.nivel, e.grau).startsWith("T"));
    const oList = activeFiltered.filter(e => getPBClassification(e.nivel, e.grau).startsWith("O"));

    const e1Count = eList.filter(e => getPBClassification(e.nivel, e.grau) === "E1").length;
    const e2Count = eList.filter(e => getPBClassification(e.nivel, e.grau) === "E2").length;
    const e3Count = eList.filter(e => getPBClassification(e.nivel, e.grau) === "E3").length;

    const t1Count = tList.filter(e => getPBClassification(e.nivel, e.grau) === "T1").length;
    const t2Count = tList.filter(e => getPBClassification(e.nivel, e.grau) === "T2").length;
    const t3Count = tList.filter(e => getPBClassification(e.nivel, e.grau) === "T3").length;

    const o1Count = oList.filter(e => getPBClassification(e.nivel, e.grau) === "O1").length;
    const o2Count = oList.filter(e => getPBClassification(e.nivel, e.grau) === "O2").length;
    const o3Count = oList.filter(e => getPBClassification(e.nivel, e.grau) === "O3").length;

    const marBR = eList.filter(e => e.company === "MarBR").length;
    const dzm = eList.filter(e => e.company === "DZM").length;
    const g2 = eList.filter(e => e.company === "G2").length;

    return {
      eList, tList, oList,
      eCount: eList.length, tCount: tList.length, oCount: oList.length,
      e1Count, e2Count, e3Count,
      t1Count, t2Count, t3Count,
      o1Count, o2Count, o3Count,
      marBR, dzm, g2
    };
  })();

  // --- Calculations for Sem PB-ID ---
  const nopbidStats = (() => {
    const activeFiltered = filteredEmployees.filter(e => e.status !== 'Inativo');
    const nopbidList = activeFiltered.filter(e => !(e.pbId || e.metadata?.pbId));
    return { nopbidList };
  })();

  // Render variables depending on mode
  const titleMap = {
    headcount: { text: "Força de Trabalho & Headcount", icon: <Users className="text-emerald-500" size={24} /> },
    headcount_clt: { text: "Integradores Internos CLT / PF", icon: <UserCheck className="text-blue-500" size={24} /> },
    headcount_pj: { text: "Prestadores de Serviços & PJ", icon: <Building2 className="text-amber-500" size={24} /> },
    payroll_clt: { text: "Custos de Folha CLT / Estágio", icon: <Coins className="text-emerald-500" size={24} /> },
    payroll_pj: { text: "Custos de Prestação PJ / MEI", icon: <Coins className="text-purple-500" size={24} /> },
    loans: { text: "Exposição de Empréstimos Consignados", icon: <Landmark className="text-amber-500" size={24} /> },
    health: { text: "Saúde da Base & Qualidade do Cadastro", icon: <HeartPulse className="text-rose-500" size={24} /> },
    audit: { text: "Auditoria & Incoerências", icon: <AlertCircle className="text-red-500" size={24} /> },
    strategic: { text: "Estrutura de Níveis Organizacionais (E, T, O)", icon: <Target className="text-indigo-500" size={24} /> },
    nopbid: { text: "Cadastros Sem PB-ID Associado", icon: <ShieldAlert className="text-amber-500" size={24} /> }
  };

  const { text: drawerTitle, icon: drawerIcon } = titleMap[mode];



  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Centered Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: "spring", damping: 30, stiffness: 240 }}
            className="w-full max-w-4xl h-[85vh] bg-slate-900 text-slate-100 flex flex-col border border-slate-800 shadow-2xl rounded-2xl overflow-hidden font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/20 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                  {drawerIcon}
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-widest uppercase text-slate-100">{drawerTitle}</h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Visão Executiva CHRO</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-700 hover:bg-slate-800 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 p-8 overflow-y-auto space-y-8">
              {/* --- HEADCOUNT MODE --- */}
              {mode === "headcount" && (
                <>
                  {/* Executive Overview Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tempo de Casa Médio</p>
                      <p className="text-3xl font-black text-emerald-400">{headcountStats.avgTenure}</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Colaboradores em Férias</p>
                      <p className="text-3xl font-black text-emerald-400">{headcountStats.ferias} Ativos</p>
                    </div>
                  </div>

                  {/* Vínculos / CLT vs PJ Gauge */}
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Composição de Regime de Trabalho</h3>

                    <div className="flex justify-between items-center text-sm font-bold text-slate-200">
                      <span>CLT: {headcountStats.clt} ({Math.round((headcountStats.clt / (activeEmployees.length || 1)) * 100)}%)</span>
                      <span>PJ/MEI: {headcountStats.mei} ({Math.round((headcountStats.mei / (activeEmployees.length || 1)) * 100)}%)</span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${(headcountStats.clt / (activeEmployees.length || 1)) * 100}%` }} />
                      <div className="h-full bg-amber-500" style={{ width: `${(headcountStats.mei / (activeEmployees.length || 1)) * 100}%` }} />
                      <div className="h-full bg-slate-600" style={{ width: `${(headcountStats.est / (activeEmployees.length || 1)) * 100}%` }} />
                    </div>

                    <div className="flex gap-6 pt-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" /> CLT: {headcountStats.clt}</div>
                      <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block" /> PJ/MEI: {headcountStats.mei}</div>
                      <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-slate-600 inline-block" /> Estágio: {headcountStats.est}</div>
                    </div>
                  </div>

                  {/* Distribuição por Empresa */}
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Divisão de Headcount por Empresa</h3>
                    <div className="flex justify-between items-center text-sm font-bold text-slate-200 flex-wrap gap-2">
                      <span>MarBR: {headcountStats.marBR} ({Math.round((headcountStats.marBR / (activeEmployees.length || 1)) * 100)}%)</span>
                      <span>DZM: {headcountStats.dzm} ({Math.round((headcountStats.dzm / (activeEmployees.length || 1)) * 100)}%)</span>
                      <span>G2: {headcountStats.g2} ({Math.round((headcountStats.g2 / (activeEmployees.length || 1)) * 100)}%)</span>
                    </div>
                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-600" style={{ width: `${(headcountStats.marBR / (activeEmployees.length || 1)) * 100}%` }} />
                      <div className="h-full bg-sky-500" style={{ width: `${(headcountStats.dzm / (activeEmployees.length || 1)) * 100}%` }} />
                      <div className="h-full bg-amber-500" style={{ width: `${(headcountStats.g2 / (activeEmployees.length || 1)) * 100}%` }} />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-5 bg-slate-950/10 border-l-4 border-emerald-500 text-sm text-slate-300 leading-relaxed rounded-r-xl">
                    A proporção atual de CLT vs. PJ está alinhada com as diretrizes do comitê financeiro. Para contratar novos prestadores de serviço, lembre-se de cadastrar o regime correto para auditorias futuras.
                  </div>
                </>
              )}

              {/* --- HEADCOUNT CLT MODE --- */}
              {mode === "headcount_clt" && (
                <>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Integrantes CLT</p>
                      <p className="text-3xl font-black text-blue-400">{headcountCltStats.cltCount} CLT</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estagiários</p>
                      <p className="text-3xl font-black text-blue-400">{headcountCltStats.estCount} Ativos</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Salário CLT Médio</p>
                      <p className="text-3xl font-black text-emerald-400">{formatCurrency(headcountCltStats.avgSalary)}</p>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Distribuição CLT por Empresa</h3>
                    <div className="flex justify-between items-center text-sm font-bold text-slate-200">
                      <span>MarBR: {headcountCltStats.marBR} ({Math.round((headcountCltStats.marBR / (headcountCltStats.cltList.length || 1)) * 100)}%)</span>
                      <span>DZM: {headcountCltStats.dzm} ({Math.round((headcountCltStats.dzm / (headcountCltStats.cltList.length || 1)) * 100)}%)</span>
                      <span>G2: {headcountCltStats.g2} ({Math.round((headcountCltStats.g2 / (headcountCltStats.cltList.length || 1)) * 100)}%)</span>
                    </div>
                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-500" style={{ width: `${(headcountCltStats.marBR / (headcountCltStats.cltList.length || 1)) * 100}%` }} />
                      <div className="h-full bg-sky-400" style={{ width: `${(headcountCltStats.dzm / (headcountCltStats.cltList.length || 1)) * 100}%` }} />
                      <div className="h-full bg-indigo-500" style={{ width: `${(headcountCltStats.g2 / (headcountCltStats.cltList.length || 1)) * 100}%` }} />
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Lista de Integradores CLT & Estagiários ({headcountCltStats.cltList.length})</h3>
                    <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto pr-2">
                      {headcountCltStats.cltList.map((emp, i) => (
                        <div key={i} className="py-3 flex justify-between items-center text-sm">
                          <div>
                            <p className="font-bold text-slate-200">{emp.name}</p>
                            <p className="text-xs text-slate-500">{emp.company} • {emp.department || "Sem Setor"} • {emp.job_role || "Sem Cargo"}</p>
                          </div>
                          <span className="text-xs font-black text-slate-300 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                            {emp.linkType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* --- HEADCOUNT PJ MODE --- */}
              {mode === "headcount_pj" && (
                <>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prestadores PJ / MEI</p>
                      <p className="text-3xl font-black text-amber-400">{headcountPjStats.pjList.length} Ativos</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Regime MEI</p>
                      <p className="text-3xl font-black text-amber-400">{headcountPjStats.meiCount} MEI</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contrato Médio</p>
                      <p className="text-3xl font-black text-emerald-400">{formatCurrency(headcountPjStats.avgContract)}</p>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Distribuição por Regime Tributário</h3>
                    <div className="flex justify-between items-center text-sm font-bold text-slate-200">
                      <span>MEI: {headcountPjStats.meiCount} ({Math.round((headcountPjStats.meiCount / (headcountPjStats.pjList.length || 1)) * 100)}%)</span>
                      <span>Simples Nacional: {headcountPjStats.simplesCount} ({Math.round((headcountPjStats.simplesCount / (headcountPjStats.pjList.length || 1)) * 100)}%)</span>
                      <span>Outros / Incompleto: {headcountPjStats.otherTaxCount} ({Math.round((headcountPjStats.otherTaxCount / (headcountPjStats.pjList.length || 1)) * 100)}%)</span>
                    </div>
                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-amber-500" style={{ width: `${(headcountPjStats.meiCount / (headcountPjStats.pjList.length || 1)) * 100}%` }} />
                      <div className="h-full bg-emerald-500" style={{ width: `${(headcountPjStats.simplesCount / (headcountPjStats.pjList.length || 1)) * 100}%` }} />
                      <div className="h-full bg-slate-600" style={{ width: `${(headcountPjStats.otherTaxCount / (headcountPjStats.pjList.length || 1)) * 100}%` }} />
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Lista de Prestadores PJ ({headcountPjStats.pjList.length})</h3>
                    <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto pr-2">
                      {headcountPjStats.pjList.map((emp, i) => (
                        <div key={i} className="py-3 flex justify-between items-center text-sm">
                          <div>
                            <p className="font-bold text-slate-200">{emp.corporate_name || emp.name}</p>
                            <p className="text-xs text-slate-500">
                              CNPJ: {emp.pj_type || "Não Informado"} • RL: {(emp.responsible_name || emp.name).toUpperCase()} • {emp.department || "Sem Setor"}
                            </p>
                          </div>
                          <span className="text-xs font-black text-slate-300 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 uppercase">
                            {emp.tax_regime || "Indefinido"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* --- PAYROLL CLT MODE --- */}
              {mode === "payroll_clt" && (
                <>
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Composição de Gastos CLT/Estágio Corrente</h3>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm font-bold text-slate-200">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Salário Fixo/Base</span>
                          <span className="font-extrabold">{formatCurrency(payrollCltStats.totalFixed)} ({Math.round((payrollCltStats.totalFixed / (payrollCltStats.sumTotal || 1)) * 100)}%)</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-slate-200">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Bônus Variável</span>
                          <span className="font-extrabold">{formatCurrency(payrollCltStats.totalBonus)} ({Math.round((payrollCltStats.totalBonus / (payrollCltStats.sumTotal || 1)) * 100)}%)</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-slate-200">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Comissão Variável</span>
                          <span className="font-extrabold">{formatCurrency(payrollCltStats.totalCommission)} ({Math.round((payrollCltStats.totalCommission / (payrollCltStats.sumTotal || 1)) * 100)}%)</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${(payrollCltStats.totalFixed / (payrollCltStats.sumTotal || 1)) * 100}%` }} />
                      <div className="h-full bg-sky-500" style={{ width: `${(payrollCltStats.totalBonus / (payrollCltStats.sumTotal || 1)) * 100}%` }} />
                      <div className="h-full bg-amber-500" style={{ width: `${(payrollCltStats.totalCommission / (payrollCltStats.sumTotal || 1)) * 100}%` }} />
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-sm font-black text-slate-200">
                      <span>SOMA TOTAL DE SALÁRIOS CLT:</span>
                      <span className="text-emerald-400 text-xl font-extrabold">{formatCurrency(payrollCltStats.sumTotal)}</span>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Gastos CLT por Setor</h3>

                    <div className="space-y-4">
                      {payrollCltStats.sectorsSorted.map((sec, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-200 font-bold">{sec.name} <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">({sec.count} CLT)</span></span>
                            <span className="text-slate-100 font-black">{formatCurrency(sec.total)}</span>
                          </div>
                          <div className="w-full h-3 bg-slate-800 rounded-md overflow-hidden">
                            <div className="h-full bg-emerald-600/70" style={{ width: `${(sec.total / (payrollCltStats.sectorsSorted[0]?.total || 1)) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* --- PAYROLL PJ MODE --- */}
              {mode === "payroll_pj" && (
                <>
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Composição de Gastos de Contratos PJ Corrente</h3>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm font-bold text-slate-200">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Contrato Fixo</span>
                          <span className="font-extrabold">{formatCurrency(payrollPjStats.totalFixed)} ({Math.round((payrollPjStats.totalFixed / (payrollPjStats.sumTotal || 1)) * 100)}%)</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-slate-200">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Bônus Variável PJ</span>
                          <span className="font-extrabold">{formatCurrency(payrollPjStats.totalBonus)} ({Math.round((payrollPjStats.totalBonus / (payrollPjStats.sumTotal || 1)) * 100)}%)</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-slate-200">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Comissão Variável PJ</span>
                          <span className="font-extrabold">{formatCurrency(payrollPjStats.totalCommission)} ({Math.round((payrollPjStats.totalCommission / (payrollPjStats.sumTotal || 1)) * 100)}%)</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-purple-500" style={{ width: `${(payrollPjStats.totalFixed / (payrollPjStats.sumTotal || 1)) * 100}%` }} />
                      <div className="h-full bg-sky-500" style={{ width: `${(payrollPjStats.totalBonus / (payrollPjStats.sumTotal || 1)) * 100}%` }} />
                      <div className="h-full bg-amber-500" style={{ width: `${(payrollPjStats.totalCommission / (payrollPjStats.sumTotal || 1)) * 100}%` }} />
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-sm font-black text-slate-200">
                      <span>SOMA TOTAL DE CONTRATOS PJ:</span>
                      <span className="text-purple-400 text-xl font-extrabold">{formatCurrency(payrollPjStats.sumTotal)}</span>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Gastos PJ por Setor</h3>

                    <div className="space-y-4">
                      {payrollPjStats.sectorsSorted.map((sec, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-200 font-bold">{sec.name} <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">({sec.count} PJ)</span></span>
                            <span className="text-slate-100 font-black">{formatCurrency(sec.total)}</span>
                          </div>
                          <div className="w-full h-3 bg-slate-800 rounded-md overflow-hidden">
                            <div className="h-full bg-purple-600/70" style={{ width: `${(sec.total / (payrollPjStats.sectorsSorted[0]?.total || 1)) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* --- LOANS MODE --- */}
              {mode === "loans" && (
                <>
                  {/* Executive Overview Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recebível no Próximo Ciclo</p>
                      <p className="text-3xl font-black text-amber-500">{formatCurrency(loansStats.monthlyReceivable)}</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total já Emprestado</p>
                      <p className="text-3xl font-black text-slate-300">{formatCurrency(loansStats.totalTaken)}</p>
                    </div>
                  </div>

                  {/* Risk Section 1: Expiring work contracts with active loans */}
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-500 border-b border-slate-800 pb-2">
                      <ShieldAlert size={16} />
                      <span>Risco: Vencimentos de Contratos (Próximos 60 dias)</span>
                    </div>

                    {loansStats.expiringSoonWithLoans.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">Nenhum contrato expirando com empréstimo ativo.</p>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {loansStats.expiringSoonWithLoans.map((emp, i) => (
                          <div key={i} className="py-3 flex justify-between items-center text-sm">
                            <div>
                              <p className="font-bold text-slate-200">{emp.name}</p>
                              <p className="text-xs text-slate-500">Expira em: {emp.contract_expiry_date ? new Date(emp.contract_expiry_date + "T12:00:00").toLocaleDateString('pt-BR') : '—'}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-amber-500">{formatCurrency(emp.balance)}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">SALDO PENDENTE</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Risk Section 2: Overexposure (Installment > 30% salary) */}
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-500 border-b border-slate-800 pb-2">
                      <Percent size={16} />
                      <span>Comprometimento de Renda &gt; 30%</span>
                    </div>

                    {loansStats.highCommitment.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">Nenhum colaborador com comprometimento acima do limite recomendado.</p>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {loansStats.highCommitment.map((emp, i) => {
                          const pct = Math.round((emp.monthInstallment / emp.remuneration) * 100);
                          return (
                            <div key={i} className="py-3 flex justify-between items-center text-sm">
                              <div>
                                <p className="font-bold text-slate-200">{emp.name}</p>
                                <p className="text-xs text-slate-500">Parcela: {formatCurrency(emp.monthInstallment)} / Salário: {formatCurrency(emp.remuneration)}</p>
                              </div>
                              <span className="px-3 py-1 bg-red-950 border border-red-800 text-red-400 font-bold rounded-lg text-xs">
                                {pct}% de Renda
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* List of all active debtors */}
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-500">
                        <Landmark size={16} />
                        <span>Detalhamento do Saldo Devedor</span>
                      </div>
                      <span className="text-sm font-black text-slate-200">{formatCurrency(loansStats.totalBalance)}</span>
                    </div>

                    {loansStats.activeDebtors.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">Nenhum saldo devedor em aberto.</p>
                    ) : (
                      <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto pr-2">
                        {loansStats.activeDebtors.map((emp, i) => (
                          <div key={i} className="py-3 flex justify-between items-center text-sm">
                            <div>
                              <p className="font-bold text-slate-200">{emp.name}</p>
                              <p className="text-xs text-slate-500">{emp.company} • {emp.linkType}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-emerald-400">{formatCurrency(emp.balance)}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase">SALDO ATUAL</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* --- HEALTH MODE --- */}
              {mode === "health" && (
                <>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Qualidade Crítica (&lt;50%)</p>
                      <p className="text-3xl font-black text-rose-500">{healthStats.criticalList.length} Fichas</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">Regular (50%-80%)</p>
                      <p className="text-3xl font-black text-orange-500">{healthStats.incompleteList.length} Fichas</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Completa / Alta (&gt;80%)</p>
                      <p className="text-3xl font-black text-emerald-500">{healthStats.completeList.length} Fichas</p>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Campos Faltantes mais Comuns</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-950/30 border border-slate-800 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">CPF / CNPJ</span>
                        <span className="text-xs font-black text-rose-400">{healthStats.missingCpf} pendentes</span>
                      </div>
                      <div className="p-4 bg-slate-950/30 border border-slate-800 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Cargo / Cadeira</span>
                        <span className="text-xs font-black text-rose-400">{healthStats.missingRole} pendentes</span>
                      </div>
                      <div className="p-4 bg-slate-950/30 border border-slate-800 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Chave PIX</span>
                        <span className="text-xs font-black text-rose-400">{healthStats.missingPix} pendentes</span>
                      </div>
                      <div className="p-4 bg-slate-950/30 border border-slate-800 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">Telefone</span>
                        <span className="text-xs font-black text-rose-400">{healthStats.missingPhone} pendentes</span>
                      </div>
                      <div className="p-4 bg-slate-950/30 border border-slate-800 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">E-mail</span>
                        <span className="text-xs font-black text-rose-400">{healthStats.missingEmail} pendentes</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Cadastros Críticos que Necessitam Revisão ({healthStats.criticalList.length})</h3>
                    {healthStats.criticalList.length === 0 ? (
                      <p className="text-sm text-slate-500 italic text-center py-4">Nenhum cadastro com saúde crítica.</p>
                    ) : (
                      <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto pr-2">
                        {healthStats.criticalList.map(({ employee, health: result }, i) => (
                          <div key={i} className="py-3 flex justify-between items-start text-sm gap-4">
                            <div>
                              <p className="font-bold text-slate-200">{employee.name}</p>
                              <p className="text-xs text-slate-500">{employee.company} • {employee.linkType} • {employee.department || "Sem Setor"}</p>
                              <p className="text-[10px] text-red-400 mt-1 font-bold">Faltantes: {result.missingFields.join(", ")}</p>
                            </div>
                            <span className="px-2.5 py-1 bg-rose-950 border border-rose-800 text-rose-400 font-bold rounded-lg text-xs shrink-0">
                              {result.score}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* --- AUDIT MODE --- */}
              {mode === "audit" && (
                <>
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-500 border-b border-slate-800 pb-2">
                      <ShieldAlert size={16} />
                      <span>Incoerências Encontradas ({Object.values(auditIssues).reduce((acc, curr) => acc + curr.length, 0)})</span>
                    </div>

                    {Object.values(auditIssues).every(issues => issues.length === 0) ? (
                      <div className="py-8 flex flex-col items-center justify-center text-emerald-500">
                        <UserCheck size={32} className="mb-2" />
                        <p className="text-sm font-bold">Base de Dados Saudável</p>
                        <p className="text-xs text-slate-400">Nenhuma incoerência encontrada nos prontuários ativos.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800">
                        {Object.entries(auditIssues).map(([empId, issues]) => {
                          if (issues.length === 0) return null;
                          const emp = employees.find(e => e.id === empId);
                          return (
                            <div key={empId} className="py-4 space-y-2">
                              <p className="font-bold text-slate-200">{emp?.name || "Desconhecido"}</p>
                              <ul className="space-y-1.5 pl-4 border-l-2 border-red-900/50">
                                {issues.map((issue, idx) => (
                                  <li key={idx} className="text-xs text-slate-400">
                                    <span className="font-bold text-red-400 uppercase mr-1">{issue.type}:</span>
                                    {issue.message}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* --- STRATEGIC MODE --- */}
              {mode === "strategic" && (
                <>
                  {/* Summary of Levels */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Estratégico (E)</p>
                      <p className="text-3xl font-black text-indigo-300">{strategicStats.eCount} Lideranças</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-sky-400 uppercase tracking-wider">Tático (T)</p>
                      <p className="text-3xl font-black text-sky-300">{strategicStats.tCount} Especialistas</p>
                    </div>
                    <div className="p-6 bg-slate-950/30 border border-slate-800 rounded-xl flex flex-col gap-1.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operacional (O)</p>
                      <p className="text-3xl font-black text-slate-300">{strategicStats.oCount} Operacionais</p>
                    </div>
                  </div>

                  {/* Level distributions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Estratégico (E) */}
                    <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 border-b border-slate-800 pb-2">Estratégico (E)</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>E1 (Direção):</span>
                          <span>{strategicStats.e1Count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${(strategicStats.e1Count / (strategicStats.eCount || 1)) * 100}%` }} />
                        </div>
                        
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>E2 (Gerência):</span>
                          <span>{strategicStats.e2Count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400" style={{ width: `${(strategicStats.e2Count / (strategicStats.eCount || 1)) * 100}%` }} />
                        </div>
                        
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>E3 (Coordenação/Superv):</span>
                          <span>{strategicStats.e3Count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-300" style={{ width: `${(strategicStats.e3Count / (strategicStats.eCount || 1)) * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Tático (T) */}
                    <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-sky-400 border-b border-slate-800 pb-2">Tático (T)</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>T1 (Sênior):</span>
                          <span>{strategicStats.t1Count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500" style={{ width: `${(strategicStats.t1Count / (strategicStats.tCount || 1)) * 100}%` }} />
                        </div>
                        
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>T2 (Pleno):</span>
                          <span>{strategicStats.t2Count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-400" style={{ width: `${(strategicStats.t2Count / (strategicStats.tCount || 1)) * 100}%` }} />
                        </div>
                        
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>T3 (Júnior):</span>
                          <span>{strategicStats.t3Count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-300" style={{ width: `${(strategicStats.t3Count / (strategicStats.tCount || 1)) * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Operacional (O) */}
                    <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-2">Operacional (O)</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>O1 (Grau III):</span>
                          <span>{strategicStats.o1Count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-500" style={{ width: `${(strategicStats.o1Count / (strategicStats.oCount || 1)) * 100}%` }} />
                        </div>
                        
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>O2 (Grau II):</span>
                          <span>{strategicStats.o2Count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-600" style={{ width: `${(strategicStats.o2Count / (strategicStats.oCount || 1)) * 100}%` }} />
                        </div>
                        
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>O3 (Grau I):</span>
                          <span>{strategicStats.o3Count}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-700" style={{ width: `${(strategicStats.o3Count / (strategicStats.oCount || 1)) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* List of leadership E */}
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Mapeamento de Lideranças (Nível E - {strategicStats.eCount})</h3>
                    <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto pr-2">
                      {strategicStats.eList.map((emp, i) => {
                        const level = getPBClassification(emp.nivel, emp.grau);
                        return (
                          <div key={i} className="py-3 flex justify-between items-center text-sm">
                            <div>
                              <p className="font-bold text-slate-200">{emp.name}</p>
                              <p className="text-xs text-slate-500">{emp.company} • {emp.department || "Sem Setor"} • {emp.job_role || "Sem Cargo"}</p>
                            </div>
                            <span className="text-xs font-black text-indigo-400 bg-indigo-950/50 px-3 py-1 rounded-lg border border-indigo-900/50">
                              Cadeira {level}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* --- SEM PB-ID MODE --- */}
              {mode === "nopbid" && (
                <>
                  <div className="p-5 bg-amber-950/20 border-l-4 border-amber-500 text-sm text-amber-300 leading-relaxed rounded-r-xl flex gap-3">
                    <Info size={20} className="shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-bold">Importância do ID Diana PB</p>
                      <p className="text-xs text-amber-400/90 mt-1">
                        O PB-ID é o código único identificador que conecta a ficha do colaborador nos demais sistemas e planilhas financeiras de folha consolidada. Cadastros sem ID Diana PB não são exportados nos relatórios estruturados de conciliação.
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Fichas Cadastrais Sem ID Vinculado ({nopbidStats.nopbidList.length})</h3>
                    {nopbidStats.nopbidList.length === 0 ? (
                      <p className="text-sm text-emerald-400 font-bold italic text-center py-4">Excelente! Todos os cadastros possuem um PB-ID ativo.</p>
                    ) : (
                      <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto pr-2">
                        {nopbidStats.nopbidList.map((emp, i) => (
                          <div key={i} className="py-3 flex justify-between items-center text-sm">
                            <div>
                              <p className="font-bold text-slate-200">{emp.name}</p>
                              <p className="text-xs text-slate-500">{emp.company} • {emp.linkType} • {emp.department || "Sem Setor"} • {emp.job_role || "Sem Cargo"}</p>
                            </div>
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50 uppercase tracking-widest">
                              Sem ID
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/40 text-center shrink-0">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Visualização restrita à Diretoria Executiva</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
