"use client";
import { EmploymentContract } from "@/types/loans";
import { Building2, ArrowRight, Briefcase, UserCheck } from "lucide-react";

interface AdditiveEvent {
  event_type: string;
  change_date: string;
  observations?: string;
}

interface EmploymentBondTimelineProps {
  bonds: EmploymentContract[];
  startDate?: string;
  additives?: AdditiveEvent[];
}

const VINCULO_COLORS: Record<string, string> = {
  CLT: "bg-blue-100 text-blue-700 border-blue-200",
  MEI: "bg-orange-100 text-orange-700 border-orange-200",
  PJ: "bg-orange-100 text-orange-700 border-orange-200",
  Estagiário: "bg-purple-100 text-purple-700 border-purple-200",
};

const VINCULO_DOT: Record<string, string> = {
  CLT: "bg-blue-500",
  MEI: "bg-orange-500",
  PJ: "bg-orange-500",
  Estagiário: "bg-purple-500",
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function computeTenure(start: string, end?: string): string {
  const from = new Date(start + "T00:00:00");
  const to = end ? new Date(end + "T00:00:00") : new Date();
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem}m`;
  if (rem === 0) return `${years}a`;
  return `${years}a ${rem}m`;
}

type EventType = "admission" | "bond" | "additive" | "current";

interface TimelineEvent {
  date: string;
  type: EventType;
  label: string;
  sub?: string;
  vinculo?: string;
}

export function EmploymentBondTimeline({
  bonds,
  startDate,
  additives = [],
}: EmploymentBondTimelineProps) {
  const events: TimelineEvent[] = [];

  const admissionDate = startDate || bonds[0]?.start_date;
  if (admissionDate) {
    const firstBond = bonds[0];
    events.push({
      date: admissionDate,
      type: "admission",
      label: "Admissão",
      sub: firstBond
        ? `${firstBond.regime} • ${firstBond.contracting_company || "MarBR"}`
        : "",
      vinculo: firstBond?.regime,
    });
  }

  bonds.slice(1).forEach((bond) => {
    events.push({
      date: bond.start_date,
      type: "bond",
      label: bond.trigger_reason
        ? `Transição: ${bond.trigger_reason}`
        : "Mudança de Vínculo",
      sub: `${bond.regime} • ${bond.contracting_company || "MarBR"}`,
      vinculo: bond.regime,
    });
  });

  additives
    .filter((a) => ["Cargo", "Remuneração", "Setor"].includes(a.event_type))
    .forEach((a) => {
      events.push({
        date: a.change_date,
        type: "additive",
        label: `Aditivo — ${a.event_type}`,
        sub: a.observations || "",
      });
    });

  events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const currentBond = bonds.find((b) => !b.end_date);
  if (currentBond) {
    events.push({
      date: new Date().toISOString().slice(0, 10),
      type: "current",
      label: "Situação Atual",
      sub: `${currentBond.regime} • ${currentBond.contracting_company || "MarBR"}`,
      vinculo: currentBond.regime,
    });
  }

  const totalTenure = admissionDate ? computeTenure(admissionDate) : null;

  if (events.length === 0) {
    return (
      <div className="text-center py-10">
        <Briefcase className="mx-auto mb-3 text-slate-300" size={32} />
        <p className="text-base text-slate-500">
          Nenhum vínculo registrado ainda.
        </p>
        <p className="text-sm text-slate-400 mt-1">
          Adicione um vínculo para construir a trajetória.
        </p>
      </div>
    );
  }

  const dotColor = (type: EventType, vinculo?: string): string => {
    if (type === "admission") return "bg-emerald-500";
    if (type === "current")
      return "bg-emerald-400 ring-4 ring-emerald-100 animate-pulse";
    if (type === "bond" && vinculo)
      return VINCULO_DOT[vinculo] || "bg-slate-400";
    return "bg-blue-400";
  };

  return (
    <div className="space-y-1">
      {totalTenure && (
        <div className="flex items-center gap-2 mb-5 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
          <UserCheck className="text-emerald-600" size={16} />
          <p className="text-sm font-bold text-emerald-800">
            Tempo total na empresa:{" "}
            <span className="text-emerald-600 font-black">{totalTenure}</span>
          </p>
        </div>
      )}

      <div className="relative">
        <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-slate-100" />

        <div className="space-y-4">
          {events.map((ev, i) => (
            <div key={i} className="flex gap-4 relative">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm z-10 ${dotColor(ev.type, ev.vinculo)}`}
              >
                {ev.type === "admission" && (
                  <Building2 className="text-white" size={14} />
                )}
                {ev.type === "bond" && (
                  <ArrowRight className="text-white" size={14} />
                )}
                {ev.type === "additive" && (
                  <Briefcase className="text-white" size={12} />
                )}
                {ev.type === "current" && (
                  <UserCheck className="text-white" size={14} />
                )}
              </div>

              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {ev.label}
                    </p>
                    {ev.sub && (
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {ev.sub}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-500 shrink-0 whitespace-nowrap">
                    {ev.type === "current" ? "Hoje" : formatDate(ev.date)}
                  </span>
                </div>

                {ev.vinculo && ev.type !== "additive" && (
                  <span
                    className={`inline-flex items-center mt-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                      VINCULO_COLORS[ev.vinculo] ||
                      "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {ev.vinculo}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
