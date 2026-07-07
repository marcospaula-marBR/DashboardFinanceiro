"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  Building2, 
  Play, 
  Download, 
  UserCheck, 
  X, 
  FileText, 
  Video, 
  QrCode, 
  Share2,
  Info,
  ExternalLink,
  Phone,
  Mail,
  Building,
  CheckCircle,
  FileCheck2,
  ArrowRight
} from 'lucide-react';
import styles from './page.module.css';
import { APP_VERSION } from '@/version';
import { supabase } from '@/lib/supabase';

interface CompanyData {
  id: string;
  slug: string;
  name: string;
  razao_social: string;
  cnpj: string;
  insc_estadual: string;
  insc_municipal: string;
  endereco: string;
  atividade: string;
  email: string;
  telefone: string;
  video_url: string;
  contatos_setorizados: any[];
  links_cnds: any[];
  documentos_oficiais: any[];
}

interface ReferrerData {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  company: string;
}

export default function InstitutionalPage() {
  const [selectedCompany, setSelectedCompany] = useState<'MarBR' | 'DZM' | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [companiesData, setCompaniesData] = useState<Record<string, CompanyData>>({});
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .not('slug', 'is', null);
          
        if (error) throw error;
        
        if (data) {
          const map: Record<string, CompanyData> = {};
          data.forEach(c => {
            map[c.slug] = c;
          });
          setCompaniesData(map);
        }
      } catch (err: any) {
        console.error('[Institucional] Erro ao carregar empresas:', err.message);
      } finally {
        setLoadingCompanies(false);
      }
    };
    
    fetchCompanies();
  }, []);

  // Estados do Referenciador (Modo Visitante)
  const [referrerId, setReferrerId] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<ReferrerData | null>(null);
  const [loadingReferrer, setLoadingReferrer] = useState(false);
  const [showReferrerBanner, setShowReferrerBanner] = useState(false);

  // Efeito para extrair o uuid de ref da URL e carregar dados do colaborador
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        setReferrerId(ref);
        fetchReferrer(ref);
      }
    }
  }, []);

  const fetchReferrer = async (id: string) => {
    setLoadingReferrer(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, job_role, department, phone, phone_professional, email, email_professional, company, status')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        if (data.status === 'Inativo') {
          console.warn('[Institucional] Colaborador referenciado está Inativo.');
          return;
        }

        const phoneNum = data.phone_professional || data.phone || '';
        const emailAddress = data.email_professional || data.email || '';

        setReferrer({
          id: data.id,
          name: data.full_name,
          role: data.job_role || 'Colaborador',
          department: data.department || 'Operações',
          phone: phoneNum,
          email: emailAddress,
          company: data.company || 'MarBR'
        });
        setShowReferrerBanner(true);
      }
    } catch (err: any) {
      console.error('[Institucional] Erro ao carregar indicador:', err.message);
    } finally {
      setLoadingReferrer(false);
    }
  };

  const handleCompanyClick = (key: 'MarBR' | 'DZM') => {
    setSelectedCompany(key);
    setActiveVideo(null); // Reseta vídeo ao trocar de empresa
    
    // Scroll suave para o painel de detalhes
    setTimeout(() => {
      const element = document.getElementById('company-details-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Limpa o número de telefone de formatação para WhatsApp
  const cleanPhoneForWa = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  return (
    <div className={styles.pageContainer}>
      
      {/* HEADER SUPERIOR */}
      <header className={styles.headerBar}>
        <div className="flex items-center gap-3">
          <img src="/mar-brasil-logo.png" alt="Logo Mar Brasil" className="h-10 w-auto object-contain" />
          <div className="hidden md:block">
            <span className="font-extrabold text-sm uppercase tracking-wider block text-white">Grupo Mar Brasil</span>
            <span className="text-[10px] text-slate-400 font-bold block">PORTAL INSTITUCIONAL & DOCUMENTOS</span>
          </div>
        </div>
        
        <Link href="/" className={styles.backBtn}>
          <ChevronLeft size={16} />
          <span>Voltar ao Início</span>
        </Link>
      </header>

      {/* BANNER DE INDICAÇÃO DO COLABORADOR (MODO VISITANTE) */}
      {showReferrerBanner && referrer && (
        <section className={styles.referralBanner}>
          <div className={styles.bannerContent}>
            <div className={styles.bannerText}>
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 font-extrabold flex-shrink-0">
                {referrer.name.substring(0, 2).toUpperCase()}
              </div>
              <p className="text-sm">
                Você está visualizando o portal do <strong>Grupo Mar Brasil</strong> por indicação de:{' '}
                <strong>{referrer.name}</strong> — <span className="text-amber-400 font-semibold">{referrer.role} ({referrer.department})</span>.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {referrer.phone && (
                <a 
                  href={`https://wa.me/55${cleanPhoneForWa(referrer.phone)}?text=Olá ${referrer.name}, estou visitando o portal institucional do Grupo Mar Brasil indicado por você.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-lg transition-colors"
                >
                  <Phone size={12} />
                  <span>WhatsApp</span>
                </a>
              )}
              {referrer.email && (
                <a 
                  href={`mailto:${referrer.email}?subject=Contato - Portal Grupo Mar Brasil`}
                  className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs py-2 px-4 rounded-lg transition-colors border border-slate-600"
                >
                  <Mail size={12} />
                  <span>E-mail</span>
                </a>
              )}
              <button className={styles.bannerClose} onClick={() => setShowReferrerBanner(false)}>
                <X size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* GRID DE CONTEÚDO PRINCIPAL (Diferente da v1, sem o formulário de criação de cartões se for visitante) */}
      <main className={`${styles.mainContent} ${referrerId ? 'grid-cols-1 max-w-[900px]' : ''}`}>
        
        {/* COLUNA ESQUERDA: CENA ORBITAL (Desktop) / CARDS (Mobile) */}
        <section className={styles.orbitArea}>
          <div className={styles.orbitTitle}>
            <h2>Estrutura Corporativa</h2>
            <p>Selecione uma empresa na órbita para ver cadastros, contatos e CNDs do OneDrive</p>
          </div>

          <div className={styles.scene}>
            <div className={`${styles.orbitalRing} ${styles.ring1}`}></div>

            {/* Núcleo do Grupo Mar Brasil */}
            <div className={styles.core} onClick={() => setSelectedCompany(null)}>
              <div className={styles.coreGlow}></div>
              <img
                src="/mar-brasil-logo.png"
                alt="Logo Mar Brasil"
                className={styles.coreImg}
              />
            </div>

            {/* Satélite Mar Brasil */}
            <div 
              className={styles.satelliteWrapper} 
              style={{ '--start-angle': '0deg', animationDuration: '30s' } as React.CSSProperties}
            >
              <button 
                onClick={() => handleCompanyClick('MarBR')} 
                className={`${styles.satellite} ${styles.satMarBR} ${selectedCompany === 'MarBR' ? styles.satActive : ''}`}
              >
                <Building2 size={28} strokeWidth={1.5} />
                <span>Mar Brasil</span>
                <p>Logística & Serviços</p>
              </button>
            </div>

            {/* Satélite DZM */}
            <div 
              className={styles.satelliteWrapper} 
              style={{ '--start-angle': '180deg', animationDuration: '30s' } as React.CSSProperties}
            >
              <button 
                onClick={() => handleCompanyClick('DZM')} 
                className={`${styles.satellite} ${styles.satDZM} ${selectedCompany === 'DZM' ? styles.satActive : ''}`}
              >
                <Building2 size={28} strokeWidth={1.5} />
                <span>DZM</span>
                <p>Empreendimentos</p>
              </button>
            </div>
          </div>
        </section>

        {/* MOBILE ALTERNATIVE COMPONENT FOR ORBITS */}
        <section className={styles.mobileCompaniesArea}>
          <div className={styles.orbitTitle}>
            <h2>Nossas Empresas</h2>
            <p>Selecione uma das empresas do grupo para ver fichas, contatos e certidões</p>
          </div>
          <div className={styles.mobileCompaniesGrid}>
            <div 
              onClick={() => handleCompanyClick('MarBR')}
              className={`${styles.mobileCompanyCard} ${styles.cardMarBR} ${selectedCompany === 'MarBR' ? 'bg-amber-500/10 border-amber-500' : ''}`}
            >
              <div className={`${styles.companyBadge} ${styles.badgeMarBR}`}>M</div>
              <h4>Mar Brasil</h4>
              <p>Logística & Serviços</p>
            </div>

            <div 
              onClick={() => handleCompanyClick('DZM')}
              className={`${styles.mobileCompanyCard} ${styles.cardDZM} ${selectedCompany === 'DZM' ? 'bg-indigo-500/10 border-indigo-500' : ''}`}
            >
              <div className={`${styles.companyBadge} ${styles.badgeDZM}`}>D</div>
              <h4>DZM</h4>
              <p>Construção & Terceirização</p>
            </div>
          </div>
        </section>

        {/* VISUALIZAÇÃO DO SEU INDICAÇÃO DO CARTÃO - SE NÃO FOR VISITANTE (GERAL) */}
        {!referrerId && (
          <section className={styles.cardPanel}>
            <h3 className={styles.panelTitle}>
              <QrCode size={20} />
              Crachá Virtual Corporativo
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed -mt-2">
              Se você é colaborador do Grupo Mar Brasil, utilize a nossa ferramenta corporativa para gerar seu cartão e QR Code com contatos oficiais.
            </p>

            <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-4">
              <Building size={34} className="text-amber-500" />
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Área Restrita a Colaboradores</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto">
                  A geração de QR codes e crachás corporativos exige validação ativa com sua matrícula na base global.
                </p>
              </div>
              <Link 
                href="/institucional/gerador" 
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-900 font-bold py-2.5 px-6 rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                <span>Acessar Gerador de Cartão</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </section>
        )}

      </main>

      {/* DETALHES DA EMPRESA SELECIONADA */}
      {selectedCompany && (
        <section id="company-details-section" className={styles.companyContainer}>
          <div className={styles.companyPanel}>
            
            {/* Header Interno do Painel */}
            <div className={styles.companyHeader}>
              <div className={styles.companyTitle}>
                <div className={`${styles.companyBadge} ${selectedCompany === 'MarBR' ? styles.badgeMarBR : styles.badgeDZM}`}>
                  {selectedCompany === 'MarBR' ? 'M' : 'D'}
                </div>
                <div className={styles.companyTitleInfo}>
                  <h3>{companiesData[selectedCompany]?.razao_social}</h3>
                  <p>CNPJ: {companiesData[selectedCompany]?.cnpj}</p>
                </div>
              </div>

              <button className={styles.closeBtn} onClick={() => setSelectedCompany(null)} title="Fechar Detalhes">
                <X size={20} />
              </button>
            </div>

            {/* Split Cadastral, Downloads, Contatos Setorizados e CNDs do OneDrive */}
            <div className={styles.companyGrid}>
              
              {/* COLUNA ESQUERDA: FICHA CADASTRAL & CANAIS DE ATENDIMENTO */}
              <div className={styles.fichaCadastral}>
                
                {/* FICHA */}
                <h4 className={styles.sectionSubtitle}>
                  <Building2 size={16} />
                  Ficha Cadastral Simplificada
                </h4>

                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Nome Fantasia</span>
                    <span className={styles.infoValue}>{companiesData[selectedCompany]?.name}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>CNPJ</span>
                    <span className={styles.infoValue}>{companiesData[selectedCompany]?.cnpj}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Inscrição Estadual</span>
                    <span className={styles.infoValue}>{companiesData[selectedCompany]?.insc_estadual}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Inscrição Municipal</span>
                    <span className={styles.infoValue}>{companiesData[selectedCompany]?.insc_municipal}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Endereço Comercial</span>
                    <span className={styles.infoValue}>{companiesData[selectedCompany]?.endereco}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Atividade Principal</span>
                    <span className={styles.infoValue}>{companiesData[selectedCompany]?.atividade}</span>
                  </div>
                </div>

                {/* CANAIS DE ATENDIMENTO SETORIZADOS */}
                <div className="mt-4">
                  <h4 className={styles.sectionSubtitle}>
                    <Phone size={15} />
                    Canais de Atendimento Direto
                  </h4>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Fale diretamente com os responsáveis pelos setores da empresa:
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {(companiesData[selectedCompany]?.contatos_setorizados || []).map((cont: any, idx: number) => (
                      <div key={idx} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h5 className="text-xs font-bold text-white">{cont.setor}</h5>
                          <span className="text-[10px] text-slate-400">{cont.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a 
                            href={`https://wa.me/55${cont.fone}?text=Olá, estou no portal do Grupo Mar Brasil e gostaria de atendimento no setor ${cont.setor}.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5"
                          >
                            <Phone size={10} />
                            <span>WhatsApp</span>
                          </a>
                          <a 
                            href={`mailto:${cont.email}`}
                            className="bg-slate-700/30 hover:bg-slate-600 border border-slate-600/40 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5"
                          >
                            <Mail size={10} />
                            <span>E-mail</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA: DOCUMENTOS, CERTIDÕES (ONEDRIVE) E VÍDEO */}
              <div className={styles.documentsArea}>
                
                {/* DOCUMENTOS */}
                <h4 className={styles.sectionSubtitle}>
                  <FileText size={16} />
                  Contrato Social e Atos Oficiais
                </h4>

                <div className={styles.docList}>
                  {(companiesData[selectedCompany]?.documentos_oficiais || []).map((doc: any, idx: number) => (
                    <a 
                      key={idx} 
                      href={doc.url} 
                      download
                      className={styles.docItem}
                      title={`Clique para baixar: ${doc.titulo}`}
                    >
                      <div className={styles.docInfo}>
                        <div className={styles.docIcon}>
                          <FileText size={16} />
                        </div>
                        <div className={styles.docMeta}>
                          <h4>{doc.titulo}</h4>
                          <span>Formato {doc.tipo} | Tamanho: {doc.tamanho}</span>
                        </div>
                      </div>
                      <div className={styles.downloadBtn}>
                        <Download size={14} />
                      </div>
                    </a>
                  ))}
                </div>

                {/* CERTIDÕES NEGATIVAS DE DÉBITOS (ONEDRIVE) */}
                <div className="mt-4">
                  <h4 className={styles.sectionSubtitle}>
                    <FileCheck2 size={16} />
                    Certidões Negativas de Débitos (CNDs)
                  </h4>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Certidões mantidas e atualizadas mensalmente pelo departamento de Licitações no OneDrive:
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {(companiesData[selectedCompany]?.links_cnds || []).map((cnd: any, idx: number) => (
                      <a 
                        key={idx}
                        href={cnd.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${styles.docItem} hover:border-amber-500/40`}
                        title="Abrir pasta de certidões no OneDrive"
                      >
                        <div className={styles.docInfo}>
                          <div className="w-9 h-9 bg-slate-800 border border-slate-700 text-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileCheck2 size={14} />
                          </div>
                          <div className={styles.docMeta}>
                            <h4 className="text-[11px]">{cnd.titulo}</h4>
                            <span className="text-[9px] uppercase font-bold text-amber-500/80">OneDrive Compartilhado</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <span>Acessar</span>
                          <ExternalLink size={10} />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Bloco de Vídeo Específico da Empresa */}
                <div className="mt-4">
                  <h4 className={styles.sectionSubtitle}>
                    <Video size={16} />
                    Apresentação Institucional
                  </h4>
                  
                  <div className={`${styles.videoPlayerContainer} mt-3`}>
                    {activeVideo === selectedCompany ? (
                      <iframe 
                        width="100%" 
                        height="100%" 
                        src={companiesData[selectedCompany]?.video_url}
                        title={`Vídeo Institucional ${companiesData[selectedCompany]?.name}`}
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <div className={styles.videoPlaceholder} onClick={() => setActiveVideo(selectedCompany)}>
                        <Play size={44} fill="#F2911B" strokeWidth={1} />
                        <p>Assistir Vídeo {companiesData[selectedCompany]?.name}</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        </section>
      )}

      {/* VÍDEO DO GRUPO (SEÇÃO GERAL) */}
      <section className={styles.videoSection}>
        <div className={styles.videoWrapper}>
          <h3 className={styles.videoTitle}>
            <Video size={20} />
            Vídeo Institucional do Grupo
          </h3>
          <p className="text-xs text-slate-400 -mt-2 leading-relaxed">
            Conheça a história e a atuação nacional do Grupo Mar Brasil na prestação de serviços integrados e logística estratégica.
          </p>

          <div className={styles.videoPlayerContainer}>
            {activeVideo === 'Grupo' ? (
              <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                title="Vídeo Institucional Grupo Mar Brasil"
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowFullScreen
              ></iframe>
            ) : (
              <div className={styles.videoPlaceholder} onClick={() => setActiveVideo('Grupo')}>
                <Play size={52} fill="#F2911B" strokeWidth={1} />
                <p>Assistir Vídeo Corporativo do Grupo</p>
              </div>
            )}
          </div>
        </div>
      </section>

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
