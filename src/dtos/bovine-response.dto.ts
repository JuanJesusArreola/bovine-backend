// modules/bovine/dtos/bovine-response.dto.ts
import { CattleType, GenderType, HealthStatus } from '../models/Bovine';

/** G-05: referencia mínima a un progenitor (madre/padre) */
export interface ParentRef {
    id: string;
    earTag: string;
    name: string | null;
    gender: string | null;
    breed: string | null;
}

export interface BovineResponse {
    id: string;
    earTag: string;
    name?: string;
    cattleType: CattleType;
    cattleTypeLabel: string;
    breed: string;
    gender: GenderType;
    genderLabel: string;
    birthDate: Date;
    ageInMonths: number;
    ageInYears: number;
    ageDisplay: string;
    /** Etapa etaria derivada por edad+sexo: 'CALF' | 'YOUNG' | 'ADULT' (B-05) */
    classification: 'CALF' | 'YOUNG' | 'ADULT';
    /** Etiqueta en español de la etapa según sexo (Becerro/Vaquilla/Toro/...) */
    classificationLabel: string;
    /** true si alcanza la edad reproductiva mínima según su sexo */
    isReproductiveAge: boolean;
    weight?: number;
    healthStatus: HealthStatus;
    healthStatusLabel: string;
    //healthColor: string;
    // P-02: vaccinationStatus/Label REMOVIDOS de la respuesta formateada (columna
    // deprecada). Usar el bloque derivado `vaccinationStatus` de /full o el
    // endpoint GET /api/bovines/:id/vaccination-status.
    location: any;
    qrCode: string;
    isAdult: boolean;
    /** FIX: estado de alta del bovino (faltaba en la respuesta) */
    isActive: boolean;
    /** Motivo de baja del hato (DECEASED/SOLD/...); null si está activo */
    exitReason: string | null;
    ranch?: {
        id: string;
        name: string;
    };
    /** G-05: madre (mini-objeto) si se pidió ?include=parents */
    mother?: ParentRef;
    /** G-05: padre (mini-objeto) si se pidió ?include=parents */
    father?: ParentRef;
    lastHealthCheck?: Date;
    isPregnant?: boolean;
    expectedCalvingDate?: Date;
    daysInOperation?: number;
}