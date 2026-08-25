export interface Workstation {
  id: string;
  name: string;
  code?: string;
  company: 'MarBR' | 'DZM' | 'G2' | 'Ybox' | 'Conectius' | 'Pessoal' | 'Usatell';
  color?: string; // Cor do marcador no mapa
  address: string;
  number?: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  lat: number;
  lng: number;
  capacity?: number; // Lotação / Vagas no posto
  allocated_employee_ids?: string[]; // IDs de colaboradores alocados neste posto
  notes?: string;
  active: boolean;
  coverage_radius_km?: number; // Raio de atendimento sugerido (ex: 10km)
}

// ─────────────────────────────────────────────────────────────
// CENTRO DE CUSTO: hierarquia Contratante → Região → Unidade
// ─────────────────────────────────────────────────────────────

/**
 * Unidade de atuação (ex: escola, posto de saúde, unidade específica).
 * Filho de CostCenter, pode pertencer a uma ServiceRegion.
 * IDs devem começar com "cc-unit-" para distinção nos filtros do mapa.
 */
export interface WorkstationUnit {
  id: string;              // ex: "cc-unit-1720000000000"
  cost_center_id: string;  // FK → CostCenter.id
  region_id?: string;      // FK → ServiceRegion.id (opcional)
  name: string;            // "EMEF João Ramalho"
  code?: string;           // "SEC-EDU-001"
  address: string;
  number?: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  lat: number;
  lng: number;
  capacity?: number;
  active: boolean;
  notes?: string;
}

/**
 * Região de atendimento: agrupamento lógico de unidades para um técnico.
 * Ex: "Zona Noroeste" cobre 5 escolas. O técnico é alocado na região,
 * não em uma unidade específica.
 * IDs devem começar com "cc-region-" para distinção.
 */
export interface ServiceRegion {
  id: string;              // ex: "cc-region-1720000000001"
  cost_center_id: string;  // FK → CostCenter.id
  name: string;            // "Zona Noroeste"
  color: string;           // Cor dos marcadores das unidades desta região
  notes?: string;
}

/**
 * Centro de Custo: representa um contratante com múltiplas
 * unidades de atuação agrupadas em regiões de atendimento.
 * Ex: "Secretaria de Educação de Santos" com 3 regiões e 12 escolas.
 * IDs devem começar com "cc-" para distinção dos postos (ws-).
 */
export interface CostCenter {
  id: string;              // ex: "cc-1720000000002"
  name: string;            // "Secretaria de Educação de Santos"
  company: string;         // "MarBR" | "DZM" | etc.
  color: string;           // Cor base do grupo no mapa
  notes?: string;
  active: boolean;
  units: WorkstationUnit[];
  regions: ServiceRegion[];
}

export interface EmployeeGeoItem {
  employee_id: string;
  name: string;
  corporate_name?: string;
  responsible_name?: string;
  job_role?: string;
  department?: string;
  company: string;
  linkType: string;
  is_outsourced?: boolean;
  photo_url?: string;
  full_address: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  lat: number;
  lng: number;
  has_valid_coords: boolean;
  current_service_location?: string;
  assigned_workstation?: Workstation | null;
  // Suporte à unidade de Centro de Custo (pode coexistir com assigned_workstation)
  assigned_unit?: WorkstationUnit | null;
  assigned_region?: ServiceRegion | null;
  assigned_cost_center?: CostCenter | null;
  nearest_workstation?: {
    workstation: Workstation;
    distance_km: number;
  } | null;
  distance_to_current_workstation_km?: number | null;
  potential_optimization?: {
    better_workstation: Workstation;
    saved_distance_km: number;
    reason: string;
  } | null;
}

export interface WorkstationOptimizationSummary {
  totalEmployeesWithAddress: number;
  totalWithoutCoordinates: number;
  totalWorkstations: number;
  optimizedCount: number;
  misallocatedCount: number; // Moram mais perto de outro posto disponível
  potentialKmSaved: number;
}
