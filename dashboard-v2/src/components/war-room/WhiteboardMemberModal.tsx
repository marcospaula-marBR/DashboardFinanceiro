"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  X, 
  User, 
  Trash2, 
  Check, 
  AlertTriangle, 
  ArrowRight, 
  Palette, 
  Link2, 
  Users, 
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface EmployeeOption {
  id: string;
  full_name: string;
  job_role?: string;
  department?: string;
  email?: string;
  phone_professional?: string;
}

// Paleta Executiva Estrita da Mar Brasil (PURPLE BAN RIGOROSO: sem roxo/violeta)
export const APPROVED_MEMBER_COLORS = [
  { name: 'Ciano Vibrante', hex: '#06b6d4', class: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500' },
  { name: 'Verde Esmeralda', hex: '#10b981', class: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500' },
  { name: 'Âmbar Ouro', hex: '#f59e0b', class: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500' },
  { name: 'Azul Royal', hex: '#3b82f6', class: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500' },
  { name: 'Laranja Mar Brasil', hex: '#f97316', class: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500' },
  { name: 'Rosa Coral', hex: '#f43f5e', class: 'bg-rose-500', text: 'text-rose-400', border: 'border-rose-500' },
  { name: 'Menta Teal', hex: '#14b8a6', class: 'bg-teal-500', text: 'text-teal-400', border: 'border-teal-500' },
  { name: 'Azul Sky', hex: '#0ea5e9', class: 'bg-sky-500', text: 'text-sky-400', border: 'border-sky-500' },
  { name: 'Verde Lima', hex: '#84cc16', class: 'bg-lime-500', text: 'text-lime-400', border: 'border-lime-500' },
  { name: 'Vermelho Carmim', hex: '#ef4444', class: 'bg-red-500', text: 'text-red-400', border: 'border-red-500' },
];

interface WhiteboardMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName: string | null; // Se fornecido, modo edição; se null, novo membro
  allMembers: string[];
  totalTasksCount?: number;
  onSaveMember: (oldName: string | null, newName: string, selectedColorHex?: string, linkedEmployeeId?: string) => void;
  onDeleteMember?: (memberName: string, reassignedTo?: string | null) => void;
}

export function WhiteboardMemberModal({
  isOpen,
  onClose,
  memberName,
  allMembers,
  totalTasksCount = 0,
  onSaveMember,
  onDeleteMember,
}: WhiteboardMemberModalProps) {
  const isEditing = Boolean(memberName);

  const [nome, setNome] = useState('');
  const [selectedColorHex, setSelectedColorHex] = useState(APPROVED_MEMBER_COLORS[0].hex);
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string>('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Estados de confirmação de exclusão
  const [isDeletingStep, setIsDeletingStep] = useState(false);
  const [reassignTo, setReassignTo] = useState<string>('');

  // Carregar lista de colaboradores de employees do Supabase para o vínculo
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoadingEmployees(true);

    async function loadEmployees() {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, full_name, job_role, department, email, phone_professional')
          .eq('active', true)
          .order('full_name');

        if (isMounted && data && !error) {
          setEmployees(data);
        }
      } catch (err) {
        console.warn('[WhiteboardMemberModal] Erro ao carregar colaboradores:', err);
      } finally {
        if (isMounted) {
          setLoadingEmployees(false);
        }
      }
    }

    loadEmployees();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Inicializar dados do membro
  useEffect(() => {
    if (memberName) {
      setNome(memberName);
      setIsDeletingStep(false);
      setReassignTo('');
    } else {
      setNome('');
      setIsDeletingStep(false);
      setReassignTo('');
      setSelectedColorHex(APPROVED_MEMBER_COLORS[0].hex);
      setLinkedEmployeeId('');
    }
  }, [memberName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = nome.trim().toUpperCase();
    if (!cleanNome) return;

    onSaveMember(isEditing ? memberName : null, cleanNome, selectedColorHex, linkedEmployeeId || undefined);
    onClose();
  };

  const handleConfirmDelete = () => {
    if (!memberName || !onDeleteMember) return;
    onDeleteMember(memberName, reassignTo.trim() ? reassignTo.trim().toUpperCase() : null);
    onClose();
  };

  const otherMembers = allMembers.filter(m => m.toUpperCase() !== memberName?.toUpperCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#090e1a] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-[#060a13]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-white font-mono tracking-wide">
                {isEditing ? `Editar Membro: ${memberName}` : 'Novo Membro na Lousa'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isEditing 
                  ? 'Renomeie, ajuste a cor ou vincule ao cadastro do colaborador'
                  : 'Cadastre um novo responsável para atribuição de tarefas e notificações'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {!isDeletingStep ? (
            <form id="member-form" onSubmit={handleSubmit} className="space-y-4">
              {/* CAMPO: NOME DO MEMBRO */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Nome na Lousa (Exibição) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={nome}
                    onChange={(e) => setNome(e.target.value.toUpperCase())}
                    placeholder="EX: MANUS, CLARA, MARCO, ALDO..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm uppercase focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
                  />
                  <span className="absolute right-3 top-3 text-[10px] text-slate-500 font-mono font-bold">
                    MAIÚSCULAS
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Ao renomear, todas as tarefas ativas e obrigações com este nome serão atualizadas automaticamente.
                </p>
              </div>

              {/* SELETOR DE COR EXECUTIVA (PURPLE BAN) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Palette size={13} className="text-cyan-400" />
                    Cor do Crachá / Identidade Visual
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (Purple Ban Respeitado)
                  </span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {APPROVED_MEMBER_COLORS.map(c => {
                    const isSelected = selectedColorHex.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSelectedColorHex(c.hex)}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-mono font-bold transition-all text-left ${
                          isSelected
                            ? 'bg-slate-900 border-white ring-2 ring-white/70 text-white shadow-md'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <span 
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: c.hex }} 
                        />
                        <span className="truncate text-[11px]">{c.name}</span>
                        {isSelected && <Check size={12} className="ml-auto text-emerald-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VÍNCULO COM COLABORADOR REAL (TABELA EMPLOYEES DO SUPABASE) */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Link2 size={13} className="text-cyan-400" />
                    Vínculo com Colaborador (Supabase)
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    Central de Notificações
                  </span>
                </label>

                <select
                  value={linkedEmployeeId}
                  onChange={(e) => setLinkedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="">— Sem vínculo específico (Somente nome textual) —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} {emp.job_role ? `• ${emp.job_role}` : ''} {emp.email ? `(${emp.email})` : ''}
                    </option>
                  ))}
                </select>

                <p className="text-[10px] text-slate-400 leading-tight">
                  Vincula este responsável ao cadastro oficial da equipe, permitindo o envio de notificações Web Push personalizadas para seus computadores e celulares Motorola Android.
                </p>
              </div>

              {/* ÁREA DE PERIGO: EXCLUIR MEMBRO (APENAS EM EDIÇÃO) */}
              {isEditing && onDeleteMember && (
                <div className="pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setIsDeletingStep(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 hover:underline transition-all"
                  >
                    <Trash2 size={13} />
                    <span>Deseja excluir este membro da lousa?</span>
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* PASSO DE CONFIRMAÇÃO DE EXCLUSÃO COM REATRIBUIÇÃO */
            <div className="space-y-4 p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-600/30 border border-rose-500 text-rose-400 flex-shrink-0">
                  <AlertTriangle size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-rose-200 font-mono">
                    Excluir Membro "{memberName}"?
                  </h3>
                  <p className="text-xs text-rose-300/80 mt-1">
                    Este membro possui <strong>{totalTasksCount}</strong> tarefa{totalTasksCount !== 1 ? 's' : ''} associada{totalTasksCount !== 1 ? 's' : ''} na Lousa Operacional.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                  Reatribuir tarefas pendentes para:
                </label>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="">— Apenas remover o membro (Tarefas ficam sem executor) —</option>
                  {otherMembers.map(m => (
                    <option key={m} value={m}>
                      Transferir tudo para {m}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Selecione outro membro para herdar as tarefas abertas, ou deixe em branco para desatribuir.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeletingStep(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-950"
                >
                  <Trash2 size={13} />
                  <span>Confirmar Exclusão</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RODAPÉ COM AÇÕES */}
        {!isDeletingStep && (
          <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-800 bg-[#060a13]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="member-form"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md font-mono"
            >
              <Check size={14} />
              <span>{isEditing ? 'Salvar Membro' : 'Criar Membro'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
