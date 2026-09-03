import { supabase } from '@/lib/supabase';
import { 
  ClaraTransactionRecord, 
  ClaraConfig, 
  ClaraCategoryMapping, 
  ClaraDepartmentMapping, 
  ClaraSyncRun 
} from '@/types/clara.types';

const GLOBAL_CONFIG_NAME = '__SYSTEM_GLOBAL_CONFIG__';

interface ClaraStoreState {
  config: ClaraConfig;
  category_mappings: ClaraCategoryMapping[];
  department_mappings: ClaraDepartmentMapping[];
  transactions: Record<string, ClaraTransactionRecord>;
  sync_runs: ClaraSyncRun[];
}

export class ClaraStorageService {
  private static memoryState: ClaraStoreState | null = null;

  /**
   * Obtém o container de metadados do Supabase
   */
  private static async getRemoteState(): Promise<ClaraStoreState | null> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, metadata')
        .eq('full_name', GLOBAL_CONFIG_NAME)
        .maybeSingle();

      if (error || !data?.metadata?.clara_integration) {
        return null;
      }

      return data.metadata.clara_integration as ClaraStoreState;
    } catch (e: any) {
      console.warn('[ClaraStorageService] Aviso ao ler metadata do Supabase:', e.message);
      return null;
    }
  }

  /**
   * Salva o estado completo no Supabase (coluna metadata de employees.__SYSTEM_GLOBAL_CONFIG__)
   */
  private static async persistRemoteState(state: ClaraStoreState): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('employees')
        .select('id, metadata')
        .eq('full_name', GLOBAL_CONFIG_NAME)
        .maybeSingle();

      const existingMeta = (existing?.metadata as Record<string, any>) || {};
      const updatedMeta = {
        ...existingMeta,
        clara_integration: state,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        await supabase
          .from('employees')
          .update({ metadata: updatedMeta })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('employees')
          .insert([{
            full_name: GLOBAL_CONFIG_NAME,
            company: 'MarBR',
            employment_type: 'CLT',
            active: false,
            status: 'Inativo',
            metadata: updatedMeta,
          }]);
      }
    } catch (e: any) {
      console.warn('[ClaraStorageService] Aviso ao persistir estado no Supabase:', e.message);
    }
  }

  /**
   * Inicializa ou carrega o estado ativo
   */
  public static async getState(defaultConfig: ClaraConfig): Promise<ClaraStoreState> {
    if (!this.memoryState) {
      const remote = await this.getRemoteState();
      if (remote) {
        this.memoryState = {
          config: { ...defaultConfig, ...(remote.config || {}) },
          category_mappings: remote.category_mappings || [],
          department_mappings: remote.department_mappings || [],
          transactions: remote.transactions || {},
          sync_runs: remote.sync_runs || [],
        };
      } else {
        this.memoryState = {
          config: { ...defaultConfig },
          category_mappings: [],
          department_mappings: [],
          transactions: {},
          sync_runs: [],
        };
      }
    }
    return this.memoryState;
  }

  // --- MÉTODOS DE TRANSAÇÕES ---

  public static async saveTransaction(tx: ClaraTransactionRecord, defaultConfig: ClaraConfig): Promise<void> {
    const state = await this.getState(defaultConfig);
    state.transactions[tx.clara_uuid] = tx;
    await this.persistRemoteState(state);
  }

  public static async saveTransactionsBatch(txList: ClaraTransactionRecord[], defaultConfig: ClaraConfig): Promise<void> {
    const state = await this.getState(defaultConfig);
    for (const tx of txList) {
      state.transactions[tx.clara_uuid] = tx;
    }
    await this.persistRemoteState(state);
  }

  public static async getTransaction(idOrUuid: string, defaultConfig: ClaraConfig): Promise<ClaraTransactionRecord | null> {
    const state = await this.getState(defaultConfig);
    if (state.transactions[idOrUuid]) {
      return state.transactions[idOrUuid];
    }
    const found = Object.values(state.transactions).find(t => t.id === idOrUuid || t.clara_uuid === idOrUuid);
    return found || null;
  }

  public static async getAllTransactions(defaultConfig: ClaraConfig): Promise<ClaraTransactionRecord[]> {
    const state = await this.getState(defaultConfig);
    return Object.values(state.transactions);
  }

  /**
   * Limpa o omie_launch_id e attachments_synced de uma transação para forçar reenvio.
   * Atualiza tanto o memoryState quanto o Supabase remoto.
   */
  public static async resetTransactionForResync(idOrUuid: string, defaultConfig: ClaraConfig): Promise<void> {
    const state = await this.getState(defaultConfig);
    // Encontra a transação no estado em memória
    const key = Object.keys(state.transactions).find(k => k === idOrUuid || state.transactions[k].id === idOrUuid);
    if (key) {
      state.transactions[key] = {
        ...state.transactions[key],
        omie_launch_id: null as unknown as number,
        omie_account_id: null as unknown as number,
        attachments_synced: false,
        sync_status: 'READY',
        last_sync_error: null,
      };
    }
    // Invalida o cache para forçar releitura do Supabase na próxima chamada
    this.memoryState = null;
    await this.persistRemoteState(state);
  }

  // --- MÉTODOS DE CONFIGURAÇÃO ---

  public static async getConfig(defaultConfig: ClaraConfig): Promise<ClaraConfig> {
    const state = await this.getState(defaultConfig);
    return state.config;
  }

  public static async saveConfig(partial: Partial<ClaraConfig>, defaultConfig: ClaraConfig): Promise<ClaraConfig> {
    const state = await this.getState(defaultConfig);
    state.config = {
      ...state.config,
      ...partial,
      updated_at: new Date().toISOString(),
    };
    await this.persistRemoteState(state);
    return state.config;
  }

  // --- MAPEAMENTOS ---

  public static async getCategoryMappings(defaultConfig: ClaraConfig): Promise<ClaraCategoryMapping[]> {
    const state = await this.getState(defaultConfig);
    return state.category_mappings;
  }

  public static async saveCategoryMapping(item: ClaraCategoryMapping, defaultConfig: ClaraConfig): Promise<void> {
    const state = await this.getState(defaultConfig);
    const idx = state.category_mappings.findIndex(m => m.clara_category.toLowerCase() === item.clara_category.toLowerCase());
    if (idx >= 0) state.category_mappings[idx] = item;
    else state.category_mappings.push(item);
    await this.persistRemoteState(state);
  }

  public static async deleteCategoryMapping(category: string, defaultConfig: ClaraConfig): Promise<void> {
    const state = await this.getState(defaultConfig);
    state.category_mappings = state.category_mappings.filter(m => m.clara_category !== category);
    await this.persistRemoteState(state);
  }

  public static async getDepartmentMappings(defaultConfig: ClaraConfig): Promise<ClaraDepartmentMapping[]> {
    const state = await this.getState(defaultConfig);
    return state.department_mappings;
  }

  public static async saveDepartmentMapping(item: ClaraDepartmentMapping, defaultConfig: ClaraConfig): Promise<void> {
    const state = await this.getState(defaultConfig);
    const idx = state.department_mappings.findIndex(m => m.mapping_type === item.mapping_type && m.clara_key.toLowerCase() === item.clara_key.toLowerCase());
    if (idx >= 0) state.department_mappings[idx] = item;
    else state.department_mappings.push(item);
    await this.persistRemoteState(state);
  }

  public static async deleteDepartmentMapping(mappingType: string, claraKey: string, defaultConfig: ClaraConfig): Promise<void> {
    const state = await this.getState(defaultConfig);
    state.department_mappings = state.department_mappings.filter(m => !(m.mapping_type === mappingType && m.clara_key === claraKey));
    await this.persistRemoteState(state);
  }

  // --- EXECUÇÕES DE SYNC ---

  public static async addSyncRun(run: ClaraSyncRun, defaultConfig: ClaraConfig): Promise<void> {
    const state = await this.getState(defaultConfig);
    state.sync_runs.unshift(run);
    if (state.sync_runs.length > 50) state.sync_runs = state.sync_runs.slice(0, 50);
    this.persistRemoteState(state).catch(() => {});
  }

  public static async updateSyncRun(run: ClaraSyncRun, defaultConfig: ClaraConfig): Promise<void> {
    const state = await this.getState(defaultConfig);
    const idx = state.sync_runs.findIndex(r => r.id === run.id);
    if (idx >= 0) state.sync_runs[idx] = run;
    this.persistRemoteState(state).catch(() => {});
  }

  public static async getSyncRuns(defaultConfig: ClaraConfig): Promise<ClaraSyncRun[]> {
    const state = await this.getState(defaultConfig);
    return state.sync_runs;
  }
}
