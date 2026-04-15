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
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="card-premium group cursor-pointer border-l-4" 
      style={{ borderLeftColor: primaryColor }}
      onClick={onClick}
    >
      <div className="p-6 flex flex-col h-full gap-5">
        {/* Header with Icon and Badge */}
        <div className="flex justify-between items-start">
          <div 
            className="p-3 rounded-2xl transition-all group-hover:shadow-lg group-hover:shadow-primary/20 flex items-center justify-center min-h-[48px] min-w-[48px]"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          >
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={company.legal_name} className="h-8 w-8 object-contain" />
            ) : (
              <Building2 size={24} />
            )}
          </div>
          <Badge 
            className={cn(
              "font-bold uppercase text-[10px] tracking-wider border-none px-2.5 py-1",
              isActive 
                ? "bg-emerald-100 text-emerald-700" 
                : "bg-red-100 text-red-700"
            )}
          >
            {isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-1.5">
          <h3 className="font-bold text-slate-800 group-hover:text-primary transition-colors truncate leading-tight uppercase tracking-tight">
            {company.trade_name || company.legal_name}
          </h3>
          <p className="text-[11px] font-medium text-slate-400 truncate uppercase">
            {company.legal_name}
          </p>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            <ShieldCheck size={14} className="text-primary/60" />
            CNPJ: {company.tax_id}
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <MapPin size={14} className="text-slate-300" />
            <span>{company.city || "S/ INF."}, {company.state || "--"}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-primary/5 hover:text-primary transition-all group/btn"
          >
            Gerir
            <Search size={14} className="ml-1.5 transition-transform group-hover/btn:scale-110" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
