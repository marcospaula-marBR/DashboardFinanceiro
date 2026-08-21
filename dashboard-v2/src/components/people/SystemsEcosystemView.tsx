"use client";

import React, { useState, useMemo } from 'react';
import { 
  Server, KeyRound, ShieldCheck, ShieldAlert, Building2, User, 
  Search, Filter, Plus, ExternalLink, Printer, CheckCircle2, 
  AlertCircle, ChevronRight, X, Sparkles, Layers, ArrowUpRight,
  HelpCircle, Eye, Settings2, Shield
} from 'lucide-react';
import { Employee, SystemItem, SystemCategory, EmployeeSystemAccess, inferEntityType, GRUPO_EMPRESAS } from '@/types/loans';
import { isExternalEntity, getCompanyLogoUrl } from './PeopleBadges';
import { SystemsCatalogService } from '@/services/systems-catalog.service';
import { OffboardingChecklistModal } from './OffboardingChecklistModal';
import { SystemsManagerModal } from './SystemsManagerModal';
import { SystemAppIcon } from './SystemAppIcon';

interface SystemsEcosystemViewProps {
  employees: Employee[];
  onEmployeeClick: (id: string, initialTab?: any) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  'Bancário': '🏦',
  'ERP': '🏢',
  'RH & Folha': '👥',
  'Fiscal & Contábil': '📊',
  'CRM & Vendas': '💼',
  'Comunicação & Operações': '📡',
  'Infra & TI': '⚙️',
  'Outros': '📦'
};

export function SystemsEcosystemView({
  employees,
  onEmployeeClick
}: SystemsEcosystemViewProps) {
  const [catalog, setCatalog] = useState<SystemItem[]>(() => SystemsCatalogService.getSystems());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [offboardingEmployee, setOffboardingEmployee] = useState<Employee | null>(null);

  // Sincronizar catálogo da nuvem no mount
  React.useEffect(() => {
    SystemsCatalogService.fetchSystemsAsync().then(sys => {
      if (sys && sys.length > 0) setCatalog(sys);
    });
  }, []);

  // Apenas membros ativos para a visualização
  const activeMembers = useMemo(() => employees.filter(e => e.status !== 'Inativo'), [employees]);

  // Mapa de acessos por Colaborador e por Sistema
  const { systemToEmployeesMap, employeeToSystemsMap, totalAssignedAccesses } = useMemo(() => {
    const sysMap: Record<string, { employee: Employee; access: EmployeeSystemAccess }[]> = {};
    const empMap: Record<string, EmployeeSystemAccess[]> = {};
    let totalCount = 0;

    activeMembers.forEach(emp => {
      const accesses: EmployeeSystemAccess[] = emp.system_accesses || emp.metadata?.system_accesses || [];
      empMap[emp.id] = accesses;

      accesses.forEach(acc => {
        if (!sysMap[acc.system_id]) {
          sysMap[acc.system_id] = [];
        }
        sysMap[acc.system_id].push({ employee: emp, access: acc });
        totalCount++;
      });
    });

    return {
      systemToEmployeesMap: sysMap,
      employeeToSystemsMap: empMap,
      totalAssignedAccesses: totalCount
    };
  }, [activeMembers]);

  // Colaborador selecionado
  const activeEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return activeMembers.find(e => e.id === selectedEmployeeId) || null;
  }, [selectedEmployeeId, activeMembers]);

  // Sistema selecionado
  const activeSystem = useMemo(() => {
    if (!selectedSystemId) return null;
    return catalog.find(s => s.id === selectedSystemId) || null;
  }, [selectedSystemId, catalog]);

  // Filtragem de Sistemas no Catálogo
  const filteredCatalog = useMemo(() => {
    return catalog.filter(sys => {
      const matchesCategory = selectedCategory === 'all' || sys.category === selectedCategory;
      const matchesSearch = sys.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sys.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sys.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [catalog, selectedCategory, searchTerm]);

  // Filtragem de Colaboradores de acordo com as seleções ativas
  const filteredEmployees = useMemo(() => {
    let list = [...activeMembers];

    // Se houver busca textual
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(emp => {
        const name = (emp.name || '').toLowerCase();
        const corp = (emp.corporate_name || '').toLowerCase();
        const role = (emp.job_role || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        const sysNames = (employeeToSystemsMap[emp.id] || []).map(a => a.system_name.toLowerCase()).join(' ');
        return name.includes(term) || corp.includes(term) || role.includes(term) || dept.includes(term) || sysNames.includes(term);
      });
    }

    // Filtro por Empresa do Grupo
    if (selectedCompany !== 'all') {
      list = list.filter(emp => {
        if (emp.company === selectedCompany) return true;
        const accesses = employeeToSystemsMap[emp.id] || [];
        return accesses.some(a => (a.companies || []).includes(selectedCompany) || a.company === selectedCompany);
      });
    }

    // Se um sistema específico foi clicado (Ex: Bradesco) -> Mostra APENAS quem tem acesso àquele sistema
    if (selectedSystemId) {
      const allowedEmployees = (systemToEmployeesMap[selectedSystemId] || []).map(item => item.employee.id);
      list = list.filter(emp => allowedEmployees.includes(emp.id));
    } else if (selectedCategory !== 'all') {
      // Se apenas uma categoria foi clicada (Ex: Bancário) -> Mostra quem tem qualquer acesso naquela categoria
      list = list.filter(emp => {
        const accesses = employeeToSystemsMap[emp.id] || [];
        return accesses.some(a => a.category === selectedCategory);
      });
    }

    return list;
  }, [activeMembers, searchTerm, selectedCompany, selectedSystemId, selectedCategory, systemToEmployeesMap, employeeToSystemsMap]);

  // Contagem de categorias de sistemas
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    catalog.forEach(sys => {
      counts[sys.category] = (counts[sys.category] || 0) + 1;
    });
    return counts;
  }, [catalog]);

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedCompany('all');
    setSelectedSystemId(null);
    setSelectedEmployeeId(null);
    setSearchTerm('');
  };

  return (
    <div className="space-y-6 mt-6">
      
      {/* ── Barra Superior com KPIs e Ações de Governança ── */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                <Layers size={18} />
              </span>
              <h2 className="text-base font-black uppercase tracking-tight text-white">
                Ecossistema de Sistemas &amp; Governança de Acessos
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Navegação bidirecional de credenciais em Bancos, ERPs e plataformas corporativas por empresa do Grupo. Mapeamento para controle de segurança e offboarding imediato.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsCatalogModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
            >
              <Settings2 size={16} />
              <span>Gerenciar Catálogo</span>
            </button>
          </div>
        </div>

        {/* Mini KPI Cards de Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Sistemas Mapeados</span>
            <span className="text-xl font-black text-white mt-0.5 block">{catalog.length}</span>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">Acessos Ativos</span>
            <span className="text-xl font-black text-indigo-300 mt-0.5 block">{totalAssignedAccesses}</span>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">Integrantes Conectados</span>
            <span className="text-xl font-black text-emerald-300 mt-0.5 block">
              {Object.keys(employeeToSystemsMap).filter(id => (employeeToSystemsMap[id] || []).length > 0).length}
            </span>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">Contratos / Fornecedores</span>
            <span className="text-xl font-black text-amber-300 mt-0.5 block">
              {catalog.filter(s => s.origin === 'contrato').length}
            </span>
          </div>
        </div>
      </div>

      {/* ── Filtros Interativos por Tipo, Empresa e Busca ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por integrante, sistema, banco ou ERP..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {(selectedCategory !== 'all' || selectedCompany !== 'all' || selectedSystemId !== null || selectedEmployeeId !== null || searchTerm) && (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <X size={14} />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        {/* 1. Pílulas de Empresa do Grupo */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 shrink-0">
            Empresa:
          </span>
          <button
            onClick={() => setSelectedCompany('all')}
            className={`px-3 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all whitespace-nowrap ${
              selectedCompany === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todas
          </button>
          {GRUPO_EMPRESAS.map(empresa => {
            const isSelected = selectedCompany === empresa;
            return (
              <button
                key={empresa}
                onClick={() => setSelectedCompany(empresa)}
                className={`px-3 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {empresa}
              </button>
            );
          })}
        </div>

        {/* 2. Pílulas de Categorias de Sistemas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-slate-100">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 shrink-0">
            Categoria:
          </span>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedSystemId(null);
            }}
            className={`px-3.5 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === 'all' && !selectedSystemId
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>🌐 Todos os Tipos</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${selectedCategory === 'all' && !selectedSystemId ? 'bg-indigo-700' : 'bg-slate-200/60'}`}>{catalog.length}</span>
          </button>

          {Object.keys(categoryCounts).map(cat => {
            const icon = CATEGORY_ICONS[cat] || '📦';
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat && !selectedSystemId;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedSystemId(null);
                }}
                className={`px-3 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{icon} {cat}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200/60'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Barra de Sistemas Disponíveis (App Launchpad / Grid com Logotipos) ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            Sistemas &amp; Plataformas (Clique no aplicativo para filtrar os integrantes)
          </h3>
          {activeSystem && (
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
              <span>Filtrando por:</span>
              <strong className="uppercase">{activeSystem.name}</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredCatalog.map(sys => {
            const isSelected = selectedSystemId === sys.id;
            const userCount = (systemToEmployeesMap[sys.id] || []).length;

            return (
              <div
                key={sys.id}
                onClick={() => {
                  if (isSelected) {
                    setSelectedSystemId(null);
                  } else {
                    setSelectedSystemId(sys.id);
                    setSelectedCategory(sys.category);
                  }
                }}
                className={`p-3.5 rounded-3xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-200 shadow-md scale-[1.02]'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    {/* Logotipo / App Icon */}
                    <SystemAppIcon systemName={sys.name} category={sys.category} size="md" />

                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      userCount > 0
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {userCount} {userCount === 1 ? 'acesso' : 'acessos'}
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight line-clamp-1">
                    {sys.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                    {sys.category}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-bold text-slate-500">
                  <span>{sys.origin === 'interno' ? 'Interno' : 'Contrato'}</span>
                  <span className="text-indigo-600 font-black">
                    {isSelected ? '✓ Ativo' : 'Ver Integrantes →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Painel de Destaque do Colaborador Selecionado ── */}
      {activeEmployee && (
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 text-white rounded-3xl p-5 border border-indigo-800/60 shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
                <User size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black uppercase tracking-tight text-white">
                    {isExternalEntity(inferEntityType(activeEmployee)) && activeEmployee.corporate_name
                      ? activeEmployee.corporate_name
                      : activeEmployee.name}
                  </h3>
                  <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border border-indigo-400/30">
                    {activeEmployee.company} • {activeEmployee.linkType}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {activeEmployee.job_role || 'Sem Cadeira'} • {activeEmployee.department || 'Sem Setor'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setOffboardingEmployee(activeEmployee)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all"
              >
                <ShieldAlert size={15} />
                <span>Checklist de Desligamento</span>
              </button>

              <button
                onClick={() => onEmployeeClick(activeEmployee.id, 'acessos')}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider border border-white/20 flex items-center gap-1.5 transition-all"
              >
                <Eye size={15} />
                <span>Ver Ficha Completa</span>
              </button>

              <button
                onClick={() => setSelectedEmployeeId(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                title="Fechar destaque"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Lista dos Sistemas que este colaborador tem acesso */}
          <div className="mt-4 pt-4 border-t border-indigo-800/60">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-indigo-300 mb-2.5 flex items-center gap-1.5">
              <KeyRound size={13} />
              <span>Sistemas e Credenciais Ativas ({(employeeToSystemsMap[activeEmployee.id] || []).length} Mapeados)</span>
            </h4>

            {(employeeToSystemsMap[activeEmployee.id] || []).length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum sistema vinculado a este integrante no momento.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {(employeeToSystemsMap[activeEmployee.id] || []).map(acc => {
                  const compList = acc.companies || (acc.company ? [acc.company] : []);
                  return (
                    <div
                      key={acc.system_id}
                      className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 flex items-start gap-3 shadow-xs"
                    >
                      <SystemAppIcon systemName={acc.system_name} category={acc.category} size="md" />

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-white uppercase truncate">{acc.system_name}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {acc.user_identifier || activeEmployee.email || 'Sem login'}
                        </p>
                        
                        {compList.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {compList.map(c => (
                              <span key={c} className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        acc.access_level === 'Estratégico'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : acc.access_level === 'Tático'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {acc.access_level}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Grade de Colaboradores / Entidades com Acessos Mapeados ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Integrantes &amp; Credenciais ({filteredEmployees.length} Encontrados)
          </h3>
          <span className="text-xs text-slate-400 font-semibold">
            Clique no card para inspecionar credenciais ou acionar checklist de desligamento
          </span>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-6">
            <AlertCircle size={36} className="mx-auto text-slate-400 mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Nenhum integrante encontrado</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Nenhum colaborador corresponde aos filtros de empresa, sistema ou busca selecionados.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider"
            >
              Resetar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredEmployees.map(emp => {
              const isExternal = isExternalEntity(inferEntityType(emp));
              const displayName = isExternal && emp.corporate_name ? emp.corporate_name : emp.name;
              const avatarSrc = emp.photo_url || emp.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=e2e8f0&color=475569&bold=true`;
              const accesses = employeeToSystemsMap[emp.id] || [];
              const isSelected = selectedEmployeeId === emp.id;

              return (
                <div
                  key={emp.id}
                  onClick={() => setSelectedEmployeeId(isSelected ? null : emp.id)}
                  className={`bg-white border rounded-3xl p-4 transition-all duration-200 cursor-pointer select-none flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-500 ring-4 ring-indigo-100 bg-indigo-50/10 shadow-md scale-[1.01]'
                      : 'border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  <div>
                    {/* Header do Card com Foto/Ícone */}
                    <div className="flex items-start gap-3">
                      {isExternal && !(emp.photo_url || emp.avatar) ? (
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                          <Building2 size={18} />
                        </div>
                      ) : (
                        <img
                          src={avatarSrc}
                          alt={displayName}
                          className="w-10 h-10 rounded-2xl object-cover border border-slate-100 shrink-0 shadow-xs"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-slate-900 truncate tracking-tight uppercase">
                          {displayName}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                          {isExternal
                            ? `RL: ${(emp.responsible_name || 'Indefinido').toUpperCase()}`
                            : (emp.job_role || 'Sem Cadeira')}
                        </p>
                        <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                          {emp.company} • {emp.linkType}
                        </p>
                      </div>
                    </div>

                    {/* Tags dos Sistemas Vinculados com Logotipos */}
                    <div className="mt-3.5 pt-2.5 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-2">
                        <span className="uppercase">Sistemas Conectados:</span>
                        <span className={`font-black ${accesses.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {accesses.length}
                        </span>
                      </div>

                      {accesses.length === 0 ? (
                        <span className="text-[10px] text-slate-400 italic">Sem sistemas vinculados</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {accesses.slice(0, 4).map(acc => {
                            const compList = acc.companies || (acc.company ? [acc.company] : []);
                            return (
                              <span
                                key={acc.system_id}
                                className={`text-[9px] font-bold px-2 py-1 rounded-xl border flex items-center gap-1.5 ${
                                  acc.access_level === 'Estratégico'
                                    ? 'bg-rose-50/80 text-rose-800 border-rose-200'
                                    : acc.access_level === 'Tático'
                                    ? 'bg-amber-50/80 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50/80 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                <SystemAppIcon systemName={acc.system_name} category={acc.category} size="sm" className="!w-4 !h-4 !rounded-md" />
                                <span className="truncate max-w-[85px]">{acc.system_name}</span>
                                {compList.length > 0 && (
                                  <span className="text-[8px] font-extrabold opacity-75">
                                    ({compList[0]})
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          {accesses.length > 4 && (
                            <span className="text-[9px] font-black px-2 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                              +{accesses.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rodapé com Ação Rápida de Offboarding */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOffboardingEmployee(emp);
                      }}
                      className="text-[10px] font-black uppercase text-rose-600 hover:text-rose-800 flex items-center gap-1 hover:underline"
                    >
                      <ShieldAlert size={12} />
                      <span>Offboarding</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEmployeeClick(emp.id, 'acessos');
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 px-2 py-1 rounded-md flex items-center gap-1 transition-colors"
                      title="Abrir Ficha de Acessos & Sistemas do integrante"
                    >
                      <span>Ficha</span>
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modais de Gestão e Checklist ── */}
      {isCatalogModalOpen && (
        <SystemsManagerModal
          isOpen={isCatalogModalOpen}
          onClose={() => {
            setIsCatalogModalOpen(false);
            setCatalog(SystemsCatalogService.getSystems());
          }}
          onCatalogChange={() => {
            setCatalog(SystemsCatalogService.getSystems());
          }}
        />
      )}

      {offboardingEmployee && (
        <OffboardingChecklistModal
          isOpen={!!offboardingEmployee}
          onClose={() => setOffboardingEmployee(null)}
          employee={offboardingEmployee}
          onOpenProfileDrawer={(empId, tab) => {
            setOffboardingEmployee(null);
            onEmployeeClick(empId, tab || 'acessos');
          }}
          onRevokeAccesses={(empId, revokedSysIds) => {
            // Callback opcional
          }}
        />
      )}

    </div>
  );
}

