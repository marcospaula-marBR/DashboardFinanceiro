"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstitutionalForm } from "../forms/institutional-form";
import { BrandingForm } from "../forms/branding-form";
import { AddressForm } from "../forms/address-form";
import { BankDataForm } from "../forms/bank-data-form";
import { DocumentManager } from "@/modules/documents/components/document-manager";
import { 
    Building2, 
    Palette, 
    MapPin, 
    Phone, 
    Banknote, 
    Users, 
    FileText 
} from "lucide-react";

export function CompanyTabsHub({ company, onUpdate }: { company: any, onUpdate: () => void }) {
  const isNew = company.id === "new";

  return (
    <Tabs defaultValue="institucional" className="space-y-4">
      <TabsList className="bg-slate-100 p-1 overflow-x-auto h-auto flex-wrap md:flex-nowrap rounded-xl border border-slate-200/60">
        <TabsTrigger value="institucional" className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-bold text-[11px] uppercase tracking-wider">
            <Building2 className="size-4" />
            <span className="hidden md:inline">Institucional</span>
        </TabsTrigger>
        <TabsTrigger value="branding" disabled={isNew} className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-bold text-[11px] uppercase tracking-wider">
            <Palette className="size-4" />
            <span className="hidden md:inline">Branding</span>
        </TabsTrigger>
        <TabsTrigger value="enderecos" disabled={isNew} className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-bold text-[11px] uppercase tracking-wider">
            <MapPin className="size-4" />
            <span className="hidden md:inline">Endereços</span>
        </TabsTrigger>
        <TabsTrigger value="contatos" disabled={isNew} className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-bold text-[11px] uppercase tracking-wider">
            <Phone className="size-4" />
            <span className="hidden md:inline">Contatos</span>
        </TabsTrigger>
        <TabsTrigger value="bancario" disabled={isNew} className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-bold text-[11px] uppercase tracking-wider">
            <Banknote className="size-4" />
            <span className="hidden md:inline">Bancário</span>
        </TabsTrigger>
        <TabsTrigger value="responsaveis" disabled={isNew} className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-bold text-[11px] uppercase tracking-wider">
            <Users className="size-4" />
            <span className="hidden md:inline">Sócios</span>
        </TabsTrigger>
        <TabsTrigger value="documentos" disabled={isNew} className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all font-bold text-[11px] uppercase tracking-wider">
            <FileText className="size-4" />
            <span className="hidden md:inline">Documentos</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="institucional">
        <InstitutionalForm company={company} onUpdate={onUpdate} />
      </TabsContent>
      
      {!isNew ? (
        <>
          <TabsContent value="branding">
            <BrandingForm company={company} onUpdate={onUpdate} />
          </TabsContent>

          <TabsContent value="enderecos">
            <AddressForm company={company} onUpdate={onUpdate} />
          </TabsContent>

          <TabsContent value="contatos">
            <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50 italic text-slate-400 font-medium">
                Módulo de Contatos em desenvolvimento...
            </div>
          </TabsContent>

          <TabsContent value="bancario">
            <BankDataForm company={company} onUpdate={onUpdate} />
          </TabsContent>

          <TabsContent value="responsaveis">
            <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50 italic text-slate-400 font-medium">
                Módulo de Sócios em desenvolvimento...
            </div>
          </TabsContent>

          <TabsContent value="documentos">
            <DocumentManager companyId={company.id} />
          </TabsContent>
        </>
      ) : (
        <div className="mt-8 p-8 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Salve os dados institucionais para liberar as outras abas
            </p>
        </div>
      )}
    </Tabs>
  );
}
