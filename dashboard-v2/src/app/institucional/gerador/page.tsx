"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  Search, 
  QrCode, 
  Share2, 
  Building2, 
  Info,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Download
} from 'lucide-react';
import styles from '../page.module.css';
import { APP_VERSION } from '@/version';
import { supabase } from '@/lib/supabase';

interface ActiveEmployee {
  id: string;
  name: string;
  corporateName?: string;
  responsibleName?: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  company: string;
}

export default function CardGeneratorPage() {
  const [employees, setEmployees] = useState<ActiveEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<ActiveEmployee | null>(null);

  // Carregar todos os colaboradores ativos do Supabase
  useEffect(() => {
    fetchActiveEmployees();
  }, []);

  const fetchActiveEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, corporate_name, responsible_name, job_role, department, phone, phone_professional, email, email_professional, company, status')
        .neq('status', 'Inativo')
        .order('full_name');

      if (error) throw error;

      if (data) {
        const mapped = data.map((e: any) => ({
          id: e.id,
          name: e.full_name,
          corporateName: e.corporate_name,
          responsibleName: e.responsible_name,
          role: e.job_role || 'Colaborador',
          department: e.department || 'Operações',
          phone: e.phone_professional || e.phone || '',
          email: e.email_professional || e.email || '',
          company: e.company || 'MarBR'
        }));
        setEmployees(mapped);
      }
    } catch (err: any) {
      console.error('[Gerador] Erro ao buscar colaboradores:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtragem dinâmica dos colaboradores ativos com base na busca
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(query) || 
      emp.role.toLowerCase().includes(query) ||
      emp.department.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  const handleSelectEmployee = (emp: ActiveEmployee) => {
    setSelectedEmp(emp);
    setSearchQuery(emp.name);
    setShowDropdown(false);
  };

  // Montagem do link que o visitante acessará (aponta para o ID na URL)
  const getReferralLink = () => {
    if (typeof window === 'undefined' || !selectedEmp) return '';
    const origin = window.location.origin;
    return `${origin}/institucional?ref=${selectedEmp.id}`;
  };

  const referralLink = getReferralLink();
  const qrCodeUrl = selectedEmp 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&color=000000&bgcolor=FFFFFF&data=${encodeURIComponent(referralLink)}`
    : '';

  const handleShare = () => {
    if (!selectedEmp) return;
    navigator.clipboard.writeText(referralLink);
    alert('Link do seu Crachá Virtual copiado com sucesso! Você pode enviá-lo ou salvá-lo em seus atalhos.');
  };

  return (
    <div className={styles.pageContainer}>
      
      {/* HEADER SUPERIOR */}
      <header className={styles.headerBar}>
        <div className="flex items-center gap-3">
          <img src="/mar-brasil-logo.png" alt="Logo Mar Brasil" className="h-10 w-auto object-contain" />
          <div>
            <span className="font-extrabold text-sm uppercase tracking-wider block text-white">Grupo Mar Brasil</span>
            <span className="text-[10px] text-slate-400 font-bold block">PAINEL DO COLABORADOR</span>
          </div>
        </div>
        
        <Link href="/institucional" className={styles.backBtn}>
          <ChevronLeft size={16} />
          <span>Voltar ao Portal</span>
        </Link>
      </header>

      {/* ÁREA CENTRAL */}
      <main className="w-full max-w-[650px] mx-auto px-5 py-6 flex flex-col gap-6">
        
        {/* Bloco explicativo */}
        <section className="bg-slate-800/20 border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <QrCode size={20} className="text-amber-500" />
            Gerador de Crachá Virtual
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Esta área é restrita para colaboradores ativos do Grupo Mar Brasil. Digite o seu nome abaixo para validar seu cadastro na base e gerar o seu cartão virtual com QR Code. 
          </p>
        </section>

        {/* Formulário de Busca e Seleção */}
        <section className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 flex flex-col gap-5 relative">
          <div className={styles.formGroup}>
            <label htmlFor="employee-search">Procure pelo seu nome no Banco de Dados</label>
            <div className="relative">
              <input
                id="employee-search"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (selectedEmp && e.target.value !== selectedEmp.name) {
                    setSelectedEmp(null); // Desmarca se editou o nome
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Comece a digitar seu nome completo..."
                className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-slate-500"
              />
              <div className="absolute left-3 top-3 text-slate-500">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </div>
            </div>

            {/* Dropdown de sugestões dinâmicas de colaboradores ativos */}
            {showDropdown && searchQuery.trim() && (
              <div className="absolute left-6 right-6 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                {filteredEmployees.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 flex items-center gap-2">
                    <AlertCircle size={14} className="text-amber-500" />
                    <span>Nenhum colaborador ativo localizado com esse nome.</span>
                  </div>
                ) : (
                  filteredEmployees.map(emp => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleSelectEmployee(emp)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-700/80 border-b border-slate-700/50 last:border-b-0 text-xs transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-white block">{emp.name}</span>
                        <span className="text-[10px] text-slate-400">{emp.role} — {emp.department}</span>
                      </div>
                      <span className="text-[9px] bg-slate-700 text-amber-400 font-bold px-2 py-0.5 rounded uppercase">
                        {emp.company}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Validação de Status */}
          {selectedEmp ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold py-3 px-4 rounded-xl flex items-center gap-2">
              <CheckCircle size={15} />
              <span>Colaborador Ativo validado com sucesso! Veja seu cartão abaixo.</span>
            </div>
          ) : searchQuery.trim() && !showDropdown && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold py-3 px-4 rounded-xl flex items-center gap-2">
              <AlertCircle size={15} />
              <span>Selecione seu nome listado nas sugestões acima para gerar o cartão.</span>
            </div>
          )}
        </section>

        {/* Visualização e Download do Cartão Gerado */}
        {selectedEmp && (
          <section className="flex flex-col gap-5 animate-fadeIn">
            
            {/* Visualização de Cartão Premium */}
            <div className={styles.businessCardPreview}>
              <div className={styles.cardHeader}>
                <div className={styles.cardLogo}>
                  <div className={styles.logoIcon}>MB</div>
                  <div className={styles.logoText}>
                    Mar Brasil
                    <span>COLABORADOR OFICIAL</span>
                  </div>
                </div>
                <div className="text-[9px] bg-amber-500 text-slate-950 font-extrabold px-2 py-0.5 rounded tracking-wide uppercase">
                  {selectedEmp.company}
                </div>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.userInfo}>
                  <h4 className={styles.userName}>{selectedEmp.corporateName || selectedEmp.name}</h4>
                  <span className={styles.userRole}>{selectedEmp.responsibleName || selectedEmp.role}</span>
                  <span className="text-[9px] text-slate-400 tracking-wider mt-1">{selectedEmp.department}</span>
                </div>

                <div className={styles.qrContainer} title="Aponte a câmera para ler">
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code do Colaborador" 
                    className={styles.qrImg} 
                  />
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                type="button" 
                onClick={handleShare}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-900 font-bold py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-98 text-xs uppercase tracking-wider cursor-pointer"
              >
                <Share2 size={14} />
                Copiar Link do Crachá
              </button>

              <a 
                href={qrCodeUrl}
                download={`QRCode_${selectedEmp.name.replace(/\s+/g, '_')}.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-98 text-xs uppercase tracking-wider border border-slate-700 cursor-pointer text-center"
              >
                <Download size={14} />
                Baixar Imagem QR Code
              </a>
            </div>

            <p className={styles.cardInstructions}>
              <Info size={14} />
              <span>
                <strong>Instruções de Uso:</strong> Salve o link em seu smartphone ou imprima a imagem do QR Code para colocar em seu crachá físico. Ao ser escaneado por parceiros, eles abrirão a página oficial do grupo contendo seus contatos e certidões das empresas.
              </span>
            </p>
          </section>
        )}

      </main>

      {/* HUD FOOTER COMPARTILHADO */}
      <footer className={styles.hudInfo}>
        Mar Brasil<br />
        Portal de Gestão Inteligente
      </footer>

      <div className={styles.hudVersion}>
        v{APP_VERSION.replace('v', '')}
      </div>

    </div>
  );
}
