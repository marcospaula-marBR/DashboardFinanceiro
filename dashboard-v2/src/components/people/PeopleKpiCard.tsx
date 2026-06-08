"use client";
import { ReactNode } from "react";

interface PeopleKpiCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: "emerald" | "blue" | "amber" | "slate" | "red" | "rose" | "indigo" | "purple";
  sub?: string;
  breakdown?: { label: string; value: string }[];
  onClick?: () => void;
  isActive?: boolean;
}

const colorMap = {
  emerald: {
    bg: "bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-600",
    border: "border-emerald-100",
    value: "text-emerald-700",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-100 text-blue-600",
    border: "border-blue-100",
    value: "text-blue-700",
  },
  amber: {
    bg: "bg-amber-50",
    icon: "bg-amber-100 text-amber-600",
    border: "border-amber-100",
    value: "text-amber-700",
  },
  slate: {
    bg: "bg-slate-50",
    icon: "bg-slate-100 text-slate-600",
    border: "border-slate-200",
    value: "text-slate-700",
  },
  red: {
    bg: "bg-red-50",
    icon: "bg-red-100 text-red-600",
    border: "border-red-100",
    value: "text-red-700",
  },
  rose: {
    bg: "bg-rose-50",
    icon: "bg-rose-100 text-rose-600",
    border: "border-rose-100",
    value: "text-rose-700",
  },
  indigo: {
    bg: "bg-indigo-50",
    icon: "bg-indigo-100 text-indigo-600",
    border: "border-indigo-100",
    value: "text-indigo-700",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-100 text-purple-600",
    border: "border-purple-100",
    value: "text-purple-700",
  },
};

export function PeopleKpiCard({
  title,
  value,
  icon,
  color = "slate",
  sub,
  breakdown,
  onClick,
  isActive = false,
}: PeopleKpiCardProps) {
  const c = colorMap[color];

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-3 ${
        onClick ? "cursor-pointer hover:-translate-y-1 hover:shadow-lg" : ""
      } ${c.bg} ${isActive ? `ring-2 ring-offset-2 ring-${color}-400 shadow-md ${c.border}` : c.border}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c.icon}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <p className={`text-2xl font-black leading-tight ${c.value}`}>{value}</p>
        </div>
      </div>

      {sub && (
        <p className="text-[11px] text-slate-500 leading-relaxed">{sub}</p>
      )}

      {breakdown && breakdown.length > 0 && (
        <div className="flex gap-3 pt-1 border-t border-slate-100">
          {breakdown.map((b, i) => (
            <div key={i}>
              <p className="text-[9px] font-bold text-slate-400 uppercase">{b.label}</p>
              <p className="text-xs font-bold text-slate-700">{b.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
