"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { maskPhone } from "@/lib/masks";
import { SmartContactPicker } from "../components/smart-contact-picker";
import { Badge } from "@/components/ui/badge";
import { UserCheck } from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").or(z.literal("")),
  phone: z.string().optional(),
  department: z.string().min(1, "Selecione um departamento"),
  job_role: z.string().optional(),
  is_primary: z.boolean().default(false),
  receives_notifications: z.boolean().default(false),
});

type ContactValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
  companyId: string;
  contact?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContactForm({ companyId, contact, onSuccess, onCancel }: ContactFormProps) {
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(contact?.employee_id || null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: contact?.name || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
      department: contact?.department || "Financeiro",
      job_role: contact?.job_role || "",
      is_primary: contact?.is_primary || false,
      receives_notifications: contact?.receives_notifications || false,
    },
  });

  const phoneValue = watch("phone");
  useEffect(() => {
    if (phoneValue) {
        setValue("phone", maskPhone(phoneValue));
    }
  }, [phoneValue, setValue]);

  const handleEmployeeSelect = (emp: any | null) => {
    if (emp) {
      setSelectedEmployeeId(emp.id);
      setValue("name", emp.full_name);
      if (emp.email) setValue("email", emp.email);
      if (emp.phone) setValue("phone", emp.phone);
      if (emp.job_role) setValue("job_role", emp.job_role);
    } else {
      setSelectedEmployeeId(null);
    }
  };

  const onSubmit = async (values: ContactValues) => {
    setLoading(true);
    
    try {
        const contactData = { 
            ...values, 
            company_id: companyId,
            employee_id: selectedEmployeeId 
        };

        if (!contact?.id) {
            const { error } = await supabase.from("company_contacts").insert(contactData);
            if (error) throw error;
        } else {
            const { error } = await supabase.from("company_contacts").update(contactData).eq("id", contact.id);
            if (error) throw error;
        }

        // Lógica de Enriquecimento Reverso (v1.5)
        // Se houver um colaborador vinculado, atualizamos o cadastro master dele na PeopleBoard
        if (selectedEmployeeId) {
            await supabase.from("employees").update({
                email: values.email,
                phone: values.phone,
                job_role: values.job_role,
            }).eq("id", selectedEmployeeId);
        }

        onSuccess();
    } catch (error: any) {
        console.error("ContactForm: Error saving contact:", error);
        alert("Erro ao salvar: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6">
        
        {/* Nome com Smart Search */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Contato</Label>
            {selectedEmployeeId && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold text-[9px] uppercase px-2 py-0">
                    <UserCheck className="size-3 mr-1" /> Funcionário Vinculado
                </Badge>
            )}
          </div>
          <SmartContactPicker 
            defaultValue={watch("name")}
            onSelect={handleEmployeeSelect}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Departamento</Label>
            <Select value={watch("department")} onValueChange={(val) => setValue("department", val)}>
                <SelectTrigger className="rounded-xl border-slate-200 font-bold">
                    <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Financeiro">Financeiro</SelectItem>
                    <SelectItem value="Administrativo">Administrativo</SelectItem>
                    <SelectItem value="Comercial">Comercial</SelectItem>
                    <SelectItem value="Diretoria">Diretoria</SelectItem>
                    <SelectItem value="Fiscal">Fiscal</SelectItem>
                    <SelectItem value="RH">Recursos Humanos</SelectItem>
                    <SelectItem value="Jurídico">Jurídico</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargo / Função</Label>
            <Input {...register("job_role")} placeholder="Ex: Analista Sênior" className="rounded-xl border-slate-200" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-mail</Label>
                <Input {...register("email")} type="email" placeholder="email@exemplo.com" className="rounded-xl border-slate-200" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Telefone / WhatsApp</Label>
                <Input {...register("phone")} placeholder="(00) 00000-0000" className="rounded-xl border-slate-200 font-mono" />
            </div>
        </div>

        {/* Checkboxes de Status */}
        <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                    type="checkbox" 
                    {...register("is_primary")} 
                    className="size-4 rounded border-slate-300 text-primary focus:ring-primary/20" 
                />
                <span className="text-xs font-bold text-slate-600 group-hover:text-primary transition-colors">Contato Principal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                    type="checkbox" 
                    {...register("receives_notifications")} 
                    className="size-4 rounded border-slate-300 text-primary focus:ring-primary/20" 
                />
                <span className="text-xs font-bold text-slate-600 group-hover:text-primary transition-colors">Recebe Alertas Financeiros</span>
            </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl px-6">
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="rounded-xl px-10 font-bold shadow-lg shadow-primary/20 h-12">
          {loading ? "Processando..." : (contact?.id ? "Atualizar Contato" : "Confirmar Cadastro")}
        </Button>
      </div>
    </form>
  );
}
