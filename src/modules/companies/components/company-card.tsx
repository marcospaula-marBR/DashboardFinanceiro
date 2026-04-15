"use client";

import { Building2, MapPin, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CompanyCardProps {
  company: {
    id: string;
    legal_name: string;
    trade_name?: string;
    tax_id: string;
    status: string;
    city?: string;
    state?: string;
  };
  onClick?: () => void;
}

export function CompanyCard({ company, onClick }: CompanyCardProps) {
  const isActive = company.status === "active";
  const branding = company.branding || {};
  const primaryColor = branding.primary_color || "#F2911B";

  return (
    <motion.div 
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative bg-[#111111] border border-white/5 rounded-[24px] overflow-hidden group cursor-pointer transition-all hover:border-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/10" 
      onClick={onClick}
    >
      <div className="p-7 flex flex-col h-full gap-6">
        {/* Superior: Logo e Status */}
        <div className="flex justify-between items-start">
          <div 
            className="p-3.5 rounded-2xl bg-white/5 flex items-center justify-center min-h-[52px] min-w-[52px] transition-all group-hover:bg-ember group-hover:text-white"
            style={{ color: primaryColor }}
          >
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={company.legal_name} className="h-8 w-8 object-contain" />
            ) : (
              <Building2 size={26} />
            )}
          </div>
          <Badge 
            className={cn(
              "font-black uppercase text-[9px] tracking-[0.1em] border-none px-3 py-1 bg-white/5",
              isActive 
                ? "text-emerald-400" 
                : "text-red-400"
            )}
          >
            <div className={cn("size-1.5 rounded-full mr-1.5", isActive ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
            {isActive ? "Operante" : "Inativo"}
          </Badge>
        </div>

        {/* Conteúdo: Tipografia Owner */}
        <div className="flex-1 space-y-1">
          <h3 className="font-heading font-bold text-white group-hover:text-ember transition-colors text-xl leading-tight uppercase tracking-[0.02em]">
            {company.trade_name || company.legal_name}
          </h3>
          <p className="text-[10px] font-medium text-slate-500 truncate uppercase tracking-widest">
            {company.legal_name}
          </p>
          
          <div className="pt-4 mt-2">
            <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tighter">
                <span className="text-ember opacity-70">CNPJ</span>
                <span className="text-white/80">{company.tax_id}</span>
            </div>
          </div>
        </div>

        {/* Rodapé: Localização e Ação */}
        <div className="pt-5 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            <MapPin size={14} className="text-slate-600" />
            <span>{company.city || "S/ INF."}, {company.state || "--"}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 px-4 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl bg-white/5 text-white hover:bg-ember hover:text-white transition-all border-none"
          >
            Acessar
            <Search size={14} className="ml-2" />
          </Button>
        </div>
      </div>

      {/* Marca de Cor da Empresa (Lado) */}
      <div 
        className="absolute bottom-0 left-0 w-full h-[3px] opacity-30 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: primaryColor }}
      />
    </motion.div>
  );
}
