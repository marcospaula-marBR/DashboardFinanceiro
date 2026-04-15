"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Building2, FileCheck, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase/client";
import { CompanyCard } from "@/modules/companies/components/company-card";
import { useOrg } from "@/hooks/use-org";
import { StatCard } from "@/components/ui/stat-card";
import { motion, AnimatePresence } from "framer-motion";
import { CompanyDetailsModal } from "@/modules/companies/components/company-details-modal";

export default function CompaniesPage() {
  const { currentOrg, isLoading: orgLoading } = useOrg();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Drawer state
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  async function fetchCompanies() {
    if (!currentOrg) return;

    // Buscando empresas e o branding associado (relacionamento 1:1)
    const { data, error } = await supabase
      .from("companies")
      .select(`
        *,
        branding:company_branding(*),
        address:company_addresses(*)
      `)
      .eq("organization_id", currentOrg.id)
      .order("legal_name");

    if (error) {
      console.error("CompaniesPage: Error fetching companies:", error);
    }

    if (data) {
      // Como o relacionamento é 1:1 no schema, o Supabase traz branding como um objeto ou array de 1 item
      // Vamos normalizar para facilitar o uso no frontend
      const normalizedData = data.map(company => ({
        ...company,
        branding: Array.isArray(company.branding) ? company.branding[0] : company.branding
      }));
      setCompanies(normalizedData);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchCompanies();
    }
  }, [currentOrg, orgLoading]);

  const handleCompanyClick = (company: any) => {
    setSelectedCompany(company);
    setIsDrawerOpen(true);
  };

  const filteredCompanies = companies.filter(c => 
    c.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.trade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tax_id?.includes(searchTerm)
  );

  if (orgLoading || loading) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1440px] mx-auto w-full">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-12">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6 flex flex-col gap-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">
              Hub de Empresas
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestão de perfis corporativos e documentos - {currentOrg?.name}
            </p>
          </div>
          <Button 
            className="font-bold rounded-xl shadow-md group border-none bg-primary hover:bg-primary/90"
            onClick={() => {
              setSelectedCompany({ id: "new", legal_name: "", tax_id: "", organization_id: currentOrg?.id });
              setIsDrawerOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4 transition-transform group-hover:rotate-90" />
            Nova Empresa
          </Button>
        </header>

        {/* Stats Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total de Empresas" 
            value={companies.length.toString()} 
            icon={<Building2 size={22} />}
            color="primary"
          />
          <StatCard 
            title="Empresas Ativas" 
            value={companies.filter(c => c.status === 'active').length.toString()} 
            icon={<FileCheck size={22} />}
            color="success"
          />
          <StatCard 
            title="Pendências" 
            value="0" 
            icon={<AlertCircle size={22} />}
            color="warning"
            description="Documentos expirando"
          />
          <StatCard 
            title="Sincronização" 
            value="100%" 
            icon={<Loader2 size={22} className="animate-spin-slow" />}
            color="info"
            description="Status Omie"
          />
        </section>

        {/* Filters and Search */}
        <div className="relative group max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Buscar empresa, CNPJ ou nome fantasia..."
            className="pl-10 bg-white/50 backdrop-blur-sm border-slate-200 rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Companies Grid */}
        {filteredCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center card-premium bg-white/30 backdrop-blur-sm">
            <div className="bg-amber-100/50 text-amber-600 p-4 rounded-full">
              <Search size={32} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Nenhuma empresa encontrada</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Não encontramos resultados para "{searchTerm}". Tente outro termo ou limpe os filtros.
              </p>
            </div>
            <Button variant="outline" onClick={() => setSearchTerm("")} className="rounded-xl">
              Limpar Busca
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredCompanies.map((company, index) => (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  layout
                >
                  <CompanyCard 
                    company={company} 
                    onClick={() => handleCompanyClick(company)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Cockpit Lateral */}
      <CompanyDetailsModal
        company={selectedCompany}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdate={fetchCompanies}
      />
    </main>
  );
}
