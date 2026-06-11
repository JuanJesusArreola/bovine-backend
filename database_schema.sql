-- ============================================================================
-- SISTEMA GANADERO - ESQUEMA COMPLETO DE BASE DE DATOS
-- Generado automáticamente desde modelos Sequelize
-- Fecha: 2024
-- ============================================================================

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- ENUMS Y TIPOS PERSONALIZADOS
-- ============================================================================

-- Enums para User
CREATE TYPE user_role AS ENUM (
    'ADMIN', 'MANAGER', 'VETERINARIAN', 'TECHNICIAN', 'WORKER', 'VIEWER'
);

CREATE TYPE user_status AS ENUM (
    'ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'BLOCKED'
);

CREATE TYPE access_level AS ENUM (
    'BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE', 'CUSTOM'
);

CREATE TYPE verification_status AS ENUM (
    'UNVERIFIED', 'EMAIL_VERIFIED', 'PHONE_VERIFIED', 'FULLY_VERIFIED', 'REJECTED'
);

-- Enums para Ranch
CREATE TYPE ranch_type AS ENUM (
    'CATTLE_RANCH', 'DAIRY_FARM', 'BEEF_FARM', 'MIXED_FARM', 'BREEDING_FARM', 'FEEDLOT', 'ORGANIC_FARM'
);

CREATE TYPE ranch_status AS ENUM (
    'ACTIVE', 'INACTIVE', 'UNDER_CONSTRUCTION', 'MAINTENANCE', 'SUSPENDED', 'CLOSED'
);

CREATE TYPE land_tenure AS ENUM (
    'OWNED', 'RENTED', 'LEASED', 'SHARED', 'COMMUNAL', 'GOVERNMENT'
);

CREATE TYPE climate_zone AS ENUM (
    'TROPICAL', 'SUBTROPICAL', 'TEMPERATE', 'CONTINENTAL', 'ARID', 'SEMI_ARID', 'ALPINE'
);

-- Enums para Bovine
CREATE TYPE cattle_type AS ENUM (
    'BEEF', 'DAIRY', 'DUAL_PURPOSE', 'BREEDING', 'WORKING'
);

CREATE TYPE gender_type AS ENUM (
    'MALE', 'FEMALE', 'CASTRATED_MALE', 'HEIFER', 'COW', 'BULL', 'STEER'
);

CREATE TYPE health_status AS ENUM (
    'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL', 'QUARANTINED', 'DECEASED'
);

CREATE TYPE vaccination_status AS ENUM (
    'UP_TO_DATE', 'OVERDUE', 'PARTIAL', 'NOT_VACCINATED', 'EXEMPT'
);

-- Enums para Health
CREATE TYPE health_record_type AS ENUM (
    'ROUTINE_CHECKUP', 'VACCINATION', 'TREATMENT', 'EMERGENCY', 'SURGERY', 'QUARANTINE', 'AUTopsy'
);

-- Enums para Production
CREATE TYPE production_type AS ENUM (
    'MILK', 'MEAT', 'BREEDING', 'WORK', 'OTHER'
);

CREATE TYPE production_status AS ENUM (
    'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'QUALITY_CHECK', 'APPROVED', 'REJECTED'
);

CREATE TYPE quality_grade AS ENUM (
    'PREMIUM', 'A', 'B', 'C', 'D', 'REJECTED'
);

-- Enums para Reproduction
CREATE TYPE reproduction_type AS ENUM (
    'NATURAL_BREEDING', 'ARTIFICIAL_INSEMINATION', 'EMBRYO_TRANSFER', 'IN_VITRO_FERTILIZATION'
);

CREATE TYPE service_status AS ENUM (
    'HEAT_DETECTED', 'SERVICED', 'PREGNANT', 'OPEN', 'ABORTED', 'CALVED', 'WEANED'
);

-- Enums para Event
CREATE TYPE event_type AS ENUM (
    'VACCINATION', 'DISEASE', 'HEALTH_CHECK', 'TREATMENT', 'REPRODUCTION', 'MOVEMENT', 
    'FEEDING', 'WEIGHING', 'BIRTH', 'DEATH', 'INJURY', 'QUARANTINE', 'MEDICATION', 
    'SURGERY', 'OTHER'
);

CREATE TYPE event_status AS ENUM (
    'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED', 'FAILED'
);

CREATE TYPE event_priority AS ENUM (
    'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY'
);

-- Enums para Finance
CREATE TYPE transaction_type AS ENUM (
    'INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT'
);

CREATE TYPE payment_method AS ENUM (
    'CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'DEBIT_CARD', 'DIGITAL_WALLET', 
    'CRYPTOCURRENCY', 'BARTER', 'CREDIT_NOTE', 'OTHER'
);

CREATE TYPE transaction_status AS ENUM (
    'PENDING', 'COMPLETED', 'CANCELLED', 'FAILED', 'REFUNDED', 'PARTIAL', 'OVERDUE'
);

-- Enums para Inventory
CREATE TYPE inventory_category AS ENUM (
    'FEED', 'MEDICATION', 'VACCINES', 'EQUIPMENT', 'TOOLS', 'SUPPLIES', 
    'BREEDING_MATERIALS', 'CLEANING_PRODUCTS', 'SAFETY_EQUIPMENT', 'OFFICE_SUPPLIES', 
    'FUEL', 'SEEDS', 'FERTILIZERS', 'PESTICIDES', 'SPARE_PARTS', 'OTHER'
);

CREATE TYPE stock_status AS ENUM (
    'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'BACKORDERED', 'DISCONTINUED', 
    'EXPIRED', 'DAMAGED', 'RESERVED'
);

CREATE TYPE storage_condition AS ENUM (
    'AMBIENT', 'REFRIGERATED', 'FROZEN', 'DRY', 'HUMID', 'CONTROLLED_ATMOSPHERE', 
    'HAZMAT', 'SPECIAL'
);

CREATE TYPE unit_of_measure AS ENUM (
    'KG', 'G', 'LB', 'OZ', 'TON', 'L', 'ML', 'GAL', 'QT', 'PT', 'M', 'CM', 'MM', 
    'FT', 'IN', 'M2', 'FT2', 'HA', 'ACRE', 'UNIT', 'DOZEN', 'BOX', 'PACK', 
    'BOTTLE', 'BAG', 'ROLL', 'SHEET', 'DAY', 'WEEK', 'MONTH', 'YEAR'
);

-- Enums para Location
CREATE TYPE location_type AS ENUM (
    'FARM', 'PASTURE', 'CORRAL', 'BARN', 'MILKING_PARLOR', 'FEED_AREA', 'WATER_SOURCE', 
    'VETERINARY_CLINIC', 'QUARANTINE_AREA', 'LOADING_AREA', 'STORAGE', 'OFFICE', 
    'RESIDENTIAL', 'PROCESSING_PLANT', 'MARKET', 'SLAUGHTERHOUSE', 'BREEDING_CENTER', 
    'LABORATORY', 'WASTE_MANAGEMENT', 'EQUIPMENT_SHED', 'REPAIR_SHOP', 'FUEL_STATION', 
    'ENTRANCE_GATE', 'SECURITY_POST', 'EMERGENCY_POINT', 'RESTRICTED_AREA', 
    'DANGER_ZONE', 'SAFE_ZONE', 'ROUTE', 'CHECKPOINT', 'OTHER'
);

CREATE TYPE location_status AS ENUM (
    'ACTIVE', 'INACTIVE', 'UNDER_CONSTRUCTION', 'UNDER_MAINTENANCE', 'QUARANTINED', 
    'FLOODED', 'DAMAGED', 'CLOSED', 'RESTRICTED'
);

-- Enums para Medication
CREATE TYPE medication_type AS ENUM (
    'ANTIBIOTIC', 'ANTI_INFLAMMATORY', 'ANALGESIC', 'ANTIPARASITIC', 'ANTIFUNGAL', 
    'ANTIVIRAL', 'VACCINE', 'VITAMIN', 'MINERAL', 'HORMONE', 'SEDATIVE', 'ANESTHETIC', 
    'REPRODUCTIVE', 'NUTRITIONAL', 'IMMUNOMODULATOR', 'ANTIDIARRHEAL', 'RESPIRATORY', 
    'CARDIOVASCULAR', 'TOPICAL', 'DISINFECTANT', 'SUPPLEMENT', 'PROBIOTIC', 
    'PREBIOTIC', 'OTHER'
);

CREATE TYPE storage_requirement AS ENUM (
    'ROOM_TEMPERATURE', 'REFRIGERATED', 'FROZEN', 'CONTROLLED_TEMPERATURE', 
    'PROTECT_FROM_LIGHT', 'PROTECT_FROM_MOISTURE', 'STORE_UPRIGHT', 'DO_NOT_SHAKE', 
    'SPECIAL_HANDLING'
);

CREATE TYPE controlled_substance_class AS ENUM (
    'NONE', 'CLASS_I', 'CLASS_II', 'CLASS_III', 'CLASS_IV', 'CLASS_V'
);

-- ============================================================================
-- TABLA USERS
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usercode VARCHAR(20) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    status user_status NOT NULL DEFAULT 'ACTIVE',
    access_level access_level NOT NULL,
    verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
    
    -- Información personal (JSONB)
    personal_info JSONB NOT NULL,
    contact_info JSONB NOT NULL,
    professional_info JSONB,
    system_settings JSONB,
    permissions JSONB NOT NULL,
    activity JSONB,
    performance_metrics JSONB,
    ranch_access JSONB,
    subscription_info JSONB,
    api_access JSONB,
    security_info JSONB,
    compliance_info JSONB,
    integrations JSONB,
    
    -- Campos adicionales
    tags TEXT[],
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    phone_verified BOOLEAN NOT NULL DEFAULT false,
    terms_accepted BOOLEAN NOT NULL DEFAULT false,
    terms_accepted_date TIMESTAMP,
    privacy_policy_accepted BOOLEAN NOT NULL DEFAULT false,
    privacy_policy_accepted_date TIMESTAMP,
    last_login_at TIMESTAMP,
    last_active_at TIMESTAMP,
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_personal_info_gin ON users USING gin(personal_info);
CREATE INDEX idx_users_permissions_gin ON users USING gin(permissions);

-- ============================================================================
-- TABLA RANCHES
-- ============================================================================

CREATE TABLE ranches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ranch_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type ranch_type NOT NULL,
    status ranch_status NOT NULL DEFAULT 'ACTIVE',
    
    -- Coordenadas geográficas
    coordinates JSONB NOT NULL,
    
    -- Información de ubicación
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'México',
    postal_code VARCHAR(20),
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Mexico_City',
    
    -- Información de la tierra
    land_tenure land_tenure NOT NULL,
    climate_zone climate_zone NOT NULL,
    elevation DECIMAL(8,2),
    annual_rainfall DECIMAL(8,2),
    average_temperature DECIMAL(5,2),
    
    -- Información estructurada (JSONB)
    ownership_info JSONB NOT NULL,
    capacity JSONB NOT NULL,
    production_metrics JSONB,
    financial_info JSONB,
    sustainability_info JSONB,
    technology_info JSONB,
    hr_info JSONB,
    certifications JSONB,
    licenses JSONB,
    insurance JSONB,
    emergency_plan JSONB,
    quality_standards JSONB,
    market_position JSONB,
    
    -- Medios
    images TEXT[],
    documents TEXT[],
    maps TEXT[],
    videos TEXT[],
    website VARCHAR(500),
    social_media JSONB,
    
    -- Campos adicionales
    tags TEXT[],
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_date TIMESTAMP,
    last_inspection_date TIMESTAMP,
    next_inspection_date TIMESTAMP,
    compliance_score DECIMAL(5,2),
    
    -- Relaciones
    owner_id UUID REFERENCES users(id),
    
    -- Auditoría
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para ranches
CREATE INDEX idx_ranches_owner_id ON ranches(owner_id);
CREATE INDEX idx_ranches_type ON ranches(type);
CREATE INDEX idx_ranches_status ON ranches(status);
CREATE INDEX idx_ranches_is_active ON ranches(is_active);
CREATE INDEX idx_ranches_coordinates_gin ON ranches USING gin(coordinates);
CREATE INDEX idx_ranches_ownership_info_gin ON ranches USING gin(ownership_info);

-- ============================================================================
-- TABLA BOVINES
-- ============================================================================

CREATE TABLE bovines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ear_tag VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100),
    breed VARCHAR(100) NOT NULL,
    cattle_type cattle_type NOT NULL,
    gender gender_type NOT NULL,
    birth_date DATE NOT NULL,
    weight DECIMAL(8,2),
    health_status health_status NOT NULL DEFAULT 'GOOD',
    vaccination_status vaccination_status NOT NULL DEFAULT 'NOT_VACCINATED',
    
    -- Información estructurada (JSONB)
    location JSONB NOT NULL,
    physical_metrics JSONB,
    reproductive_info JSONB,
    tracking_config JSONB,
    
    -- Información de adquisición
    acquisition_date DATE,
    acquisition_price DECIMAL(12,2),
    current_value DECIMAL(12,2),
    
    -- Campos adicionales
    notes TEXT,
    images TEXT[],
    qr_code VARCHAR(100) UNIQUE,
    rfid_tag VARCHAR(50) UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_health_check TIMESTAMP,
    next_health_check TIMESTAMP,
    
    -- Relaciones familiares
    mother_id UUID REFERENCES bovines(id),
    father_id UUID REFERENCES bovines(id),
    
    -- Relaciones principales
    farm_id UUID REFERENCES ranches(id),
    owner_id UUID REFERENCES users(id),
    
    -- Auditoría
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para bovines
CREATE INDEX idx_bovines_farm_id ON bovines(farm_id);
CREATE INDEX idx_bovines_owner_id ON bovines(owner_id);
CREATE INDEX idx_bovines_ear_tag ON bovines(ear_tag);
CREATE INDEX idx_bovines_breed ON bovines(breed);
CREATE INDEX idx_bovines_health_status ON bovines(health_status);
CREATE INDEX idx_bovines_is_active ON bovines(is_active);
CREATE INDEX idx_bovines_mother_id ON bovines(mother_id);
CREATE INDEX idx_bovines_father_id ON bovines(father_id);
CREATE INDEX idx_bovines_location_gin ON bovines USING gin(location);

-- ============================================================================
-- TABLA HEALTH_RECORDS
-- ============================================================================

CREATE TABLE health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bovine_id UUID NOT NULL REFERENCES bovines(id),
    record_type health_record_type NOT NULL,
    record_date TIMESTAMP NOT NULL,
    veterinarian_id UUID REFERENCES users(id),
    technician_id UUID REFERENCES users(id),
    
    -- Información médica
    location JSONB,
    chief_complaint TEXT,
    history_present TEXT,
    history_past TEXT,
    vital_signs JSONB,
    physical_exam JSONB,
    symptoms JSONB,
    diagnosis JSONB,
    treatment JSONB,
    laboratory_results JSONB,
    nutritional_assessment JSONB,
    reproductive_assessment JSONB,
    
    -- Estado y seguimiento
    overall_health_status health_status NOT NULL,
    recommendations TEXT[],
    next_appointment TIMESTAMP,
    follow_up_required BOOLEAN NOT NULL DEFAULT false,
    follow_up_date TIMESTAMP,
    follow_up_notes TEXT,
    
    -- Medios
    attachments TEXT[],
    photos TEXT[],
    xrays TEXT[],
    videos TEXT[],
    
    -- Información adicional
    notes TEXT,
    private_notes TEXT,
    cost DECIMAL(12,2),
    currency VARCHAR(3),
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    weather_conditions VARCHAR(100),
    environmental_factors TEXT[],
    
    -- Auditoría
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para health_records
CREATE INDEX idx_health_records_bovine_id ON health_records(bovine_id);
CREATE INDEX idx_health_records_record_type ON health_records(record_type);
CREATE INDEX idx_health_records_record_date ON health_records(record_date);
CREATE INDEX idx_health_records_veterinarian_id ON health_records(veterinarian_id);
CREATE INDEX idx_health_records_is_active ON health_records(is_active);
CREATE INDEX idx_health_records_location_gin ON health_records USING gin(location);

-- ============================================================================
-- TABLA PRODUCTION
-- ============================================================================

CREATE TABLE production (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_code VARCHAR(50) UNIQUE NOT NULL,
    production_type production_type NOT NULL,
    bovine_id UUID NOT NULL REFERENCES bovines(id),
    production_date DATE NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    status production_status NOT NULL DEFAULT 'PENDING',
    quality_grade quality_grade,
    
    -- Información específica por tipo (JSONB)
    location JSONB,
    milk_info JSONB,
    meat_info JSONB,
    breeding_info JSONB,
    quality_metrics JSONB,
    market_info JSONB,
    economic_analysis JSONB,
    
    -- Información de producción
    batch_number VARCHAR(50),
    production_shift VARCHAR(20),
    weather JSONB,
    equipment_used TEXT[],
    personnel_involved TEXT[],
    supervisor_id UUID REFERENCES users(id),
    inspection_results TEXT,
    certifications TEXT[],
    traceability_code VARCHAR(100) UNIQUE,
    
    -- Información de procesamiento
    storage_info JSONB,
    processing_info JSONB,
    packaging JSONB,
    distribution_info JSONB,
    rejection_info JSONB,
    compliance JSONB,
    sustainability_metrics JSONB,
    
    -- Medios
    images TEXT[],
    documents TEXT[],
    videos TEXT[],
    
    -- Campos adicionales
    notes TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_date TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    farm_id UUID REFERENCES ranches(id),
    season_id UUID,
    
    -- Auditoría
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para production
CREATE INDEX idx_production_bovine_id ON production(bovine_id);
CREATE INDEX idx_production_production_type ON production(production_type);
CREATE INDEX idx_production_production_date ON production(production_date);
CREATE INDEX idx_production_status ON production(status);
CREATE INDEX idx_production_is_active ON production(is_active);
CREATE INDEX idx_production_location_gin ON production USING gin(location);

-- ============================================================================
-- TABLA REPRODUCTION
-- ============================================================================

CREATE TABLE reproduction (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reproduction_code VARCHAR(50) UNIQUE NOT NULL,
    bovine_id UUID NOT NULL REFERENCES bovines(id),
    reproduction_type reproduction_type NOT NULL,
    status service_status NOT NULL,
    breeding_season_id UUID,
    
    -- Información de reproducción (JSONB)
    sire_info JSONB NOT NULL,
    germplasm_info JSONB,
    heat_info JSONB,
    service_info JSONB NOT NULL,
    pregnancy_info JSONB,
    calving_info JSONB,
    calf_info JSONB,
    weaning_info JSONB,
    reproductive_efficiency JSONB,
    economic_analysis JSONB,
    genetic_analysis JSONB,
    health_records JSONB,
    
    -- Medios
    images TEXT[],
    documents TEXT[],
    videos TEXT[],
    
    -- Campos adicionales
    notes TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    is_successful BOOLEAN NOT NULL DEFAULT false,
    quality_score DECIMAL(5,2),
    ranch_id UUID REFERENCES ranches(id),
    season_year INTEGER,
    
    -- Relaciones familiares
    sire_id UUID REFERENCES bovines(id),
    offspring_id UUID REFERENCES bovines(id),
    
    -- Auditoría
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para reproduction
CREATE INDEX idx_reproduction_bovine_id ON reproduction(bovine_id);
CREATE INDEX idx_reproduction_reproduction_type ON reproduction(reproduction_type);
CREATE INDEX idx_reproduction_status ON reproduction(status);
CREATE INDEX idx_reproduction_sire_id ON reproduction(sire_id);
CREATE INDEX idx_reproduction_offspring_id ON reproduction(offspring_id);
CREATE INDEX idx_reproduction_is_active ON reproduction(is_active);

-- ============================================================================
-- TABLA EVENTS
-- ============================================================================

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bovine_id UUID NOT NULL REFERENCES bovines(id),
    event_type event_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status event_status NOT NULL DEFAULT 'SCHEDULED',
    priority event_priority NOT NULL DEFAULT 'MEDIUM',
    scheduled_date TIMESTAMP NOT NULL,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    
    -- Información del evento
    location JSONB NOT NULL,
    performed_by UUID REFERENCES users(id),
    veterinarian_id UUID REFERENCES users(id),
    cost DECIMAL(12,2),
    currency VARCHAR(3),
    event_data JSONB,
    recurrence JSONB,
    notifications JSONB,
    
    -- Medios
    attachments TEXT[],
    photos TEXT[],
    
    -- Resultados y seguimiento
    results TEXT,
    complications TEXT,
    follow_up_required BOOLEAN NOT NULL DEFAULT false,
    follow_up_date TIMESTAMP,
    follow_up_notes TEXT,
    public_notes TEXT,
    private_notes TEXT,
    
    -- Condiciones ambientales
    weather_conditions VARCHAR(100),
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    
    -- Campos adicionales
    is_active BOOLEAN NOT NULL DEFAULT true,
    parent_event_id UUID REFERENCES events(id),
    
    -- Auditoría
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para events
CREATE INDEX idx_events_bovine_id ON events(bovine_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_priority ON events(priority);
CREATE INDEX idx_events_scheduled_date ON events(scheduled_date);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_veterinarian_id ON events(veterinarian_id);
CREATE INDEX idx_events_is_active ON events(is_active);
CREATE INDEX idx_events_parent_event_id ON events(parent_event_id);
CREATE INDEX idx_events_location_gin ON events USING gin(location);

-- ============================================================================
-- TABLA FINANCES
-- ============================================================================

CREATE TABLE finances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_type transaction_type NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'MXN',
    exchange_rate DECIMAL(10,6),
    base_amount DECIMAL(15,2),
    payment_method payment_method NOT NULL,
    status transaction_status NOT NULL DEFAULT 'PENDING',
    transaction_date TIMESTAMP NOT NULL,
    due_date TIMESTAMP,
    completed_date TIMESTAMP,
    
    -- Información de la transacción
    location JSONB,
    bovine_id UUID REFERENCES bovines(id),
    event_id UUID REFERENCES events(id),
    farm_id UUID REFERENCES ranches(id),
    contact_info JSONB,
    invoice_info JSONB,
    budget_info JSONB,
    amortization_info JSONB,
    financial_analysis JSONB,
    recurrence JSONB,
    
    -- Relaciones
    parent_transaction_id UUID REFERENCES finances(id),
    related_transactions UUID[],
    
    -- Medios
    attachments TEXT[],
    photos TEXT[],
    
    -- Campos adicionales
    tags TEXT[],
    notes TEXT,
    internal_notes TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_date TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    fiscal_year INTEGER,
    fiscal_period VARCHAR(20),
    cost_center VARCHAR(50),
    project VARCHAR(100),
    
    -- Auditoría
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para finances
CREATE INDEX idx_finances_transaction_type ON finances(transaction_type);
CREATE INDEX idx_finances_category ON finances(category);
CREATE INDEX idx_finances_status ON finances(status);
CREATE INDEX idx_finances_transaction_date ON finances(transaction_date);
CREATE INDEX idx_finances_due_date ON finances(due_date);
CREATE INDEX idx_finances_bovine_id ON finances(bovine_id);
CREATE INDEX idx_finances_event_id ON finances(event_id);
CREATE INDEX idx_finances_farm_id ON finances(farm_id);
CREATE INDEX idx_finances_created_by ON finances(created_by);
CREATE INDEX idx_finances_currency ON finances(currency);
CREATE INDEX idx_finances_is_approved ON finances(is_approved);
CREATE INDEX idx_finances_is_recurring ON finances(is_recurring);
CREATE INDEX idx_finances_fiscal_year ON finances(fiscal_year);
CREATE INDEX idx_finances_location_gin ON finances USING gin(location);

-- ============================================================================
-- TABLA INVENTORY
-- ============================================================================

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    description TEXT,
    category inventory_category NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    barcode VARCHAR(50) UNIQUE,
    qr_code VARCHAR(200) UNIQUE,
    
    -- Control de stock
    current_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
    reserved_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
    available_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
    minimum_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
    maximum_stock DECIMAL(12,3),
    reorder_point DECIMAL(12,3) NOT NULL DEFAULT 0,
    reorder_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    unit_of_measure unit_of_measure NOT NULL,
    
    -- Información financiera
    unit_cost DECIMAL(12,4) NOT NULL,
    total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'MXN',
    status stock_status NOT NULL DEFAULT 'IN_STOCK',
    
    -- Almacenamiento
    storage_location VARCHAR(100) NOT NULL,
    storage_condition storage_condition NOT NULL DEFAULT 'AMBIENT',
    location JSONB,
    
    -- Información del proveedor
    supplier_info JSONB,
    purchase_date TIMESTAMP,
    expiration_date TIMESTAMP,
    manufacturing_date TIMESTAMP,
    batch_number VARCHAR(50),
    serial_numbers TEXT[],
    
    -- Información específica (JSONB)
    nutritional_info JSONB,
    medication_info JSONB,
    technical_specs JSONB,
    quality_control JSONB,
    
    -- Medios
    images TEXT[],
    documents TEXT[],
    
    -- Campos adicionales
    tags TEXT[],
    notes TEXT,
    last_inventory_date TIMESTAMP,
    last_movement_date TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    track_serial BOOLEAN NOT NULL DEFAULT false,
    track_expiration BOOLEAN NOT NULL DEFAULT false,
    track_batch BOOLEAN NOT NULL DEFAULT false,
    allow_negative_stock BOOLEAN NOT NULL DEFAULT false,
    is_critical BOOLEAN NOT NULL DEFAULT false,
    is_hazardous BOOLEAN NOT NULL DEFAULT false,
    
    -- Condiciones de almacenamiento
    temperature_min DECIMAL(5,2),
    temperature_max DECIMAL(5,2),
    humidity_min DECIMAL(5,2),
    humidity_max DECIMAL(5,2),
    
    -- Relaciones
    ranch_id UUID REFERENCES ranches(id),
    medication_id UUID,
    warehouse_id UUID,
    
    -- Auditoría
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para inventory
CREATE UNIQUE INDEX idx_inventory_item_code ON inventory(item_code);
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_is_active ON inventory(is_active);
CREATE INDEX idx_inventory_is_critical ON inventory(is_critical);
CREATE INDEX idx_inventory_expiration_date ON inventory(expiration_date);
CREATE INDEX idx_inventory_current_stock ON inventory(current_stock);
CREATE INDEX idx_inventory_ranch_id ON inventory(ranch_id);
CREATE INDEX idx_inventory_warehouse_id ON inventory(warehouse_id);
CREATE INDEX idx_inventory_storage_location ON inventory(storage_location);
CREATE INDEX idx_inventory_location_gin ON inventory USING gin(location);

-- ============================================================================
-- TABLA LOCATIONS
-- ============================================================================

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type location_type NOT NULL,
    status location_status NOT NULL DEFAULT 'ACTIVE',
    
    -- Coordenadas geográficas
    coordinates JSONB NOT NULL,
    
    -- Información de ubicación
    address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    timezone VARCHAR(50),
    
    -- Configuración
    geofence_config JSONB,
    capacity JSONB,
    access_level access_level NOT NULL DEFAULT 'PRIVATE',
    parent_location_id UUID REFERENCES locations(id),
    related_locations UUID[],
    
    -- Información de emergencia y servicios
    emergency_info JSONB,
    services JSONB,
    weather_station_id VARCHAR(50),
    
    -- Información del terreno
    soil_type VARCHAR(100),
    elevation DECIMAL(8,2),
    slope DECIMAL(5,2),
    vegetation TEXT[],
    water_sources JSONB,
    pasture_quality VARCHAR(20),
    
    -- Inspecciones
    last_inspection_date TIMESTAMP,
    next_inspection_date TIMESTAMP,
    inspection_notes TEXT,
    
    -- Medios
    images TEXT[],
    documents TEXT[],
    videos TEXT[],
    maps TEXT[],
    
    -- Campos adicionales
    tags TEXT[],
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_monitored BOOLEAN NOT NULL DEFAULT false,
    has_alerts BOOLEAN NOT NULL DEFAULT false,
    last_alert_date TIMESTAMP,
    
    -- Relaciones
    farm_id UUID REFERENCES ranches(id),
    owner_id UUID REFERENCES users(id),
    manager_id UUID REFERENCES users(id),
    
    -- Auditoría
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para locations
CREATE UNIQUE INDEX idx_locations_location_code ON locations(location_code);
CREATE INDEX idx_locations_type ON locations(type);
CREATE INDEX idx_locations_status ON locations(status);
CREATE INDEX idx_locations_access_level ON locations(access_level);
CREATE INDEX idx_locations_is_active ON locations(is_active);
CREATE INDEX idx_locations_is_monitored ON locations(is_monitored);
CREATE INDEX idx_locations_has_alerts ON locations(has_alerts);
CREATE INDEX idx_locations_farm_id ON locations(farm_id);
CREATE INDEX idx_locations_owner_id ON locations(owner_id);
CREATE INDEX idx_locations_parent_location_id ON locations(parent_location_id);
CREATE INDEX idx_locations_next_inspection_date ON locations(next_inspection_date);
CREATE INDEX idx_locations_coordinates_gin ON locations USING gin(coordinates);

-- ============================================================================
-- TABLA MEDICATIONS
-- ============================================================================

CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_code VARCHAR(50) UNIQUE NOT NULL,
    generic_name VARCHAR(200) NOT NULL,
    brand_name VARCHAR(200),
    type medication_type NOT NULL,
    
    -- Información del medicamento
    active_ingredients JSONB NOT NULL,
    strength VARCHAR(100),
    dosage_form VARCHAR(100) NOT NULL,
    presentation VARCHAR(200) NOT NULL,
    dosage_info JSONB NOT NULL,
    pharmacological_info JSONB,
    adverse_effects JSONB,
    
    -- Períodos de retiro
    withdrawal_period INTEGER NOT NULL DEFAULT 0,
    milk_withdrawal_period INTEGER,
    
    -- Almacenamiento
    storage_requirements storage_requirement[] NOT NULL,
    storage_temperature_min DECIMAL(5,2),
    storage_temperature_max DECIMAL(5,2),
    shelf_life INTEGER NOT NULL,
    
    -- Información regulatoria y comercial
    regulatory_info JSONB NOT NULL,
    commercial_info JSONB NOT NULL,
    quality_info JSONB,
    
    -- Especies e indicaciones
    target_species TEXT[] NOT NULL,
    indications TEXT[] NOT NULL,
    contraindications TEXT[],
    
    -- Medios
    images TEXT[],
    documents TEXT[],
    safety_data_sheet VARCHAR(500),
    product_insert VARCHAR(500),
    
    -- Campos adicionales
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_controlled BOOLEAN NOT NULL DEFAULT false,
    requires_refrigeration BOOLEAN NOT NULL DEFAULT false,
    is_vaccine BOOLEAN NOT NULL DEFAULT false,
    is_antibiotic BOOLEAN NOT NULL DEFAULT false,
    is_prescription_only BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    approved_date TIMESTAMP,
    
    -- Auditoría
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Índices para medications
CREATE UNIQUE INDEX idx_medications_medication_code ON medications(medication_code);
CREATE INDEX idx_medications_generic_name ON medications(generic_name);
CREATE INDEX idx_medications_brand_name ON medications(brand_name);
CREATE INDEX idx_medications_type ON medications(type);
CREATE INDEX idx_medications_is_active ON medications(is_active);
CREATE INDEX idx_medications_is_available ON medications(is_available);
CREATE INDEX idx_medications_is_controlled ON medications(is_controlled);
CREATE INDEX idx_medications_is_vaccine ON medications(is_vaccine);
CREATE INDEX idx_medications_is_antibiotic ON medications(is_antibiotic);
CREATE INDEX idx_medications_is_prescription_only ON medications(is_prescription_only);
CREATE INDEX idx_medications_withdrawal_period ON medications(withdrawal_period);

-- ============================================================================
-- TABLA DE RELACIÓN HEALTH_MEDICATION (N:M)
-- ============================================================================

CREATE TABLE health_medication (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    health_record_id UUID NOT NULL REFERENCES health_records(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    dosage DECIMAL(10,3),
    dosage_unit VARCHAR(20),
    frequency VARCHAR(100),
    duration_days INTEGER,
    administration_route VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(health_record_id, medication_id)
);

-- Índices para health_medication
CREATE INDEX idx_health_medication_health_record_id ON health_medication(health_record_id);
CREATE INDEX idx_health_medication_medication_id ON health_medication(medication_id);

-- ============================================================================
-- TRIGGERS PARA ACTUALIZAR updated_at
-- ============================================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para todas las tablas
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ranches_updated_at BEFORE UPDATE ON ranches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bovines_updated_at BEFORE UPDATE ON bovines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_records_updated_at BEFORE UPDATE ON health_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_production_updated_at BEFORE UPDATE ON production FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reproduction_updated_at BEFORE UPDATE ON reproduction FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_finances_updated_at BEFORE UPDATE ON finances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medications_updated_at BEFORE UPDATE ON medications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_medication_updated_at BEFORE UPDATE ON health_medication FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- Vista para bovinos con información completa
CREATE VIEW bovines_complete AS
SELECT 
    b.*,
    r.name as ranch_name,
    r.ranch_code,
    u.username as responsible_username,
    m.name as mother_name,
    f.name as father_name
FROM bovines b
LEFT JOIN ranches r ON b.ranch_id = r.id
LEFT JOIN users u ON b.responsible_user_id = u.id
LEFT JOIN bovines m ON b.mother_id = m.id
LEFT JOIN bovines f ON b.father_id = f.id
WHERE b.deleted_at IS NULL;

-- Vista para eventos próximos
CREATE VIEW upcoming_events AS
SELECT 
    e.*,
    b.ear_tag,
    b.name as bovine_name,
    r.name as ranch_name
FROM events e
JOIN bovines b ON e.bovine_id = b.id
LEFT JOIN ranches r ON b.ranch_id = r.id
WHERE e.scheduled_date >= CURRENT_TIMESTAMP 
    AND e.status IN ('SCHEDULED', 'IN_PROGRESS')
    AND e.deleted_at IS NULL;

-- Vista para inventario con stock bajo
CREATE VIEW low_stock_inventory AS
SELECT 
    i.*,
    r.name as ranch_name
FROM inventory i
LEFT JOIN ranches r ON i.ranch_id = r.id
WHERE i.available_stock <= i.minimum_stock
    AND i.is_active = true
    AND i.deleted_at IS NULL;

-- ============================================================================
-- COMENTARIOS EN TABLAS Y COLUMNAS
-- ============================================================================

COMMENT ON TABLE users IS 'Tabla de usuarios del sistema ganadero';
COMMENT ON TABLE ranches IS 'Tabla de ranchos/fincas ganaderas';
COMMENT ON TABLE bovines IS 'Tabla de bovinos individuales';
COMMENT ON TABLE health_records IS 'Registros médicos y de salud de bovinos';
COMMENT ON TABLE production IS 'Registros de producción (leche, carne, etc.)';
COMMENT ON TABLE reproduction IS 'Registros de reproducción y cría';
COMMENT ON TABLE events IS 'Eventos y actividades programadas';
COMMENT ON TABLE finances IS 'Transacciones financieras de la operación';
COMMENT ON TABLE inventory IS 'Inventario de la operación ganadera';
COMMENT ON TABLE locations IS 'Ubicaciones físicas y geofencing';
COMMENT ON TABLE medications IS 'Medicamentos veterinarios';
COMMENT ON TABLE health_medication IS 'Relación muchos a muchos entre registros de salud y medicamentos';

-- ============================================================================
-- FINALIZACIÓN
-- ============================================================================

-- Mensaje de finalización
DO $$
BEGIN
    RAISE NOTICE 'Esquema de base de datos del sistema ganadero creado exitosamente';
    RAISE NOTICE 'Total de tablas creadas: 12';
    RAISE NOTICE 'Total de tipos ENUM creados: 25+';
    RAISE NOTICE 'Total de índices creados: 80+';
    RAISE NOTICE 'Triggers de actualización automática configurados';
    RAISE NOTICE 'Vistas útiles creadas';
END $$;
