"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { maskCNPJ } from "@/lib/masks";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

const infoSchema = z.object({
  legal_name: z.string().min(1, "Razão Social é obrigatória"),
  trade_name: z.string().optional(),
  tax_id: z.string().min(14, "CNPJ inválido"),
  state_registration: z.string().optional(),
  municipal_registration: z.string().optional(),
  tax_regime: z.string().optional(),
  cnae: z.string().optional(),
});

type InfoValues = z.infer<typeof infoSchema>;

export function InstitutionalForm({ company, onUpdate }: { company: any, onUpdate?: () => void }) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      legal_name: company.legal_name || "",
      trade_name: company.trade_name || "",
      tax_id: company.tax_id || "",
      state_registration: company.state_registration || "",
      municipal_registration: company.municipal_registration || "",
      tax_regime: company.tax_regime || "",
      cnae: company.cnae || "",
    },
  });

  // Watch CNPJ to apply mask on the fly if needed
  const taxIdValue = watch("tax_id");
  useEffect(() => {
    if (taxIdValue) {
      setValue("tax_id", maskCNPJ(taxIdValue));
    }
  }, [taxIdValue, setValue]);

  const onSubmit = async (values: InfoValues) => {
    setLoading(true);
    
    try {
      if (company.id === "new") {
        // Lógica de Criação
        const { error } = await supabase
          .from("companies")
          .insert({
            ...values,
            organization_id: company.organization_id, // Importante para o RLS
            status: "active"
          });
        
        if (error) throw error;
      } else {
        // Lógica de Atualização
        const { error } = await supabase
          .from("companies")
          .update(values)
          .eq("id", company.id);
        
        if (error) throw error;
      }

      if (onUpdate) onUpdate();
    } catch (error: any) {
      console.error("Error saving company:", error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg font-black uppercase tracking-tight">Dados Institucionais</CardTitle>
        <CardDescription>
          Informações principais e registros da pessoa jurídica.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Razão Social</Label>
              <Input {...register("legal_name")} className="rounded-xl border-slate-200 focus:border-primary/50 font-medium" />
              {errors.legal_name && <p className="text-xs text-destructive">{errors.legal_name.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome Fantasia</Label>
              <Input {...register("trade_name")} className="rounded-xl border-slate-200 focus:border-primary/50" />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">CNPJ</Label>
              <Input {...register("tax_id")} placeholder="00.000.000/0000-00" className="rounded-xl border-slate-200 focus:border-primary/50 font-mono" />
              {errors.tax_id && <p className="text-xs text-destructive">{errors.tax_id.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Regime Tributário</Label>
              <Select 
                value={watch("tax_regime")} 
                onValueChange={(val) => setValue("tax_regime", val)}
              >
                <SelectTrigger className="rounded-xl border-slate-200 focus:border-primary/50 font-bold">
                  <SelectValue placeholder="Selecione o regime" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Simples">Simples Nacional</SelectItem>
                  <SelectItem value="MEI">MEI (Microempreendedor)</SelectItem>
                  <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">CNAE Principal</Label>
              <Input {...register("cnae")} className="rounded-xl border-slate-200 focus:border-primary/50" />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inscrição Estadual</Label>
              <Input {...register("state_registration")} className="rounded-xl border-slate-200 focus:border-primary/50" />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inscrição Municipal</Label>
              <Input {...register("municipal_registration")} className="rounded-xl border-slate-200 focus:border-primary/50" />
            </div>
          </div>
          
          <div className="flex justify-end pt-6 border-t border-slate-100">
            <Button 
                type="submit" 
                disabled={loading}
                className="rounded-xl px-10 font-bold shadow-lg shadow-primary/20 h-11"
            >
              {loading ? "Processando..." : (company.id === "new" ? "Cadastrar Empresa" : "Salvar Alterações")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
