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
