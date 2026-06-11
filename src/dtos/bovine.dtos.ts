// dtos/bovine.dtos.ts
// ============================================================================
// CONTRATOS DE RESPUESTA — MÓDULO BOVINOS
// ============================================================================
// Punto único para que el frontend (o cualquier cliente) sepa exactamente
// qué shape devuelve cada endpoint del módulo bovinos.
//
// Estrategia: re-exportamos los tipos definidos en cada service, con un alias
// orientado a "Response" para que sea claro su propósito como contrato.
//
// La forma "Response" SIEMPRE es lo que va dentro del campo `data` de la
// envoltura estándar:
//   { success: boolean, data: <Response>, ...meta }
//
// Cualquier breaking change a estos tipos debe coordinarse con el frontend.
// ============================================================================

// ────────────────────────────────────────────────────────────────────────────
// Bovino — listado y detalle básico
// ────────────────────────────────────────────────────────────────────────────

export type {
  BovineFilters,
  BovineListResponse,
  BovineStatistics,
} from '../services/BovineService';

export type {
  BovineResponse as BovineDetailResponse,
} from './bovine-response.dto';

// ────────────────────────────────────────────────────────────────────────────
// Bovino — endpoint compuesto /full
// ────────────────────────────────────────────────────────────────────────────

export type {
  BovineFullResponse,
  BovineRecentHealthRecord,
  BovineRecentMovement,
} from '../services/BovineFullService';

// ────────────────────────────────────────────────────────────────────────────
// Ubicación actual consolidada
// ────────────────────────────────────────────────────────────────────────────

export type {
  ConsolidatedCurrentLocation as BovineCurrentLocationResponse,
  CurrentLocationStatus,
} from '../services/BovineLocationService';

// ────────────────────────────────────────────────────────────────────────────
// Vacunación
// ────────────────────────────────────────────────────────────────────────────

export type {
  VaccinationListItem as VaccinationResponse,
  VaccinationListResult as VaccinationListResponse,
  CreateVaccinationInput,
  ListVaccinationsFilters,
} from '../services/VaccinationService';

export type {
  VaccinationStatusSnapshot as VaccinationStatusResponse,
} from '../services/BovineVaccinationStatusService';

// ────────────────────────────────────────────────────────────────────────────
// Multimedia
// ────────────────────────────────────────────────────────────────────────────

export type {
  MediaItem as BovineMediaItemResponse,
  MediaListResult as BovineMediaListResponse,
  MediaUploadResult as BovineMediaUploadResponse,
  BovineMediaType,
} from '../services/BovineMediaService';

// ────────────────────────────────────────────────────────────────────────────
// Mapa — markers / clusters
// ────────────────────────────────────────────────────────────────────────────

export type {
  MapMarker as BovineMapMarkerResponse,
  MapClusterPoint as BovineMapClusterResponse,
  MapMarkersResult as BovineMapMarkersResponse,
  MapMarkersFilters,
  MapMarkersOptions,
} from '../services/BovineGeoService';

// ────────────────────────────────────────────────────────────────────────────
// Catálogo de filtros (dropdowns)
// ────────────────────────────────────────────────────────────────────────────

export type {
  BovineFilterOptions as BovineFiltersOptionsResponse,
  FilterOption,
} from '../services/BovineFiltersService';

// ────────────────────────────────────────────────────────────────────────────
// Envoltura estándar (referencia para el frontend)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Forma genérica de una respuesta exitosa del API.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  /** Solo presente en endpoints paginados */
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Forma de una respuesta de error. `code` es estable y procesable por código;
 * `error` es texto legible para el usuario.
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, any>;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
