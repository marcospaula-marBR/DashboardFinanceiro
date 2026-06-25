"use client";

import React, { useState, useMemo } from "react";
import { Employee, getRemunerationLabel, getPBClassification } from "@/types/loans";
import { Building2, UserRound, ArrowUpRight, ArrowDownRight, ArrowLeftRight, HelpCircle, Network, Users } from "lucide-react";
import { isExternalEntity, PeopleClassificationBadge, RelationshipNatureBadge, PeopleHealthBadge, formatCompanyTime } from "./PeopleBadges";
import { motion, AnimatePresence } from "framer-motion";

interface PeopleEcosystemMapProps {
  employees: Employee[];
  onEmployeeClick: (id: string) => void;
  showValues: boolean;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function PeopleEcosystemMap({
  employees,
  onEmployeeClick,
  showValues,
}: PeopleEcosystemMapProps) {
  // Estado local para destacar conexões (hover ou click/toque)
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false); // Para dispositivos móveis / cliques

  const activeEmployee = useMemo(() => {
    if (!activeId) return null;
    return employees.find(e => e.id === activeId) || null;
  }, [activeId, employees]);

  // Função para classificar o orbit
  const getOrbit = (e: Employee): 'E' | 'T' | 'O' => {
    const code = getPBClassification(e.nivel, e.grau);
    if (code.startsWith('E')) return 'E';
    if (code.startsWith('T')) return 'T';
    if (code.startsWith('O')) return 'O';
    // Fallback baseando-se na string literal
    const n = String(e.nivel || '').toUpperCase();
    if (n.includes('ESTRAT') || n === 'E') return 'E';
    if (n.includes('TAT') || n === 'T') return 'T';
    return 'O';
  };

  // Agrupamento por órbita (apenas Ativos por padrão na tela)
  const activeMembers = useMemo(() => employees.filter(e => e.status !== 'Inativo'), [employees]);

  // Função de relacionamento bidirecional (movida para cima para poder ser usada na ordenação)
  const getConnectionType = (a: Employee, b: Employee): 'above' | 'below' | 'equivalent' | null => {
    if (a.id === b.id) return null;

    // 1. Relação declarada de A apontando para B
    const relFromAToB = a.relationships?.find(r => r.employee_id === b.id);
    if (relFromAToB) {
      if (relFromAToB.relation_type === 'orientadora') return 'above'; // B está acima de A
      if (relFromAToB.relation_type === 'apoiada') return 'below';     // B está abaixo de A
      if (relFromAToB.relation_type === 'equivalent') return 'equivalent';
      return 'equivalent'; // Fallback
    }

    // 2. Relação declarada de B apontando para A (Inverso)
    const relFromBToA = b.relationships?.find(r => r.employee_id === a.id);
    if (relFromBToA) {
      if (relFromBToA.relation_type === 'orientadora') return 'below'; // A está acima de B -> B está abaixo de A
      if (relFromBToA.relation_type === 'apoiada') return 'above';     // A está abaixo de B -> B está acima de A
      if (relFromBToA.relation_type === 'equivalent') return 'equivalent';
      return 'equivalent'; // Fallback
    }

    return null;
  };

  const sortEcosystem = (list: Employee[]) => {
    // Evitar tremulação (flicker): se for apenas hover (não travado por clique), não reordenamos o DOM.
    // O reordenamento afasta o card do mouse, causando loop infinito de onMouseLeave/onMouseEnter.
    if (!activeEmployee || !isLocked) return list;

    return [...list].sort((a, b) => {
      // 1º O elemento ativo em si sempre em primeiro
      if (a.id === activeId) return -1;
      if (b.id === activeId) return 1;
      // 2º Quem está relacionado vem logo depois
      const connA = getConnectionType(activeEmployee, a) !== null;
      const connB = getConnectionType(activeEmployee, b) !== null;
      if (connA && !connB) return -1;
      if (!connA && connB) return 1;
      // 3º Ordem alfabética
      const nameA = (a.corporate_name || a.name || "").toLowerCase();
      const nameB = (b.corporate_name || b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  };

  const strategic = useMemo(() => sortEcosystem(activeMembers.filter(e => getOrbit(e) === 'E')), [activeMembers, activeEmployee, activeId]);
  const tactical = useMemo(() => sortEcosystem(activeMembers.filter(e => getOrbit(e) === 'T')), [activeMembers, activeEmployee, activeId]);
  const operational = useMemo(() => sortEcosystem(activeMembers.filter(e => getOrbit(e) === 'O')), [activeMembers, activeEmployee, activeId]);

  // Tratar interação
  const handleMouseEnter = (id: string) => {
    if (!isLocked) {
      setActiveId(id);
    }
  };

  const handleMouseLeave = () => {
    if (!isLocked) {
      setActiveId(null);
    }
  };

  const handleCardClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeId === id) {
      if (isLocked) {
        // Segundo clique: abre os detalhes/ficha
        onEmployeeClick(id);
        setActiveId(null);
        setIsLocked(false);
      } else {
        setIsLocked(true);
      }
    } else {
      setActiveId(id);
      setIsLocked(true);
    }
  };

  const handleResetHighlight = () => {
    setActiveId(null);
    setIsLocked(false);
  };

  // Renderizar o card no mapa
  const renderEcosystemCard = (emp: Employee) => {
    const isExternal = isExternalEntity(emp.entityType);
    const displayName = isExternal && emp.corporate_name ? emp.corporate_name : emp.name;
    const avatarSrc = emp.photo_url || emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=e2e8f0&color=475569&bold=true`;
    
    // Determinar classes com base no estado de destaque
    let focusClass = "border-slate-200 bg-white hover:border-slate-300";
    let opacityStyle: React.CSSProperties = {};
    let connType: 'above' | 'below' | 'equivalent' | null = null;

    if (activeEmployee) {
      if (activeEmployee.id === emp.id) {
        focusClass = "border-emerald-500 ring-4 ring-emerald-100/50 bg-emerald-50/20 scale-[1.03] shadow-md z-20";
      } else {
        connType = getConnectionType(activeEmployee, emp);
        if (connType) {
          // Relacionado
          if (connType === 'above') focusClass = "border-amber-500 ring-4 ring-amber-100/50 bg-amber-50/10 scale-[1.01] z-10";
          else if (connType === 'below') focusClass = "border-sky-500 ring-4 ring-sky-100/50 bg-sky-50/10 scale-[1.01] z-10";
          else focusClass = "border-slate-400 ring-4 ring-slate-100/50 bg-slate-50/20 scale-[1.01] z-10";
        } else {
          // Não relacionado: aplicar fade-out suave
          opacityStyle = { opacity: 0.25, filter: "grayscale(60%) scale(0.97)" };
        }
      }
    }

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        key={emp.id}
        onMouseEnter={() => handleMouseEnter(emp.id)}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => handleCardClick(e, emp.id)}
        style={opacityStyle}
        className={`relative border rounded-2xl p-4 transition-all duration-300 cursor-pointer select-none ${focusClass} ${
          isExternal ? "border-amber-100/80 bg-gradient-to-br from-white to-amber-50/5" : ""
        }`}
      >
        {/* Connection Type Overlay Label */}
        {connType && (
          <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm border animate-in fade-in zoom-in duration-200 bg-white">
            {connType === 'above' && (
              <span className="text-amber-700 flex items-center gap-0.5">
                <ArrowUpRight size={10} className="stroke-[3]" /> Acima
              </span>
            )}
            {connType === 'below' && (
              <span className="text-sky-700 flex items-center gap-0.5">
                <ArrowDownRight size={10} className="stroke-[3]" /> Abaixo
              </span>
            )}
            {connType === 'equivalent' && (
              <span className="text-slate-700 flex items-center gap-0.5">
                <ArrowLeftRight size={10} className="stroke-[3]" /> Equivalente
              </span>
            )}
          </div>
        )}

        <div className="flex items-start gap-3">
          {isExternal ? (
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 shadow-inner">
              <Building2 size={18} />
            </div>
          ) : (
            <img
              src={avatarSrc}
              alt={displayName}
              className="w-10 h-10 rounded-xl object-cover border border-slate-100 shrink-0 shadow-sm"
            />
          )}

          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-black text-slate-800 truncate tracking-tight uppercase">
              {displayName}
            </h4>
            
            <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
              {isExternal
                ? `RL: ${emp.responsible_name || 'Indefinido'}`
                : (emp.job_role || 'Sem Cadeira')}
            </p>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <PeopleClassificationBadge level={emp.nivel} degree={emp.grau} />
              <RelationshipNatureBadge nature={emp.relationshipNature} />
            </div>
          </div>
        </div>

        {/* Rodé Interno do Card */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
          {/* Data de início + Tempo de empresa */}
          {emp.start_date && (
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] text-slate-400 tabular-nums">
                {new Date(emp.start_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                {formatCompanyTime(emp.start_date)}
              </span>
            </div>
          )}
          {/* Empresa + Rem */}
          <div className="flex items-center justify-between gap-1 text-[9px] text-slate-400 font-bold">
            <span>{emp.company}</span>
            {showValues && (emp.remuneration_fixed || emp.remuneration) > 0 ? (
              <span className="text-slate-600 font-black tabular-nums">
                {BRL.format(emp.remuneration_fixed || emp.remuneration)}
              </span>
            ) : (
              <span>••••••</span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8 mt-6 relative" onClick={handleResetHighlight}>
      {/* Barra de Ajuda / Feedback do Destaque */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 px-4 flex items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-slate-500" />
          <span>
            {activeEmployee ? (
              <>
                Interfaces conectadas a <strong className="uppercase text-slate-800">{activeEmployee.corporate_name || activeEmployee.name}</strong> destacadas. 
                {isLocked ? " (Destaque travado. Clique no card selecionado para ver os detalhes completos)." : ""}
              </>
            ) : (
              "Passe o mouse ou toque em qualquer cadeira para visualizar suas conexões e interfaces no ecossistema."
            )}
          </span>
        </div>
        {activeId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleResetHighlight();
            }}
            className="text-[10px] font-black uppercase text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-lg transition-all"
          >
            Limpar Destaque
          </button>
        )}
      </div>

      {/* ─── ÓRBITA ESTRATÉGICA ─── */}
      <div className="bg-slate-50/50 rounded-3xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-700 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Órbita Estratégica
          </h3>
          <span className="bg-amber-100/60 border border-amber-200 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
            {strategic.length} {strategic.length === 1 ? 'Integrante' : 'Integrantes'}
          </span>
        </div>

        {strategic.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">Nenhum integrante ativo nesta órbita.</p>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {strategic.map(renderEcosystemCard)}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ─── ÓRBITA TÁTICA ─── */}
      <div className="bg-slate-50/50 rounded-3xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Órbita Tática
          </h3>
          <span className="bg-emerald-100/60 border border-emerald-200 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
            {tactical.length} {tactical.length === 1 ? 'Integrante' : 'Integrantes'}
          </span>
        </div>

        {tactical.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">Nenhum integrante ativo nesta órbita.</p>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {tactical.map(renderEcosystemCard)}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ─── ÓRBITA OPERACIONAL ─── */}
      <div className="bg-slate-50/50 rounded-3xl border border-slate-200/80 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-sky-700 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            Órbita Operacional
          </h3>
          <span className="bg-sky-100/60 border border-sky-200 text-sky-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
            {operational.length} {operational.length === 1 ? 'Integrante' : 'Integrantes'}
          </span>
        </div>

        {operational.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">Nenhum integrante ativo nesta órbita.</p>
        ) : (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {operational.map(renderEcosystemCard)}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
