"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Coins, AlertCircle, Building2, UserCheck, Calendar, ShieldAlert, Award, Landmark, Percent } from "lucide-react";
import { Employee, MonthlyCost, LoanStats } from "@/types/loans";
import { formatCurrency } from "@/services/loans.service";

interface KPIStatsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "headcount" | "payroll" | "loans" | null;
  employees: Employee[];
  monthlyCosts: MonthlyCost[];
  loanStats: LoanStats | null;
}

export function KPIStatsDrawer({ isOpen, onClose, mode, employees, monthlyCosts, loanStats }: KPIStatsDrawerProps) {
  if (!mode) return null;

  const activeEmployees = employees.filter(e => e.status === "Ativo" || e.status === "Férias" || e.status === "Provisão");

  // --- Calculations for Headcount ---
  const headcountStats = (() => {
    const clt = activeEmployees.filter(e => e.linkType === "CLT").length;
    const mei = activeEmployees.filter(e => e.linkType === "MEI" || e.linkType === "PJ").length;
    const est = activeEmployees.filter(e => e.linkType === "Estagiário").length;
    const marBR = activeEmployees.filter(e => e.company === "MarBR").length;
    const dzm = activeEmployees.filter(e => e.company === "DZM").length;
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

    return { clt, mei, est, marBR, dzm, ferias, avgTenure };
  })();

  // --- Calculations for Payroll ---
  const payrollStats = (() => {
    const totalFixed = activeEmployees.reduce((sum, e) => sum + (e.remuneration_fixed || 0), 0);
    const totalBonus = activeEmployees.reduce((sum, e) => sum + (e.remuneration_bonus || 0), 0);
    const totalCommission = activeEmployees.reduce((sum, e) => sum + (e.remuneration_commission || 0), 0);
    const sumTotal = totalFixed + totalBonus + totalCommission;

    // Sector costs
    const sectorTotals: Record<string, { total: number; count: number }> = {};
    activeEmployees.forEach(e => {
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

    return { totalBalance, totalTaken, monthlyReceivable, expiringSoonWithLoans, highCommitment };
  })();

  // Render variables depending on mode
  const titleMap = {
    headcount: { text: "Força de Trabalho & Headcount", icon: <Users className="text-emerald-500" size={24} /> },
    payroll: { text: "Custo de Folha & Verbas", icon: <Coins className="text-emerald-500" size={24} /> },
    loans: { text: "Exposição de Empréstimos", icon: <Landmark className="text-amber-500" size={24} /> }
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
                    <div className="flex justify-between items-center text-sm font-bold text-slate-200">
                      <span>MarBR: {headcountStats.marBR} ({Math.round((headcountStats.marBR / (activeEmployees.length || 1)) * 100)}%)</span>
                      <span>DZM: {headcountStats.dzm} ({Math.round((headcountStats.dzm / (activeEmployees.length || 1)) * 100)}%)</span>
                    </div>
                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-600" style={{ width: `${(headcountStats.marBR / (activeEmployees.length || 1)) * 100}%` }} />
                      <div className="h-full bg-sky-500" style={{ width: `${(headcountStats.dzm / (activeEmployees.length || 1)) * 100}%` }} />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-5 bg-slate-950/10 border-l-4 border-emerald-500 text-sm text-slate-300 leading-relaxed rounded-r-xl">
                    A proporção atual de CLT vs. PJ está alinhada com as diretrizes do comitê financeiro. Para contratar novos prestadores de serviço, lembre-se de cadastrar o regime correto para auditorias futuras.
                  </div>
                </>
              )}

              {/* --- PAYROLL MODE --- */}
              {mode === "payroll" && (
                <>
                  {/* Detailed Verbas Grid */}
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Composição de Gastos Corrente</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm font-bold text-slate-200">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Salário Fixo/Base</span>
                          <span className="font-extrabold">{formatCurrency(payrollStats.totalFixed)} ({Math.round((payrollStats.totalFixed / (payrollStats.sumTotal || 1)) * 100)}%)</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-slate-200">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Bônus Variável</span>
                          <span className="font-extrabold">{formatCurrency(payrollStats.totalBonus)} ({Math.round((payrollStats.totalBonus / (payrollStats.sumTotal || 1)) * 100)}%)</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm font-bold text-slate-200">
                          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Comissão Variável</span>
                          <span className="font-extrabold">{formatCurrency(payrollStats.totalCommission)} ({Math.round((payrollStats.totalCommission / (payrollStats.sumTotal || 1)) * 100)}%)</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${(payrollStats.totalFixed / (payrollStats.sumTotal || 1)) * 100}%` }} />
                      <div className="h-full bg-sky-500" style={{ width: `${(payrollStats.totalBonus / (payrollStats.sumTotal || 1)) * 100}%` }} />
                      <div className="h-full bg-amber-500" style={{ width: `${(payrollStats.totalCommission / (payrollStats.sumTotal || 1)) * 100}%` }} />
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-sm font-black text-slate-200">
                      <span>SOMA TOTAL DE SALÁRIOS:</span>
                      <span className="text-emerald-400 text-xl font-extrabold">{formatCurrency(payrollStats.sumTotal)}</span>
                    </div>
                  </div>

                  {/* Sectors Expenditure ranking */}
                  <div className="p-6 bg-slate-950/20 border border-slate-800 rounded-xl space-y-5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 border-b border-slate-800 pb-2">Gastos por Setor (Remunerações Consolidadas)</h3>
                    
                    <div className="space-y-4">
                      {payrollStats.sectorsSorted.slice(0, 5).map((sec, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-200 font-bold">{sec.name} <span className="text-[10px] text-slate-500 font-bold uppercase ml-1">({sec.count} colaboradores)</span></span>
                            <span className="text-slate-100 font-black">{formatCurrency(sec.total)}</span>
                          </div>
                          <div className="w-full h-3 bg-slate-800 rounded-md overflow-hidden">
                            <div className="h-full bg-emerald-600/70" style={{ width: `${(sec.total / (payrollStats.sectorsSorted[0]?.total || 1)) * 100}%` }} />
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
