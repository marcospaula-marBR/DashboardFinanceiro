"use client";

import React from "react";
import { Employee, EntityType, RelationshipNature, getPBClassification, inferEntityType } from "@/types/loans";

export function isExternalEntity(entityType?: EntityType): boolean {
  return [
    'legal_entity',
    'partner',
    'supplier',
    'external_consultancy',
    'accredited_provider'
  ].includes(entityType as EntityType);
}

export function getCompanyLogoUrl(company?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const c = (company || '').toLowerCase();
  if (c.includes('dzm')) return origin + '/Logos/DZM.png';
  if (c.includes('grupo') || c.includes('g2')) return origin + '/Logos/Grupo%202.jpeg';
  if (c.includes('ybox')) return origin + '/Logos/Ybox.png';
  if (c.includes('conectius')) return origin + '/Logos/Conectius.png';
  if (c.includes('solucione')) return origin + '/Logos/Solucione.png';
  if (c.includes('brisinha')) return origin + '/Logos/BrisinhAI.jpeg';
  return origin + '/Logos/Mar-Brasil-sem-fundo-preto.png';
}

export function formatWhatsAppLink(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  if (normalized.length < 12) return null;
  return `https://wa.me/${normalized}`;
}

export function formatCompanyTime(startDateStr?: string, endDateStr?: string): string | null {
  if (!startDateStr) return null;
  const start = new Date(startDateStr + "T12:00:00");
  const end = endDateStr ? new Date(endDateStr + "T12:00:00") : new Date();
  
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months -= start.getMonth();
  months += end.getMonth();
  
  if (end.getDate() < start.getDate()) {
    months--;
  }

  if (months < 0) return "Admissão futura";
  if (months === 0) return "Menos de 1 mês";
  
  const y = Math.floor(months / 12);
  const m = months % 12;
  
  const yStr = y > 0 ? `${y} ${y === 1 ? 'ano' : 'anos'}` : '';
  const mStr = m > 0 ? `${m} ${m === 1 ? 'mês' : 'meses'}` : '';
  
  const timeStr = yStr && mStr ? `${yStr} e ${mStr}` : (yStr || mStr);
  return endDateStr ? `${timeStr} (Distrato)` : timeStr;
}

// ─── Classification Badge (E1 to O3 with Stars) ──────────────────────────────

export function PeopleClassificationBadge({ 
  level, 
  degree 
}: { 
  level?: string; 
  degree?: string | number;
}) {
  if (!level) {
    return (
      <span 
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 cursor-help"
        title="Classificação PB não gerada por falta de Camada (Estratégico/Tático/Operacional)."
      >
        ⚠️ S/ Classificação
      </span>
    );
  }

  const code = getPBClassification(level, degree || '3'); // Ex: E1, T2
  
  const PB_CLASSIFICATION_LABELS: Record<string, string> = {
    E1: "Estratégico Avançado",
    E2: "Estratégico Intermediário",
    E3: "Estratégico Iniciante",
    T1: "Tático Avançado",
    T2: "Tático Intermediário",
    T3: "Tático Iniciante",
    O1: "Operacional Avançado",
    O2: "Operacional Intermediário",
    O3: "Operacional Iniciante",
  };

  // Matriz de estrelas com base no Grau
  const stars = String(code).slice(1);
  const starSymbol = stars === "1" ? "⭐" : stars === "2" ? "⭐⭐" : "⭐⭐⭐";

  // Estilização baseada no Nível
  const levelChar = String(code).charAt(0);
  let bgStyles = "bg-sky-50 text-sky-700 border-sky-100"; // Operacional (O)
  if (levelChar === "E") bgStyles = "bg-amber-50 text-amber-700 border-amber-200"; // Estratégico
  else if (levelChar === "T") bgStyles = "bg-emerald-50 text-emerald-700 border-emerald-100"; // Tático

  const label = PB_CLASSIFICATION_LABELS[code] || "Classificação Desconhecida";

  return (
    <span 
      className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border uppercase leading-tight select-none shadow-sm cursor-help ${bgStyles}`}
      title={`Classificação PB: ${code} - ${label}`}
    >
      <span>{code}</span>
      <span className="text-[8px] tracking-tighter opacity-90">{starSymbol}</span>
    </span>
  );
}

// ─── Relationship Nature Badge ───────────────────────────────────────────────

export const RELATIONSHIP_NATURE_LABELS: Record<RelationshipNature, string> = {
  CLT: "CLT",
  "PJ-MEI": "PJ-MEI",
  "PJ-Simples": "PJ-Simples",
  clt_internal: "CLT",
  pj_specialized: "PJ-MEI",
  accredited_company: "PJ-Simples",
};

const RELATIONSHIP_NATURE_STYLES: Record<RelationshipNature, string> = {
  CLT: "bg-blue-50 text-blue-700 border-blue-150",
  "PJ-MEI": "bg-amber-50 text-amber-700 border-amber-150",
  "PJ-Simples": "bg-purple-50 text-purple-700 border-purple-150",
  clt_internal: "bg-blue-50 text-blue-700 border-blue-150",
  pj_specialized: "bg-amber-50 text-amber-700 border-amber-150",
  accredited_company: "bg-purple-50 text-purple-700 border-purple-150",
};

export function RelationshipNatureBadge({ 
  nature 
}: { 
  nature?: RelationshipNature;
}) {
  if (!nature) {
    return (
      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 uppercase">
        Vínculo Indefinido
      </span>
    );
  }

  const label = RELATIONSHIP_NATURE_LABELS[nature] || nature;
  const style = RELATIONSHIP_NATURE_STYLES[nature] || "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide leading-tight shadow-sm ${style}`}>
      {label}
    </span>
  );
}

// ─── Health / Data Quality Badge (Saúde Cadastral) ───────────────────────────

export interface HealthResult {
  score: number;
  status: "Completo" | "Atenção" | "Incompleto" | "Crítico";
  colorClass: string;
  badgeStyle: string;
  missingFields: string[];
}

export function calculateEmployeeHealth(employee: Partial<Employee>): HealthResult {
  const type = inferEntityType(employee);
  const missingFields: string[] = [];
  let score = 0;

  if (type === "internal_person") {
    // PF Internal parameters (Total weight = 100)
    // 1. Nome (15)
    if (employee.name && employee.name.trim().length > 0) score += 15;
    else missingFields.push("Nome completo");

    // 2. PB-ID (15)
    const pbId = employee.pbId || employee.metadata?.pbId;
    if (pbId && String(pbId).trim().length > 0) score += 15;
    else missingFields.push("Diana PB / PB-ID");

    // 3. Cadeira ou Departamento (15)
    if (employee.job_role || employee.department) score += 15;
    else missingFields.push("Cadeira ou Departamento");

    // 4. Nível (10)
    if (employee.nivel) score += 10;
    else missingFields.push("Nível organizacional");

    // 5. Grau (10)
    if (employee.grau) score += 10;
    else missingFields.push("Grau de maturidade");

    // 6. E-mail profissional (15)
    if (employee.email_professional && employee.email_professional.trim().length > 0) score += 15;
    else missingFields.push("E-mail profissional");

    // 7. Telefone profissional (15)
    if (employee.phone_professional && employee.phone_professional.trim().length > 0) score += 15;
    else missingFields.push("Telefone profissional");

    // 8. Status (5)
    if (employee.status) score += 5;
    else missingFields.push("Status");
  } else {
    // PJ / External parameters (Total weight = 100)
    // 1. Razão Social (15)
    if (employee.corporate_name && employee.corporate_name.trim().length > 0) score += 15;
    else missingFields.push("Razão Social");

    // 2. CNPJ (15)
    if (employee.pj_type && employee.pj_type.trim().length > 0) score += 15;
    else missingFields.push("CNPJ");

    // 3. Responsável Técnico (15)
    if (employee.responsible_name && employee.responsible_name.trim().length > 0) score += 15;
    else missingFields.push("Responsável Técnico");

    // 4. Natureza da Relação (15)
    const nature = employee.relationshipNature || employee.metadata?.relationshipNature;
    if (nature) score += 15;
    else missingFields.push("Natureza da Relação");

    // 5. Cadeira ou Órbita (15)
    if (employee.job_role || employee.department) score += 15;
    else missingFields.push("Cadeira ou Órbita");

    // 6. Nível (10)
    if (employee.nivel) score += 10;
    else missingFields.push("Nível organizacional");

    // 7. Grau (10)
    if (employee.grau) score += 10;
    else missingFields.push("Grau de maturidade");

    // 8. Status (5)
    if (employee.status) score += 5;
    else missingFields.push("Status");
  }

  let status: HealthResult["status"] = "Crítico";
  let colorClass = "text-rose-600";
  let badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";

  if (score === 100) {
    status = "Completo";
    colorClass = "text-emerald-600";
    badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
  } else if (score >= 80) {
    status = "Atenção";
    colorClass = "text-amber-600";
    badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (score >= 50) {
    status = "Incompleto";
    colorClass = "text-orange-600";
    badgeStyle = "bg-orange-50 text-orange-700 border-orange-100";
  }

  return {
    score,
    status,
    colorClass,
    badgeStyle,
    missingFields
  };
}

export function PeopleHealthBadge({ 
  employee 
}: { 
  employee: Partial<Employee>;
}) {
  const { score, status, badgeStyle, missingFields } = calculateEmployeeHealth(employee);

  const titleText = missingFields.length > 0 
    ? `Saúde Cadastral: ${score}% (${status}). Campos ausentes:\n- ${missingFields.join("\n- ")}`
    : `Cadastro Completo: ${score}% de integridade.`;

  return (
    <span 
      className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded border uppercase leading-tight select-none cursor-help shadow-sm ${badgeStyle}`}
      title={titleText}
    >
      <span>Qualidade: {status}</span>
      <span className="opacity-80 text-[8px] font-mono">({score}%)</span>
    </span>
  );
}
