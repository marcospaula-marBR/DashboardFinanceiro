/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';
import { Employee } from '@/types/loans';

export class PeopleService {
  /**
   * Busca os dados completos de um colaborador pelo ID,
   * trazendo todos os campos sensíveis e de RH.
   */
  static async getEmployeeProfile(employeeId: string, isTestMode?: boolean): Promise<Partial<Employee> | null> {
    const table = isTestMode ? 'employees_test' : 'employees';
    
    const { data: raw, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', employeeId)
      .single();

    if (error) {
      console.error(`[PeopleService] Erro ao buscar perfil RH do colaborador:`, error);
      return null;
    }

    if (!raw) return null;

    return this.mapRawToProfile(raw);
  }

  /**
   * Busca o histórico de alterações (Aditivos) do colaborador.
   */
  static async getEmployeeHistory(employeeId: string, isTestMode?: boolean): Promise<any[]> {
    const table = isTestMode ? 'employee_history_test' : 'employee_history';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('employee_id', employeeId)
      .order('change_date', { ascending: false });

    if (error) {
      if (isTestMode && error.code === '42P01') return [];
      console.error(`[PeopleService] Erro ao buscar histórico:`, error);
      return [];
    }
    return data || [];
  }

  /**
   * Atualiza um item do histórico (ex: para adicionar anexo).
   */
  static async updateHistoryItem(id: string, updates: any, isTestMode?: boolean): Promise<void> {
    const table = isTestMode ? 'employee_history_test' : 'employee_history';
    const { error } = await supabase.from(table).update(updates).eq('id', id);
    if (error) throw new Error(`Falha ao atualizar histórico: ${error.message}`);
  }

  static async deleteHistoryItem(id: string, isTestMode?: boolean): Promise<void> {
    const table = isTestMode ? 'employee_history_test' : 'employee_history';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(`Falha ao excluir histórico: ${error.message}`);
  }

  /**
   * Insere um novo item no histórico do colaborador.
   */
  static async insertHistoryItem(
    item: { 
      employee_id: string; 
      event_type: string; 
      change_date: string; 
      observations?: string;
    }, 
    isTestMode?: boolean
  ): Promise<any> {
    const table = isTestMode ? 'employee_history_test' : 'employee_history';
    const { data, error } = await supabase
      .from(table)
      .insert([item])
      .select()
      .single();

    if (error) throw new Error(`Falha ao registrar histórico: ${error.message}`);
    return data;
  }

  /**
   * Salva ou Atualiza um Colaborador no banco de dados.
   */
  static async saveEmployeeProfile(payload: Partial<Employee>, isTestMode?: boolean): Promise<any> {
    const table = isTestMode ? 'employees_test' : 'employees';
    
    if (payload.service_location) {
      payload.service_location = this.capitalizeWords(payload.service_location);
    }
    
    // Mapeamento inverso para as colunas do DB
    const dbPayload = this.mapProfileToRaw(payload);
    
    const { id, ...updateData } = dbPayload;

    if (id) {
      // UPDATE
      const { data, error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw new Error(`Falha ao atualizar colaborador: ${error.message}`);
      return data;
    } else {
      // INSERT
      const { data, error } = await supabase
        .from(table)
        .insert([updateData])
        .select()
        .single();
      
      if (error) throw new Error(`Falha ao registrar novo colaborador: ${error.message}`);
      return data;
    }
  }

  /**
   * Busca um colaborador existente por CNPJ, CPF ou Nome (em ordem de prioridade)
   */
  static async findEmployeeByUniqueKeys(
    keys: { cnpj?: string; cpf?: string; name?: string },
    isTestMode?: boolean
  ): Promise<any | null> {
    const table = isTestMode ? 'employees_test' : 'employees';
    
    // 1. Comparar CNPJ (campo pj_type)
    if (keys.cnpj) {
      const cleanCnpj = keys.cnpj.replace(/\D/g, '');
      if (cleanCnpj && cleanCnpj.length === 14) {
        const formattedCnpj = `${cleanCnpj.substring(0, 2)}.${cleanCnpj.substring(2, 5)}.${cleanCnpj.substring(5, 8)}/${cleanCnpj.substring(8, 12)}-${cleanCnpj.substring(12, 14)}`;
        
        const { data } = await supabase
          .from(table)
          .select('id, full_name, document_id, pj_type')
          .or(`pj_type.eq."${cleanCnpj}",pj_type.eq."${formattedCnpj}"`);
        
        if (data && data.length > 0) return data[0];
      }
    }

    // 2. Comparar CPF (campo document_id)
    if (keys.cpf) {
      const cleanCpf = keys.cpf.replace(/\D/g, '');
      if (cleanCpf && cleanCpf.length === 11) {
        const formattedCpf = `${cleanCpf.substring(0, 3)}.${cleanCpf.substring(3, 6)}.${cleanCpf.substring(6, 9)}-${cleanCpf.substring(9, 11)}`;
        
        const { data } = await supabase
          .from(table)
          .select('id, full_name, document_id, pj_type')
          .or(`document_id.eq."${cleanCpf}",document_id.eq."${formattedCpf}"`);
        
        if (data && data.length > 0) return data[0];
      }
    }

    // 3. Comparar Nome (campos full_name e name)
    if (keys.name) {
      const cleanName = keys.name.trim();
      if (cleanName) {
        const { data } = await supabase
          .from(table)
          .select('id, full_name, document_id, pj_type')
          .or(`full_name.ilike.${cleanName},name.ilike.${cleanName}`);
        
        if (data && data.length > 0) return data[0];
      }
    }

    return null;
  }

  /**
   * Retorna valores distintos de uma coluna (para autocomplete)
   */
  static async getDistinctValues(column: string, isTestMode?: boolean): Promise<string[]> {
    const table = isTestMode ? 'employees_test' : 'employees';
    const { data } = await supabase
      .from(table)
      .select(column)
      .not(column, 'is', null)
      .neq(column, '');
    if (!data) return [];
    
    const unique = [...new Set(data.map((r: any) => {
      const val = r[column];
      if (typeof val !== 'string') return val;
      return this.capitalizeWords(val);
    }).filter(Boolean))] as string[];
    
    return unique.sort();
  }

  /**
   * Salva o upload de um arquivo para o Storage (ex: foto de perfil)
   */
  static async uploadProfilePhoto(employeeId: string, file: File, isTestMode?: boolean): Promise<string> {
    const folder = isTestMode ? 'test' : 'production';
    const ext = file.name.split('.').pop() || 'jpg';
    const storagePath = `avatars/${folder}/${employeeId}.${ext}`;

    // Remove versão anterior
    await supabase.storage.from('contracts').remove([storagePath]);

    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(storagePath, file, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error(`Falha no upload da foto: ${uploadError.message}`);

    const { data } = await supabase.storage.from('contracts').createSignedUrl(storagePath, 315360000); // 10 years
    
    return data?.signedUrl || '';
  }

  /**
   * Salva o upload de um Aditivo/Contrato do RH para o Storage (bucket contracts)
   */
  static async uploadAdditiveFile(employeeId: string, file: File, isTestMode?: boolean): Promise<string> {
    const folder = isTestMode ? 'test' : 'production';
    const ext = file.name.split('.').pop() || 'pdf';
    const storagePath = `rh-aditivos/${folder}/${employeeId}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(storagePath, file, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error(`Falha no upload do aditivo: ${uploadError.message}`);

    const { data } = await supabase.storage.from('contracts').createSignedUrl(storagePath, 31536000); // 1 year approx
    return data?.signedUrl || storagePath;
  }

  // --- Converters ---
  private static mapRawToProfile(raw: any): Partial<Employee> {
    const safeParseJson = (data: any) => {
      if (!data) return [];
      if (typeof data === 'string') {
        try { return JSON.parse(data); } catch { return []; }
      }
      return data;
    };

    return {
      id: raw.id,
      name: raw.full_name || raw.name,
      corporate_name: raw.corporate_name,
      responsible_name: raw.responsible_name,
      responsible_cpf: raw.responsible_cpf,
      responsible_rg: raw.responsible_rg,
      document_id: raw.document_id,
      document_rg: raw.document_rg,
      pj_type: raw.pj_type,
      linkType: (raw.employment_type || raw.link_type) as any,
      company: raw.company,
      remuneration: parseFloat(String(raw.remuneration)) || 0,
      remuneration_fixed: raw.remuneration_fixed ? parseFloat(String(raw.remuneration_fixed)) : 0,
      remuneration_bonus: raw.remuneration_bonus ? parseFloat(String(raw.remuneration_bonus)) : 0,
      remuneration_commission: raw.remuneration_commission ? parseFloat(String(raw.remuneration_commission)) : 0,
      totalTaken: raw.loan_amount ? parseFloat(String(raw.loan_amount)) : 0,
      balance: raw.loan_amount ? parseFloat(String(raw.loan_amount)) : 0,
      status: raw.status || (raw.active ? 'Ativo' : 'Inativo'),
      created_at: raw.created_at,
      
      // Novos campos RH
      job_role: raw.job_role,
      department: raw.department,
      nivel: raw.nivel,
      department_start_date: raw.department_start_date || '',
      commission_plan: raw.commission_plan || '',
      
      // Endereço
      zip_code: raw.zip_code,
      street: raw.street,
      number: raw.number,
      neighborhood: raw.neighborhood,
      city: raw.city,
      state: raw.state,
      complement: raw.complement,

      // Novos campos RH v3
      is_outsourced: raw.is_outsourced,
      service_location: raw.service_location,
      tax_regime: raw.tax_regime,
      cnpj_zip_code: raw.cnpj_zip_code,
      cnpj_street: raw.cnpj_street,
      cnpj_number: raw.cnpj_number,
      cnpj_complement: raw.cnpj_complement,
      cnpj_neighborhood: raw.cnpj_neighborhood,
      cnpj_city: raw.cnpj_city,
      cnpj_state: raw.cnpj_state,
      executive_summary: raw.executive_summary,
      executive_link: raw.executive_link,
      
      // Contato
      email: raw.email,
      phone: raw.phone,
      phone_professional: raw.phone_professional,
      email_professional: raw.email_professional,
      pix_key: raw.pix_key,
      emergency_contact_name: raw.emergency_contact_name,
      emergency_contact_phone: raw.emergency_contact_phone,
      
      // Dados Auxiliares
      children_data: safeParseJson(raw.children_data),
      education_data: safeParseJson(raw.education_data),
      
      photo_url: raw.photo_url || raw.avatar_url,
      contract_expiry_date: raw.contract_expiry_date || '',
      start_date: raw.start_date || '',
      resignation_date: raw.resignation_date || '',
      status_start_date: raw.status_start_date || '',
      status_end_date: raw.status_end_date || '',
      links_contratos: raw.links_contratos,
      links_aditivos: raw.links_aditivos,
      links_emprestimos: raw.links_emprestimos,
      has_invoice_glosa: raw.metadata?.has_invoice_glosa || false,
      last_raise_date: raw.metadata?.last_raise_date || null,
      grau: raw.metadata?.grau || ''
    };
  }

  private static mapProfileToRaw(profile: Partial<Employee>): any {
    return {
      id: profile.id,
      full_name: profile.name,
      corporate_name: profile.corporate_name,
      responsible_name: profile.responsible_name,
      responsible_cpf: profile.responsible_cpf,
      responsible_rg: profile.responsible_rg,
      document_id: profile.document_id,
      document_rg: profile.document_rg,
      pj_type: profile.pj_type,
      employment_type: profile.linkType,
      company: profile.company,
      remuneration: (profile.remuneration_fixed || 0) + (profile.remuneration_bonus || 0) + (profile.remuneration_commission || 0),
      remuneration_fixed: profile.remuneration_fixed || 0,
      remuneration_bonus: profile.remuneration_bonus || 0,
      remuneration_commission: profile.remuneration_commission || 0,
      status: profile.status,
      
      // Novos campos RH
      job_role: profile.job_role,
      department: profile.department,
      nivel: profile.nivel,
      department_start_date: profile.department_start_date && profile.department_start_date.trim() !== '' ? profile.department_start_date : null,
      commission_plan: profile.commission_plan || '',
      
      zip_code: profile.zip_code,
      street: profile.street,
      number: profile.number,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state: profile.state,
      complement: profile.complement,
      
      email: profile.email,
      phone: profile.phone,
      phone_professional: profile.phone_professional,
      email_professional: profile.email_professional,
      pix_key: profile.pix_key,
      emergency_contact_name: profile.emergency_contact_name,
      emergency_contact_phone: profile.emergency_contact_phone,
      
      children_data: profile.children_data,
      education_data: profile.education_data,
      
      photo_url: profile.photo_url,
      contract_expiry_date: profile.contract_expiry_date && profile.contract_expiry_date.trim() !== '' ? profile.contract_expiry_date : null,
      start_date: profile.start_date && profile.start_date.trim() !== '' ? profile.start_date : null,
      resignation_date: profile.resignation_date && profile.resignation_date.trim() !== '' ? profile.resignation_date : null,
      status_start_date: profile.status_start_date && profile.status_start_date.trim() !== '' ? profile.status_start_date : null,
      status_end_date: profile.status_end_date && profile.status_end_date.trim() !== '' ? profile.status_end_date : null,
      links_contratos: profile.links_contratos,
      links_aditivos: profile.links_aditivos,
      links_emprestimos: profile.links_emprestimos,

      // Novos campos RH v3
      is_outsourced: profile.is_outsourced || false,
      service_location: profile.service_location || '',
      tax_regime: profile.tax_regime || '',
      cnpj_zip_code: profile.cnpj_zip_code || '',
      cnpj_street: profile.cnpj_street || '',
      cnpj_number: profile.cnpj_number || '',
      cnpj_complement: profile.cnpj_complement || '',
      cnpj_neighborhood: profile.cnpj_neighborhood || '',
      cnpj_city: profile.cnpj_city || '',
      cnpj_state: profile.cnpj_state || '',
      executive_summary: profile.executive_summary || '',
      executive_link: profile.executive_link || '',
      metadata: {
        ...(profile.metadata || {}),
        has_invoice_glosa: profile.has_invoice_glosa || false,
        last_raise_date: profile.last_raise_date || null,
        grau: profile.grau || ''
      }
    };
  }

  static capitalizeWords(str: string): string {
    return str
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
