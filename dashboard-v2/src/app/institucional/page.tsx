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
  MapPin,
  FileSpreadsheet,
  Layers,
  ArrowRight
} from 'lucide-react';
import styles from './page.module.css';
import { APP_VERSION } from '@/version';

// Cadastro de Dados das Empresas
const EMPRESAS_DATA = {
  MarBR: {
    name: 'Mar Brasil',
    razaoSocial: 'Mar Brasil Serviços Terceirizados e Logística Ltda',
    cnpj: '24.891.127/0001-45',
    inscEstadual: '144.592.831.110',
    inscMunicipal: '4.892.110-3',
    endereco: 'Av. Conselheiro Nébias, 754 - Boqueirão, Santos - SP, CEP 11045-002',
    atividade: 'Prestação de Serviços Terceirizados, Limpeza Urbana e Apoio Logístico',
    email: 'contato@marbrasil.com.br',
    telefone: '(13) 3221-5000',
    documentos: [
      { titulo: 'Contrato Social Consolidado', tipo: 'PDF', tamanho: '2.4 MB', url: '/Manual_de_Cultura.pdf' },
      { titulo: 'Cartão CNPJ Ativo', tipo: 'PDF', tamanho: '180 KB', url: '/Manual_de_Cultura.pdf' },
      { titulo: 'Certidão Conjunta Federal (CND)', tipo: 'PDF', tamanho: '340 KB', url: '/Manual_de_Cultura.pdf' },
      { titulo: 'Alvará de Funcionamento MarBR', tipo: 'PDF', tamanho: '950 KB', url: '/Manual_de_Cultura.pdf' },
      { titulo: 'Manual de Cultura do Grupo', tipo: 'PDF', tamanho: '12.0 MB', url: '/Manual_de_Cultura.pdf' }
    ],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' // Exemplo placeholder limpo
  },
  DZM: {
    name: 'DZM',
    razaoSocial: 'DZM Empreendimentos e Construções Civis Ltda',
    cnpj: '38.412.923/0001-88',
    inscEstadual: 'Isento',
    inscMunicipal: '8.412.302-9',
    endereco: 'Av. Ana Costa, 291 - Gonzaga, Santos - SP, CEP 11060-001',
    atividade: 'Incorporação de Empreendimentos Imobiliários e Construção Civil',
    email: 'diretoria@dzm.com.br',
    telefone: '(13) 3289-4000',
    documentos: [
      { titulo: 'Contrato Social Consolidado', tipo: 'PDF', tamanho: '1.9 MB', url: '/Manual_de_Cultura.pdf' },
      { titulo: 'Cartão CNPJ Ativo', tipo: 'PDF', tamanho: '175 KB', url: '/Manual_de_Cultura.pdf' },
      { titulo: 'Certidão Negativa de Débitos Mobiliários', tipo: 'PDF', tamanho: '280 KB', url: '/Manual_de_Cultura.pdf' },
      { titulo: 'Alvará de Execução de Obras', tipo: 'PDF', tamanho: '1.1 MB', url: '/Manual_de_Cultura.pdf' },
      { titulo: 'Manual de Cultura do Grupo', tipo: 'PDF', tamanho: '12.0 MB', url: '/Manual_de_Cultura.pdf' }
    ],
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  }
};

export default function InstitutionalPage() {
  const [selectedCompany, setSelectedCompany] = useState<'MarBR' | 'DZM' | null>(null);
  
  // Dados do Cartão de Visitas Digital
  const [cardName, setCardName] = useState('Marcos Paula');
  const [cardRole, setCardRole] = useState('Sócio-Diretor');
  
  // Indicação por parâmetro da URL
  const [referrer, setReferrer] = useState<{ name: string; role: string } | null>(null);
  const [showReferrerBanner, setShowReferrerBanner] = useState(false);

  // Vídeo em execução
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  // Efeito para capturar parâmetros da indicação
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const name = params.get('name');
      const role = params.get('role');
      if (name && role) {
        setReferrer({ name, role });
        setShowReferrerBanner(true);
      }
    }
  }, []);

  // Geração do link de indicação para o QR Code
  const getReferralLink = () => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?name=${encodeURIComponent(cardName)}&role=${encodeURIComponent(cardRole)}`;
  };

  const referralLink = getReferralLink();
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=000000&bgcolor=FFFFFF&data=${encodeURIComponent(referralLink)}`;

  // Compartilhamento / Copiar link
  const handleShare = () => {
    navigator.clipboard.writeText(referralLink);
    alert('Link do seu Cartão de Visitas copiado com sucesso! Compartilhe onde desejar.');
  };

  const handleCompanyClick = (key: 'MarBR' | 'DZM') => {
    setSelectedCompany(key);
    setActiveVideo(null); // Reseta vídeo ao trocar de empresa
    
    // Scroll suave para a ficha da empresa
    setTimeout(() => {
      const element = document.getElementById('company-details-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className={styles.pageContainer}>
      
      {/* HEADER SUPERIOR */}
      <header className={styles.headerBar}>
        <div className="flex items-center gap-3">
          <img src="/mar-brasil-logo.png" alt="Logo Mar Brasil" className="h-10 w-auto object-contain" />
          <div className="hidden md:block">
            <span className="font-extrabold text-sm uppercase tracking-wider block text-white">Grupo Mar Brasil</span>
            <span className="text-[10px] text-slate-400 font-bold block">PÁGINA INSTITUCIONAL & CARTÃO DIGITAL</span>
          </div>
        </div>
        
        <Link href="/" className={styles.backBtn}>
          <ChevronLeft size={16} />
          <span>Voltar ao Início</span>
        </Link>
      </header>

      {/* BANNER DE BOAS-VINDAS POR INDICAÇÃO */}
      {showReferrerBanner && referrer && (
        <section className={styles.referralBanner}>
          <div className={styles.bannerContent}>
            <div className={styles.bannerText}>
              <UserCheck size={28} className="animate-pulse" />
              <p>
                Você foi indicado por <strong>{referrer.name}</strong> ({referrer.role}) do <strong>Grupo Mar Brasil</strong>. 
                Seja bem-vindo ao nosso portal institucional! Conheça nossas marcas e consulte nossos documentos públicos abaixo.
              </p>
            </div>
            <button className={styles.bannerClose} onClick={() => setShowReferrerBanner(false)}>
              <X size={16} />
            </button>
          </div>
        </section>
      )}

      {/* GRID DE CONTEÚDO PRINCIPAL */}
      <main className={styles.mainContent}>
        
        {/* COLUNA ESQUERDA: CENA ORBITAL (Desktop) / CARDS (Mobile) */}
        <section className={styles.orbitArea}>
          <div className={styles.orbitTitle}>
            <h2>Estrutura Corporativa</h2>
            <p>Selecione uma empresa na órbita para acessar a ficha cadastral e documentos públicos</p>
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
                className={`${styles.satellite} ${styles.satMarBR}`}
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
                className={`${styles.satellite} ${styles.satDZM}`}
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
            <p>Selecione uma das empresas do grupo para ver a ficha e documentos públicos</p>
          </div>
          <div className={styles.mobileCompaniesGrid}>
            <div 
              onClick={() => handleCompanyClick('MarBR')}
              className={`${styles.mobileCompanyCard} ${styles.cardMarBR} ${selectedCompany === 'MarBR' ? 'bg-amber-500/10' : ''}`}
            >
              <div className={`${styles.companyBadge} ${styles.badgeMarBR}`}>M</div>
              <h4>Mar Brasil</h4>
              <p>Logística & Serviços</p>
            </div>

            <div 
              onClick={() => handleCompanyClick('DZM')}
              className={`${styles.mobileCompanyCard} ${styles.cardDZM} ${selectedCompany === 'DZM' ? 'bg-indigo-500/10' : ''}`}
            >
              <div className={`${styles.companyBadge} ${styles.badgeDZM}`}>D</div>
              <h4>DZM</h4>
              <p>Construção & Terceirização</p>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: GERADOR DE CARTÃO DE VISITAS */}
        <section className={styles.cardPanel}>
          <h3 className={styles.panelTitle}>
            <QrCode size={20} />
            Cartão de Visita Digital
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed -mt-2">
            Insira seus dados abaixo para gerar um cartão com QR Code personalizado. O QR Code gerará um link de indicação para esta página, ideal para compartilhar com parceiros e clientes no smartphone.
          </p>

          {/* Cartão de Crédito Físico Simulado */}
          <div className={styles.businessCardPreview}>
            <div className={styles.cardHeader}>
              <div className={styles.cardLogo}>
                <div className={styles.logoIcon}>MB</div>
                <div className={styles.logoText}>
                  Mar Brasil
                  <span>GRUPO CORPORATIVO</span>
                </div>
              </div>
              <div className={styles.chip}></div>
            </div>

            <div className={styles.cardBody}>
              <div className={styles.userInfo}>
                <h4 className={styles.userName}>{cardName || 'Seu Nome'}</h4>
                <span className={styles.userRole}>{cardRole || 'Seu Cargo'}</span>
              </div>

              <div className={styles.qrContainer} title="Escaneie para acessar o portal institucional">
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code de Visitas" 
                  className={styles.qrImg} 
                />
              </div>
            </div>
          </div>

          {/* inputs */}
          <div className="space-y-4">
            <div className={styles.formGroup}>
              <label htmlFor="card-name-input">Seu Nome Completo</label>
              <input
                id="card-name-input"
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Ex: Marcos Paula"
                maxLength={25}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="card-role-input">Seu Cargo / Função</label>
              <input
                id="card-role-input"
                type="text"
                value={cardRole}
                onChange={(e) => setCardRole(e.target.value)}
                placeholder="Ex: Sócio-Diretor"
                maxLength={30}
              />
            </div>
          </div>

          <button 
            type="button" 
            onClick={handleShare}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-md active:scale-98 text-sm cursor-pointer"
          >
            <Share2 size={16} />
            Compartilhar Link do Cartão
          </button>

          <p className={styles.cardInstructions}>
            <Info size={14} />
            <span>
              <strong>Como usar:</strong> Destaque este cartão em seu celular. O cliente pode apontar a câmera do smartphone para o QR Code para abrir diretamente os documentos e ficha cadastral das empresas sob sua indicação.
            </span>
          </p>
        </section>

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
                  <h3>{EMPRESAS_DATA[selectedCompany].razaoSocial}</h3>
                  <p>CNPJ: {EMPRESAS_DATA[selectedCompany].cnpj}</p>
                </div>
              </div>

              <button className={styles.closeBtn} onClick={() => setSelectedCompany(null)} title="Fechar Detalhes">
                <X size={20} />
              </button>
            </div>

            {/* Split Cadastral e Downloads */}
            <div className={styles.companyGrid}>
              
              {/* FICHA CADASTRAL */}
              <div className={styles.fichaCadastral}>
                <h4 className={styles.sectionSubtitle}>
                  <Building2 size={16} />
                  Ficha Cadastral Simplificada
                </h4>

                <div className={styles.infoList}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Nome Fantasia</span>
                    <span className={styles.infoValue}>{EMPRESAS_DATA[selectedCompany].name}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>CNPJ</span>
                    <span className={styles.infoValue}>{EMPRESAS_DATA[selectedCompany].cnpj}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Inscrição Estadual</span>
                    <span className={styles.infoValue}>{EMPRESAS_DATA[selectedCompany].inscEstadual}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Inscrição Municipal</span>
                    <span className={styles.infoValue}>{EMPRESAS_DATA[selectedCompany].inscMunicipal}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Endereço Comercial</span>
                    <span className={styles.infoValue}>{EMPRESAS_DATA[selectedCompany].endereco}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Atividade Principal</span>
                    <span className={styles.infoValue}>{EMPRESAS_DATA[selectedCompany].atividade}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>E-mail Oficial</span>
                    <span className={styles.infoValue}>{EMPRESAS_DATA[selectedCompany].email}</span>
                  </div>

                  <div className={styles.infoItem}>
                    <span className={styles.infoKey}>Contato Telefônico</span>
                    <span className={styles.infoValue}>{EMPRESAS_DATA[selectedCompany].telefone}</span>
                  </div>
                </div>
              </div>

              {/* DOCUMENTOS PÚBLICOS E VÍDEO */}
              <div className={styles.documentsArea}>
                <h4 className={styles.sectionSubtitle}>
                  <FileText size={16} />
                  Documentos Públicos Disponíveis
                </h4>

                <div className={styles.docList}>
                  {EMPRESAS_DATA[selectedCompany].documentos.map((doc, idx) => (
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
                        src={EMPRESAS_DATA[selectedCompany].videoUrl}
                        title={`Vídeo Institucional ${EMPRESAS_DATA[selectedCompany].name}`}
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <div className={styles.videoPlaceholder} onClick={() => setActiveVideo(selectedCompany)}>
                        <Play size={44} fill="#F2911B" strokeWidth={1} className="transition-transform duration-300" />
                        <p>Assistir Vídeo {EMPRESAS_DATA[selectedCompany].name}</p>
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
