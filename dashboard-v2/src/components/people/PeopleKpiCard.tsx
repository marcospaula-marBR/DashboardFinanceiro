"use client";
import { ReactNode } from "react";

interface PeopleKpiCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: "emerald" | "blue" | "amber" | "slate" | "red";
  sub?: string;
  breakdown?: { label: string; value: string }[];
  onClick?: () => void;
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
};

export function PeopleKpiCard({
  title,
  value,
  icon,
  color = "slate",
  sub,
  breakdown,
  onClick,
}: PeopleKpiCardProps) {
  const c = colorMap[color];

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border ${c.border} shadow-sm p-5 flex flex-col gap-3 ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
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
