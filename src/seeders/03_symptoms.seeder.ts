// seeders/03_symptoms.seeder.ts
// ============================================================================
// SEEDER — CATÁLOGO DE SÍNTOMAS (42 síntomas canónicos)
// ============================================================================
// Idempotente: usa findOrCreate con slug como clave única.
// ============================================================================

import Symptom, { SymptomCategory } from '../models/Symptom';
import logger from '../utils/logger';

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function slugify(text: string): string {
  return normalize(text)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

// ── Datos ────────────────────────────────────────────────────────────────────

const SYMPTOMS: Array<{
  name: string;
  category: SymptomCategory;
  severityWeight: number;
  description?: string;
}> = [
  // ── SISTÉMICOS ────────────────────────────────────────────────────────────
  {
    name: 'Fiebre',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 0.50,
    description: 'Temperatura rectal elevada (>39.5 °C). Signo inespecífico presente en la mayoría de procesos infecciosos.',
  },
  {
    name: 'Fiebre alta',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 0.65,
    description: 'Temperatura rectal marcadamente elevada (>40.5 °C). Indica proceso infeccioso agudo o sistémico severo.',
  },
  {
    name: 'Pérdida de peso',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 0.40,
    description: 'Reducción progresiva de la condición corporal. Asociada a enfermedades crónicas o consumo reducido.',
  },
  {
    name: 'Anorexia',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 0.45,
    description: 'Rechazo total o parcial del alimento. Signo temprano de muchas enfermedades sistémicas.',
  },
  {
    name: 'Debilidad general',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 0.45,
    description: 'Postración, indiferencia al entorno y reducción marcada de la actividad. Signo de enfermedad sistémica grave.',
  },
  {
    name: 'Muerte súbita',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 1.00,
    description: 'Deceso repentino sin signos clínicos previos observables. Hallazgo en carbunco, pierna negra, clostridiosis y otros.',
  },
  {
    name: 'Hemoglobinuria',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 0.80,
    description: 'Orina de color rojo-marrón por hemoglobina libre. Indica hemólisis intravascular severa.',
  },
  {
    name: 'Ictericia',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 0.70,
    description: 'Coloración amarilla de mucosas y escleras por aumento de bilirrubina. Indica hemólisis o disfunción hepática.',
  },
  {
    name: 'Anemia',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 0.65,
    description: 'Palidez de mucosas, taquicardia y debilidad por reducción de eritrocitos o hemoglobina circulante.',
  },
  {
    name: 'Letargia',
    category: SymptomCategory.SYSTEMIC,
    severityWeight: 0.40,
    description: 'Estado de somnolencia, apatía y lentitud de respuesta a estímulos. Presente en enfermedades metabólicas y crónicas.',
  },

  // ── RESPIRATORIOS ─────────────────────────────────────────────────────────
  {
    name: 'Tos',
    category: SymptomCategory.RESPIRATORY,
    severityWeight: 0.40,
    description: 'Expulsión forzada de aire de las vías respiratorias. Signo cardinal de enfermedades respiratorias bovinas.',
  },
  {
    name: 'Disnea',
    category: SymptomCategory.RESPIRATORY,
    severityWeight: 0.70,
    description: 'Dificultad respiratoria moderada a severa. Indica compromiso pulmonar significativo.',
  },
  {
    name: 'Descarga nasal',
    category: SymptomCategory.RESPIRATORY,
    severityWeight: 0.35,
    description: 'Secreción nasal serosa, mucosa o mucopurulenta. Signo temprano de infecciones respiratorias.',
  },
  {
    name: 'Respiración laboriosa',
    category: SymptomCategory.RESPIRATORY,
    severityWeight: 0.65,
    description: 'Esfuerzo visible en cada ciclo respiratorio, uso de músculos accesorios. Indica compromiso pulmonar severo.',
  },
  {
    name: 'Estertores pulmonares',
    category: SymptomCategory.RESPIRATORY,
    severityWeight: 0.60,
    description: 'Sonidos anormales a la auscultación pulmonar (crepitantes, subcrepitantes). Indican consolidación o fluido.',
  },
  {
    name: 'Disnea grave',
    category: SymptomCategory.RESPIRATORY,
    severityWeight: 0.80,
    description: 'Insuficiencia respiratoria severa con cianosis de mucosas. Requiere atención veterinaria urgente.',
  },

  // ── DIGESTIVOS ────────────────────────────────────────────────────────────
  {
    name: 'Diarrea',
    category: SymptomCategory.DIGESTIVE,
    severityWeight: 0.50,
    description: 'Heces blandas o líquidas con aumento de frecuencia de defecación. Principal signo de enfermedades entéricas.',
  },
  {
    name: 'Diarrea hemorrágica',
    category: SymptomCategory.DIGESTIVE,
    severityWeight: 0.80,
    description: 'Heces con sangre visible (hematoquecia) o melena. Indica lesión grave de la mucosa intestinal.',
  },
  {
    name: 'Timpanismo',
    category: SymptomCategory.DIGESTIVE,
    severityWeight: 0.70,
    description: 'Distensión marcada del flanco izquierdo por acumulación de gas ruminal. Puede evolucionar a emergencia.',
  },
  {
    name: 'Salivación excesiva',
    category: SymptomCategory.DIGESTIVE,
    severityWeight: 0.50,
    description: 'Hipersalivación o ptialismo. Signo de lesiones orales o tóxicos. Patognomónico de fiebre aftosa.',
  },
  {
    name: 'Lesiones en mucosa oral',
    category: SymptomCategory.DIGESTIVE,
    severityWeight: 0.60,
    description: 'Vesículas, úlceras o erosiones en lengua, encías o paladar. Hallazgo clave en fiebre aftosa y BVD.',
  },
  {
    name: 'Vómito y regurgitación',
    category: SymptomCategory.DIGESTIVE,
    severityWeight: 0.55,
    description: 'Regurgitación del contenido ruminal. En rumiantes suele indicar obstrucción esofágica o disfunción ruminal.',
  },

  // ── REPRODUCTIVOS ─────────────────────────────────────────────────────────
  {
    name: 'Aborto',
    category: SymptomCategory.REPRODUCTIVE,
    severityWeight: 0.85,
    description: 'Expulsión del feto antes de los 260 días de gestación. Signo cardinal de brucelosis, leptospirosis, BVD y otras.',
  },
  {
    name: 'Retención de placenta',
    category: SymptomCategory.REPRODUCTIVE,
    severityWeight: 0.60,
    description: 'Fallo en la expulsión de la placenta en las 12 horas post-parto. Factor predisponente de metritis.',
  },
  {
    name: 'Descarga vaginal purulenta',
    category: SymptomCategory.REPRODUCTIVE,
    severityWeight: 0.65,
    description: 'Exudado mucopurulento o hemopurulento por vulva. Indica metritis, endometritis o proceso infeccioso uterino.',
  },
  {
    name: 'Infertilidad',
    category: SymptomCategory.REPRODUCTIVE,
    severityWeight: 0.55,
    description: 'Fallo en la concepción tras múltiples montas o inseminaciones. Asociada a brucelosis, campilobacteriosis y IBR.',
  },
  {
    name: 'Inflamación mamaria',
    category: SymptomCategory.REPRODUCTIVE,
    severityWeight: 0.60,
    description: 'Tumefacción, calor y dolor en uno o más cuartos mamarios. Signo cardinal de mastitis clínica.',
  },
  {
    name: 'Disminución de producción láctea',
    category: SymptomCategory.REPRODUCTIVE,
    severityWeight: 0.40,
    description: 'Reducción de la producción de leche. Signo temprano de mastitis, enfermedades sistémicas y trastornos metabólicos.',
  },

  // ── LOCOMOTORES ───────────────────────────────────────────────────────────
  {
    name: 'Cojera',
    category: SymptomCategory.LOCOMOTOR,
    severityWeight: 0.50,
    description: 'Claudicación de uno o más miembros. Presente en fiebre aftosa, pierna negra, laminitis y otras.',
  },
  {
    name: 'Inflamación articular',
    category: SymptomCategory.LOCOMOTOR,
    severityWeight: 0.55,
    description: 'Artritis con tumefacción, calor y dolor articular. Puede ser infecciosa o metabólica.',
  },
  {
    name: 'Rigidez muscular',
    category: SymptomCategory.LOCOMOTOR,
    severityWeight: 0.65,
    description: 'Contractura y dureza de la musculatura esquelética. Signo cardinal de tétanos e hipocalcemia.',
  },
  {
    name: 'Lesiones en pezuñas',
    category: SymptomCategory.LOCOMOTOR,
    severityWeight: 0.55,
    description: 'Vesículas, úlceras o erosiones en rodete coronario y espacio interdigital. Signo cardinal de fiebre aftosa.',
  },
  {
    name: 'Edema en extremidades',
    category: SymptomCategory.LOCOMOTOR,
    severityWeight: 0.50,
    description: 'Acumulación de líquido en tejidos de las extremidades. Presente en carbunco, pierna negra y otras.',
  },
  {
    name: 'Incapacidad para levantarse',
    category: SymptomCategory.LOCOMOTOR,
    severityWeight: 0.80,
    description: 'Postración con imposibilidad de incorporarse. Signo de hipocalcemia, tétanos y enfermedades sistémicas graves.',
  },

  // ── NEUROLÓGICOS ──────────────────────────────────────────────────────────
  {
    name: 'Convulsiones',
    category: SymptomCategory.NEUROLOGICAL,
    severityWeight: 0.80,
    description: 'Actividad motora involuntaria paroxística. Indica afectación del sistema nervioso central.',
  },
  {
    name: 'Parálisis',
    category: SymptomCategory.NEUROLOGICAL,
    severityWeight: 0.85,
    description: 'Pérdida total o parcial de la función motora voluntaria. Presente en rabia, EEB, hipocalcemia y otras.',
  },
  {
    name: 'Incoordinación',
    category: SymptomCategory.NEUROLOGICAL,
    severityWeight: 0.65,
    description: 'Ataxia y pérdida del equilibrio. Indica alteraciones del sistema nervioso central o periférico.',
  },
  {
    name: 'Cambios de comportamiento',
    category: SymptomCategory.NEUROLOGICAL,
    severityWeight: 0.60,
    description: 'Agresividad, depresión severa o comportamiento anormal. Signo cardinal de rabia y EEB.',
  },
  {
    name: 'Opistótonos',
    category: SymptomCategory.NEUROLOGICAL,
    severityWeight: 0.90,
    description: 'Hiperextensión del cuello y curvatura espinal hacia atrás. Signo patognomónico de tétanos.',
  },

  // ── DERMATOLÓGICOS ────────────────────────────────────────────────────────
  {
    name: 'Lesiones vesiculares y úlceras',
    category: SymptomCategory.DERMATOLOGICAL,
    severityWeight: 0.65,
    description: 'Ampollas y úlceras en piel o mucosas. Signo cardinal de fiebre aftosa y queratoconjuntivitis.',
  },
  {
    name: 'Alopecia',
    category: SymptomCategory.DERMATOLOGICAL,
    severityWeight: 0.30,
    description: 'Pérdida focal o difusa del pelo. Signo cardinal de dermatofitosis (tiña) y fotosensibilización.',
  },
  {
    name: 'Lesiones cutáneas',
    category: SymptomCategory.DERMATOLOGICAL,
    severityWeight: 0.40,
    description: 'Alteraciones de la piel: eritema, costras, descamación o necrosis. Presente en dermatofitosis, fotosensibilización y otras.',
  },
];

// ── Seeder ───────────────────────────────────────────────────────────────────

const CONTEXT = '03_symptoms.seeder';

export async function seedSymptoms(): Promise<void> {
  logger.info(`Iniciando seeder de síntomas (${SYMPTOMS.length} registros)`, CONTEXT);

  let created = 0;
  let skipped = 0;

  for (const s of SYMPTOMS) {
    const slug = slugify(s.name);
    const normalizedName = normalize(s.name);

    const [, wasCreated] = await Symptom.findOrCreate({
      where: { slug },
      defaults: {
        name: s.name,
        normalizedName,
        slug,
        category: s.category,
        severityWeight: s.severityWeight,
        description: s.description,
        isActive: true,
      },
    });

    if (wasCreated) created++;
    else skipped++;
  }

  logger.info(`Síntomas — creados: ${created}, ya existían: ${skipped}`, CONTEXT);
}
