"""
Genera el PDF del Contrato de API — Módulo de Enfermedades Bovinas
Ejecutar: python generate_api_contract.py
Salida:   api_contract_enfermedades.pdf (mismo directorio)
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from datetime import date

# ─────────────────────────────────────────────────────────────
# COLORES CORPORATIVOS
# ─────────────────────────────────────────────────────────────
C_PRIMARY   = colors.HexColor('#1e40af')   # azul oscuro
C_SECONDARY = colors.HexColor('#3b82f6')   # azul medio
C_SUCCESS   = colors.HexColor('#10b981')   # verde
C_WARNING   = colors.HexColor('#f59e0b')   # amarillo
C_DANGER    = colors.HexColor('#ef4444')   # rojo
C_DARK      = colors.HexColor('#1f2937')   # gris oscuro
C_MEDIUM    = colors.HexColor('#6b7280')   # gris medio
C_LIGHT     = colors.HexColor('#f3f4f6')   # gris claro
C_WHITE     = colors.white
C_CODE_BG   = colors.HexColor('#1e293b')   # fondo código oscuro
C_CODE_TEXT = colors.HexColor('#e2e8f0')   # texto código

# ─────────────────────────────────────────────────────────────
# ESTILOS
# ─────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def make_styles():
    custom = {}

    custom['Cover_Title'] = ParagraphStyle('Cover_Title',
        fontName='Helvetica-Bold', fontSize=28, textColor=C_WHITE,
        alignment=TA_CENTER, spaceAfter=8)

    custom['Cover_Sub'] = ParagraphStyle('Cover_Sub',
        fontName='Helvetica', fontSize=14, textColor=colors.HexColor('#bfdbfe'),
        alignment=TA_CENTER, spaceAfter=4)

    custom['Cover_Meta'] = ParagraphStyle('Cover_Meta',
        fontName='Helvetica', fontSize=10, textColor=colors.HexColor('#93c5fd'),
        alignment=TA_CENTER, spaceAfter=2)

    custom['H1'] = ParagraphStyle('H1',
        fontName='Helvetica-Bold', fontSize=16, textColor=C_PRIMARY,
        spaceBefore=18, spaceAfter=6, borderPad=0)

    custom['H2'] = ParagraphStyle('H2',
        fontName='Helvetica-Bold', fontSize=12, textColor=C_PRIMARY,
        spaceBefore=14, spaceAfter=4)

    custom['H3'] = ParagraphStyle('H3',
        fontName='Helvetica-Bold', fontSize=10, textColor=C_DARK,
        spaceBefore=10, spaceAfter=3)

    custom['Body'] = ParagraphStyle('Body',
        fontName='Helvetica', fontSize=9, textColor=C_DARK,
        leading=14, spaceAfter=4)

    custom['BodySmall'] = ParagraphStyle('BodySmall',
        fontName='Helvetica', fontSize=8, textColor=C_MEDIUM,
        leading=12, spaceAfter=3)

    custom['Code'] = ParagraphStyle('Code',
        fontName='Courier', fontSize=8, textColor=C_CODE_TEXT,
        backColor=C_CODE_BG, leading=13,
        leftIndent=8, rightIndent=8,
        spaceBefore=2, spaceAfter=2,
        borderPad=6)

    custom['CodeInline'] = ParagraphStyle('CodeInline',
        fontName='Courier-Bold', fontSize=8, textColor=C_PRIMARY)

    custom['Note'] = ParagraphStyle('Note',
        fontName='Helvetica-Oblique', fontSize=8, textColor=C_MEDIUM,
        leading=12, spaceAfter=4, leftIndent=12)

    custom['Badge_GET']   = ParagraphStyle('Badge_GET',
        fontName='Helvetica-Bold', fontSize=8, textColor=C_WHITE,
        backColor=C_SUCCESS, alignment=TA_CENTER)

    custom['Badge_POST']  = ParagraphStyle('Badge_POST',
        fontName='Helvetica-Bold', fontSize=8, textColor=C_WHITE,
        backColor=C_SECONDARY, alignment=TA_CENTER)

    custom['Badge_PATCH'] = ParagraphStyle('Badge_PATCH',
        fontName='Helvetica-Bold', fontSize=8, textColor=C_WHITE,
        backColor=C_WARNING, alignment=TA_CENTER)

    custom['TOC_Entry'] = ParagraphStyle('TOC_Entry',
        fontName='Helvetica', fontSize=9, textColor=C_DARK,
        leading=16, leftIndent=12)

    custom['TOC_Section'] = ParagraphStyle('TOC_Section',
        fontName='Helvetica-Bold', fontSize=10, textColor=C_PRIMARY,
        leading=18, spaceBefore=4)

    return custom

S = make_styles()

# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def hr(color=C_SECONDARY, thickness=0.5):
    return HRFlowable(width='100%', thickness=thickness, color=color, spaceAfter=6, spaceBefore=2)

def spacer(h=0.3):
    return Spacer(1, h * cm)

def h1(text):
    return Paragraph(text, S['H1'])

def h2(text):
    return Paragraph(text, S['H2'])

def h3(text):
    return Paragraph(text, S['H3'])

def body(text):
    return Paragraph(text, S['Body'])

def note(text):
    return Paragraph(f'ℹ️  {text}', S['Note'])

def code(text):
    # Escape HTML chars for ReportLab
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return Paragraph(text, S['Code'])

def method_badge(method):
    color_map = {
        'GET':   C_SUCCESS,
        'POST':  C_SECONDARY,
        'PATCH': C_WARNING,
        'PUT':   colors.HexColor('#8b5cf6'),
        'DELETE':C_DANGER,
    }
    c = color_map.get(method, C_MEDIUM)
    return Table([[Paragraph(f'<b>{method}</b>', ParagraphStyle('mb',
        fontName='Helvetica-Bold', fontSize=8, textColor=C_WHITE, alignment=TA_CENTER))]],
        colWidths=[1.2*cm],
        style=TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), c),
            ('ROWPADDING', (0,0), (-1,-1), 3),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ])
    )

def endpoint_row(method, path, description):
    """Fila de endpoint: [BADGE | PATH | descripción]"""
    return Table([
        [
            method_badge(method),
            Paragraph(f'<font name="Courier-Bold" size="8">{path}</font>', S['Body']),
            Paragraph(description, S['BodySmall']),
        ]
    ], colWidths=[1.3*cm, 8*cm, 7.4*cm],
    style=TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (1,0), (1,0), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, colors.HexColor('#e5e7eb')),
    ]))

def field_table(rows, col_widths=None):
    """Tabla de campos: [Campo | Tipo | Req | Descripción]"""
    header = [
        Paragraph('<b>Campo</b>', S['BodySmall']),
        Paragraph('<b>Tipo</b>', S['BodySmall']),
        Paragraph('<b>Req</b>', S['BodySmall']),
        Paragraph('<b>Descripción</b>', S['BodySmall']),
    ]
    data = [header] + [
        [Paragraph(f'<font name="Courier" size="8">{r[0]}</font>', S['Body']),
         Paragraph(f'<font name="Courier" size="8" color="#6b7280">{r[1]}</font>', S['Body']),
         Paragraph('✓' if r[2] else '—', S['Body']),
         Paragraph(r[3], S['BodySmall'])]
        for r in rows
    ]
    cw = col_widths or [3.5*cm, 2.5*cm, 1.2*cm, 9.5*cm]
    t = Table(data, colWidths=cw)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), C_WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [C_WHITE, C_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#d1d5db')),
        ('ROWPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    return t

def enum_table(title, values):
    """Tabla de valores ENUM"""
    data = [[Paragraph(f'<b>{title}</b>', S['BodySmall'])]]
    row = []
    for v in values:
        row.append(Paragraph(f'<font name="Courier" size="8">{v}</font>', S['BodySmall']))
        if len(row) == 4:
            data.append(row)
            row = []
    if row:
        while len(row) < 4:
            row.append(Paragraph('', S['BodySmall']))
        data.append(row)

    t = Table(data, colWidths=[4.2*cm]*4 if len(data[0]) == 4 else [16.8*cm])
    t.setStyle(TableStyle([
        ('SPAN', (0,0), (-1,0)),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#dbeafe')),
        ('TEXTCOLOR', (0,0), (-1,0), C_PRIMARY),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [C_LIGHT, C_WHITE]),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#bfdbfe')),
        ('ROWPADDING', (0,0), (-1,-1), 4),
    ]))
    return t

def section_banner(text):
    """Banner azul de sección principal"""
    t = Table([[Paragraph(f'<b>{text}</b>', ParagraphStyle('sb',
        fontName='Helvetica-Bold', fontSize=12, textColor=C_WHITE))]],
        colWidths=[16.8*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_PRIMARY),
        ('ROWPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
    ]))
    return t

# ─────────────────────────────────────────────────────────────
# PORTADA
# ─────────────────────────────────────────────────────────────
def build_cover():
    story = []

    # Bloque de color de fondo simulado con tabla
    cover_content = [
        [Paragraph('BOVINO MANAGER', S['Cover_Meta'])],
        [Paragraph('Contrato de API', S['Cover_Title'])],
        [Paragraph('Módulo de Enfermedades y Casos Clínicos', S['Cover_Sub'])],
        [Spacer(1, 0.4*cm)],
        [Paragraph('Versión 1.0  ·  Fase 1 y Fase 2', S['Cover_Meta'])],
        [Paragraph(f'Fecha: {date.today().strftime("%d de %B de %Y")}', S['Cover_Meta'])],
        [Spacer(1, 0.8*cm)],
        [Paragraph('Documento técnico para integración Frontend ↔ Backend', S['Cover_Meta'])],
        [Paragraph('Confidencial — uso interno del equipo de desarrollo', S['Cover_Meta'])],
    ]

    cover_table = Table(cover_content, colWidths=[16.8*cm])
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_PRIMARY),
        ('ROWPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (0,0), 60),
        ('BOTTOMPADDING', (0,8), (0,8), 60),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(cover_table)
    story.append(spacer(1))

    # Recuadro de info rápida
    info = Table([
        [Paragraph('<b>Base URL</b>', S['BodySmall']),
         Paragraph('<font name="Courier" size="9">https://api.bovinomanager.com/api</font>', S['Body'])],
        [Paragraph('<b>Autenticación</b>', S['BodySmall']),
         Paragraph('Bearer Token (JWT) en header <font name="Courier" size="8">Authorization</font>', S['Body'])],
        [Paragraph('<b>Formato</b>', S['BodySmall']),
         Paragraph('JSON · Content-Type: application/json', S['Body'])],
        [Paragraph('<b>Versión API</b>', S['BodySmall']),
         Paragraph('v1 · No se usa prefijo /v1 en las rutas actuales', S['Body'])],
        [Paragraph('<b>Fases cubiertas</b>', S['BodySmall']),
         Paragraph('Fase 1: Catálogos   ·   Fase 2: Casos de enfermedad', S['Body'])],
    ], colWidths=[3.5*cm, 13.3*cm])
    info.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#d1d5db')),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [C_LIGHT, C_WHITE]),
        ('ROWPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(info)
    story.append(PageBreak())
    return story

# ─────────────────────────────────────────────────────────────
# TABLA DE CONTENIDOS
# ─────────────────────────────────────────────────────────────
def build_toc():
    story = [h1('Tabla de Contenidos'), hr()]
    toc = [
        ('1.', 'Formato de Respuesta Estándar'),
        ('2.', 'Códigos de Error'),
        ('3.', 'Referencia de ENUMs'),
        ('4.', 'FASE 1 — Catálogo de Enfermedades'),
        ('', '4.1  GET /api/diseases — Listar enfermedades'),
        ('', '4.2  GET /api/diseases/search — Autocomplete'),
        ('', '4.3  GET /api/diseases/:slug — Detalle'),
        ('', '4.4  GET /api/bovines/filters/options — Actualización'),
        ('5.', 'FASE 2 — Casos de Enfermedad'),
        ('', '5.1  POST /api/bovines/:id/disease-cases — Crear caso'),
        ('', '5.2  GET  /api/bovines/:id/disease-cases — Listar casos'),
        ('', '5.3  GET  /api/bovines/:id/disease-cases/active — Caso activo'),
        ('', '5.4  GET  /api/bovines/:id/disease-cases/:caseId — Detalle'),
        ('', '5.5  PATCH .../status — Cambiar estado'),
        ('', '5.6  POST  .../symptoms — Agregar síntoma'),
        ('', '5.7  POST  .../treatments — Agregar tratamiento'),
        ('', '5.8  POST  .../lab-tests — Agregar lab test'),
        ('', '5.9  PATCH .../lab-tests/:testId/result — Resultado lab'),
        ('6.', 'Endpoints Existentes Actualizados'),
        ('', '6.1  GET /api/bovines — Nuevo filtro diseaseId'),
        ('', '6.2  GET /api/bovines/:id/full — Nuevo campo activeCase'),
        ('', '6.3  GET /api/bovines/geo/map-markers — Nuevo filtro diseaseId'),
        ('7.', 'Reglas de Negocio para el Frontend'),
        ('8.', 'Badges y Colores por Severidad'),
    ]
    for num, title in toc:
        style = S['TOC_Section'] if num else S['TOC_Entry']
        indent = '' if num else '&nbsp;&nbsp;&nbsp;&nbsp;'
        story.append(Paragraph(f'{indent}<b>{num}</b> {title}' if num else f'{indent}{title}', style))
    story.append(PageBreak())
    return story

# ─────────────────────────────────────────────────────────────
# SECCIÓN 1: FORMATO ESTÁNDAR
# ─────────────────────────────────────────────────────────────
def build_response_format():
    story = [section_banner('1. Formato de Respuesta Estándar'), spacer(0.3)]

    story += [
        body('Todos los endpoints devuelven JSON con la siguiente estructura:'),
        spacer(0.2),
        code('{\n  "success": true | false,\n  "data": { ... }            // presente si success = true\n  "error": "Mensaje",        // presente si success = false\n  "message": "Info extra"    // opcional\n}'),
        spacer(0.2),
        body('Las listas paginadas incluyen el objeto <font name="Courier" size="8">pagination</font>:'),
        spacer(0.2),
        code('{\n  "success": true,\n  "data": {\n    "items": [...],\n    "pagination": {\n      "page": 1,\n      "limit": 20,\n      "total": 150,\n      "totalPages": 8,\n      "hasNext": true,\n      "hasPrev": false\n    }\n  }\n}'),
        spacer(0.4),
    ]
    return story

# ─────────────────────────────────────────────────────────────
# SECCIÓN 2: CÓDIGOS DE ERROR
# ─────────────────────────────────────────────────────────────
def build_error_codes():
    story = [section_banner('2. Códigos de Error'), spacer(0.3)]

    errors = [
        ('400', 'Bad Request', 'Parámetros inválidos o faltantes en la request'),
        ('401', 'Unauthorized', 'Token JWT ausente, expirado o inválido'),
        ('403', 'Forbidden', 'El usuario no tiene permisos sobre este recurso'),
        ('404', 'Not Found', 'El recurso solicitado no existe'),
        ('409', 'Conflict', 'Regla de negocio violada (ej: caso activo duplicado)'),
        ('422', 'Unprocessable', 'Validación fallida con detalle de campos'),
        ('500', 'Server Error', 'Error interno — reportar al equipo backend'),
    ]
    header = [
        Paragraph('<b>HTTP</b>', S['BodySmall']),
        Paragraph('<b>Nombre</b>', S['BodySmall']),
        Paragraph('<b>Cuándo ocurre</b>', S['BodySmall']),
    ]
    data = [header] + [
        [Paragraph(f'<b><font color="#ef4444">{e[0]}</font></b>', S['Body']),
         Paragraph(e[1], S['Body']),
         Paragraph(e[2], S['BodySmall'])]
        for e in errors
    ]
    t = Table(data, colWidths=[1.5*cm, 3.5*cm, 11.8*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), C_WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [C_WHITE, C_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#d1d5db')),
        ('ROWPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)
    story.append(spacer(0.3))

    story.append(body('Estructura del error de validación (422):'))
    story.append(code('{\n  "success": false,\n  "error": "Validation failed",\n  "details": [\n    { "field": "severity", "message": "Valor no permitido" },\n    { "field": "detectedAt", "message": "No puede ser fecha futura" }\n  ]\n}'))
    story.append(spacer(0.4))
    return story

# ─────────────────────────────────────────────────────────────
# SECCIÓN 3: ENUMs
# ─────────────────────────────────────────────────────────────
def build_enums():
    story = [section_banner('3. Referencia de ENUMs'), spacer(0.3)]

    enums = [
        ('DiseaseCategory', ['BACTERIAL', 'VIRAL', 'PARASITIC', 'FUNGAL', 'METABOLIC', 'GENETIC', 'OTHER']),
        ('DiseaseSeverity / CaseSeverity', ['LOW', 'MODERATE', 'HIGH', 'CRITICAL']),
        ('CaseStatus', ['SUSPECTED', 'CONFIRMED', 'RECOVERED', 'DECEASED', 'DISCARDED']),
        ('CaseOutcome', ['RECOVERED', 'DECEASED', 'DISCARDED', 'ONGOING']),
        ('SymptomSeverity', ['MILD', 'MODERATE', 'SEVERE']),
        ('TreatmentType', ['MEDICATION', 'PROCEDURE', 'SURGERY', 'ISOLATION', 'SUPPORTIVE', 'OTHER']),
        ('TreatmentStatus', ['PRESCRIBED', 'IN_PROGRESS', 'COMPLETED', 'SUSPENDED']),
        ('TreatmentResponse', ['POSITIVE', 'NEGATIVE', 'PARTIAL', 'PENDING']),
        ('LabTestType', ['PCR', 'ELISA', 'CULTURE', 'BRUCELLOSIS_RING', 'TUBERCULIN', 'BLOOD_SMEAR', 'BIOPSY', 'OTHER']),
        ('LabSampleType', ['BLOOD', 'MILK', 'URINE', 'FECES', 'TISSUE', 'NASAL_SWAB', 'OTHER']),
        ('LabResultStatus', ['PENDING', 'POSITIVE', 'NEGATIVE', 'INCONCLUSIVE', 'CANCELLED']),
        ('TransmissionLikelihood', ['PRIMARY', 'SECONDARY', 'OCCASIONAL']),
        ('ContagionRisk', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        ('AffectedSystem', ['respiratory', 'digestive', 'reproductive', 'locomotor', 'neurological', 'dermatological', 'mammary', 'systemic', 'hepatic', 'cardiovascular']),
    ]

    for name, values in enums:
        story.append(enum_table(name, values))
        story.append(spacer(0.2))

    story.append(spacer(0.2))

    story.append(body('<b>Transiciones de estado válidas para CaseStatus:</b>'))
    story.append(code(
        'SUSPECTED  -->  CONFIRMED   (diagnóstico confirmado por vet o lab test)\n'
        'SUSPECTED  -->  DISCARDED   (caso descartado)\n'
        'CONFIRMED  -->  RECOVERED   (bovino se recupera)\n'
        'CONFIRMED  -->  DECEASED    (bovino fallece)\n'
        'CONFIRMED  -->  DISCARDED   (con nota obligatoria)\n\n'
        'NO permitido: RECOVERED --> CONFIRMED  (crear nuevo caso en su lugar)'
    ))
    story.append(PageBreak())
    return story

# ─────────────────────────────────────────────────────────────
# SECCIÓN 4: FASE 1 — CATÁLOGOS
# ─────────────────────────────────────────────────────────────
def build_phase1():
    story = [section_banner('4. FASE 1 — Catálogo de Enfermedades'), spacer(0.4)]

    # 4.1
    story += [
        h2('4.1  GET /api/diseases — Listar enfermedades'),
        endpoint_row('GET', '/api/diseases', 'Devuelve catálogo completo con filtros opcionales'),
        spacer(0.2),
        h3('Query Parameters'),
        field_table([
            ('category',     'DiseaseCategory', False, 'Filtrar por categoría: BACTERIAL, VIRAL, etc.'),
            ('isContagious', 'boolean',         False, '"true" | "false"'),
            ('isZoonotic',   'boolean',         False, '"true" | "false"'),
            ('isActive',     'boolean',         False, 'Default: true. Usar false para ver desactivadas'),
        ], [3.5*cm, 3*cm, 1.2*cm, 9*cm]),
        spacer(0.2),
        h3('Respuesta 200'),
        code(
            '{\n'
            '  "success": true,\n'
            '  "data": [\n'
            '    {\n'
            '      "id": "uuid",\n'
            '      "name": "Mastitis Bovina",\n'
            '      "slug": "mastitis-bovina",\n'
            '      "category": "BACTERIAL",\n'
            '      "severity": "HIGH",\n'
            '      "isContagious": false,\n'
            '      "isZoonotic": false,\n'
            '      "defaultQuarantineDays": null,\n'
            '      "incubationDaysMin": 2,\n'
            '      "incubationDaysMax": 7,\n'
            '      "affectedSystems": ["mammary"],\n'
            '      "isActive": true\n'
            '    }\n'
            '  ]\n'
            '}'
        ),
        spacer(0.4),
    ]

    # 4.2
    story += [
        h2('4.2  GET /api/diseases/search — Autocomplete tolerante'),
        endpoint_row('GET', '/api/diseases/search?q=mastit', 'Busca en nombre canónico y aliases. Tolerante a errores ortográficos.'),
        spacer(0.2),
        h3('Query Parameters'),
        field_table([
            ('q',      'string',  True,  'Término de búsqueda (mínimo 2 caracteres)'),
            ('limit',  'integer', False, 'Máximo de resultados. Default: 10, max: 20'),
        ], [3.5*cm, 3*cm, 1.2*cm, 9*cm]),
        spacer(0.2),
        h3('Respuesta 200'),
        code(
            '{\n'
            '  "success": true,\n'
            '  "data": [\n'
            '    {\n'
            '      "id": "uuid",\n'
            '      "name": "Mastitis Bovina",\n'
            '      "slug": "mastitis-bovina",\n'
            '      "severity": "HIGH",\n'
            '      "category": "BACTERIAL",\n'
            '      "matchedAlias": "mastitis"   // presente si el match fue por alias\n'
            '    }\n'
            '  ]\n'
            '}'
        ),
        note('El campo matchedAlias permite mostrar al usuario "¿Quisiste decir Mastitis Bovina?" cuando el término buscado es un alias o variante ortográfica.'),
        spacer(0.4),
    ]

    # 4.3
    story += [
        h2('4.3  GET /api/diseases/:slug — Detalle completo'),
        endpoint_row('GET', '/api/diseases/:slug', 'Detalle de una enfermedad con síntomas típicos y vías de transmisión.'),
        spacer(0.2),
        h3('Respuesta 200'),
        code(
            '{\n'
            '  "success": true,\n'
            '  "data": {\n'
            '    "id": "uuid",\n'
            '    "name": "Brucelosis Bovina",\n'
            '    "slug": "brucelosis-bovina",\n'
            '    "description": "Enfermedad bacteriana causada por Brucella abortus...",\n'
            '    "category": "BACTERIAL",\n'
            '    "severity": "CRITICAL",\n'
            '    "isContagious": true,\n'
            '    "isZoonotic": true,\n'
            '    "defaultQuarantineDays": 30,\n'
            '    "incubationDaysMin": 14,\n'
            '    "incubationDaysMax": 60,\n'
            '    "recommendedAction": "Notificar a autoridad sanitaria inmediatamente",\n'
            '    "affectedSystems": ["reproductive", "systemic"],\n'
            '    "symptoms": [\n'
            '      { "id": "uuid", "name": "Aborto", "relevance": "PATHOGNOMONIC", "isCommon": true },\n'
            '      { "id": "uuid", "name": "Fiebre", "relevance": "COMMON", "isCommon": true }\n'
            '    ],\n'
            '    "transmissionMethods": [\n'
            '      { "name": "Contacto con secreciones", "likelihood": "PRIMARY" },\n'
            '      { "name": "Agua contaminada", "likelihood": "SECONDARY" }\n'
            '    ]\n'
            '  }\n'
            '}'
        ),
        spacer(0.4),
    ]

    # 4.4
    story += [
        h2('4.4  GET /api/bovines/filters/options — Campo diseases actualizado'),
        endpoint_row('GET', '/api/bovines/filters/options', 'El campo diseases ahora devuelve objetos del catálogo en lugar de strings.'),
        spacer(0.2),
        h3('Campo diseases en la respuesta (ANTES vs AHORA)'),
        code(
            '// ANTES (texto libre)\n'
            '"diseases": ["mastitis", "Mastitis Bov.", "mastitis bovina"]\n\n'
            '// AHORA (catálogo normalizado)\n'
            '"diseases": [\n'
            '  { "id": "uuid", "name": "Mastitis Bovina", "slug": "mastitis-bovina",\n'
            '    "severity": "HIGH", "isContagious": false }\n'
            ']'
        ),
        note('El resto del objeto filters/options no cambia en esta fase.'),
        spacer(0.4),
        PageBreak(),
    ]
    return story

# ─────────────────────────────────────────────────────────────
# SECCIÓN 5: FASE 2 — CASOS
# ─────────────────────────────────────────────────────────────
def build_phase2():
    story = [section_banner('5. FASE 2 — Casos de Enfermedad'), spacer(0.4)]

    # 5.1 Crear caso
    story += [
        h2('5.1  POST /api/bovines/:id/disease-cases — Crear caso'),
        endpoint_row('POST', '/api/bovines/:id/disease-cases', 'Registra un nuevo caso de enfermedad para el bovino.'),
        spacer(0.2),
        h3('Body (JSON)'),
        field_table([
            ('diseaseId',      'UUID',             True,  'ID de la enfermedad del catálogo'),
            ('detectedAt',     'ISO datetime',     True,  'Cuándo se detectaron los primeros síntomas. No puede ser futuro.'),
            ('severity',       'CaseSeverity',     True,  'LOW | MODERATE | HIGH | CRITICAL'),
            ('status',         'CaseStatus',       False, 'Default: SUSPECTED'),
            ('locationId',     'UUID',             False, 'Potrero donde se detectó. Si omite, se resuelve automáticamente del stay activo.'),
            ('sourceId',       'UUID',             False, 'ID del catálogo disease_sources'),
            ('suspectedSource','string',           False, 'Texto libre si la fuente no está en catálogo (max 300 chars)'),
            ('contagionRisk',  'ContagionRisk',    False, 'Obligatorio si enfermedad es isContagious=true'),
            ('notes',          'string',           False, 'Observaciones adicionales (max 1000 chars)'),
            ('healthRecordId', 'UUID',             False, 'Health record asociado a este caso'),
        ]),
        spacer(0.2),
        h3('Respuesta 201'),
        code(
            '{\n'
            '  "success": true,\n'
            '  "data": {\n'
            '    "id": "uuid",\n'
            '    "bovineId": "uuid",\n'
            '    "disease": { "id", "name", "slug", "severity", "isContagious", "isZoonotic",\n'
            '                 "defaultQuarantineDays" },\n'
            '    "status": "SUSPECTED",\n'
            '    "severity": "HIGH",\n'
            '    "detectedAt": "2026-05-22T10:00:00Z",\n'
            '    "locationId": "uuid",\n'
            '    "contagionRisk": null,\n'
            '    "isConfirmed": false,\n'
            '    "quarantineStarted": false,\n'
            '    "quarantineRecommended": true,   // true si isContagious=true\n'
            '    "suggestedQuarantineDays": 30,   // de defaultQuarantineDays\n'
            '    "notes": null,\n'
            '    "createdAt": "2026-05-22T10:05:00Z"\n'
            '  }\n'
            '}'
        ),
        note('Error 409: si ya existe un caso SUSPECTED o CONFIRMED del mismo bovino con la misma enfermedad.'),
        spacer(0.4),
    ]

    # 5.2 Listar casos
    story += [
        h2('5.2  GET /api/bovines/:id/disease-cases — Historial de casos'),
        endpoint_row('GET', '/api/bovines/:id/disease-cases', 'Lista todos los casos del bovino con filtros opcionales.'),
        spacer(0.2),
        h3('Query Parameters'),
        field_table([
            ('status',  'CaseStatus',  False, 'Filtrar por estado'),
            ('page',    'integer',     False, 'Default: 1'),
            ('limit',   'integer',     False, 'Default: 10'),
        ], [3.5*cm, 3*cm, 1.2*cm, 9*cm]),
        spacer(0.2),
        h3('Respuesta 200 — Array paginado de BovineDiseaseeCaseResponseDTO'),
        code(
            '"data": {\n'
            '  "items": [\n'
            '    {\n'
            '      "id": "uuid",\n'
            '      "disease": { "name", "slug", "severity", "isContagious" },\n'
            '      "status": "CONFIRMED",\n'
            '      "severity": "HIGH",\n'
            '      "isConfirmed": true,\n'
            '      "detectedAt": "...",\n'
            '      "confirmedAt": "...",\n'
            '      "resolvedAt": null,\n'
            '      "outcome": "ONGOING"\n'
            '    }\n'
            '  ],\n'
            '  "pagination": { ... }\n'
            '}'
        ),
        spacer(0.4),
    ]

    # 5.3 Caso activo
    story += [
        h2('5.3  GET /api/bovines/:id/disease-cases/active — Caso activo actual'),
        endpoint_row('GET', '/api/bovines/:id/disease-cases/active', 'Devuelve el caso activo (SUSPECTED o CONFIRMED) del bovino. 404 si no hay ninguno.'),
        spacer(0.2),
        h3('Respuesta 200 — BovineDiseaseeCaseDetailDTO'),
        code(
            '{\n'
            '  "success": true,\n'
            '  "data": {\n'
            '    "id": "uuid",\n'
            '    "disease": { "id", "name", "slug", "severity", "isContagious",\n'
            '                 "isZoonotic", "defaultQuarantineDays" },\n'
            '    "status": "CONFIRMED",\n'
            '    "severity": "CRITICAL",\n'
            '    "isConfirmed": true,\n'
            '    "detectedAt": "...",\n'
            '    "diagnosedAt": "...",\n'
            '    "confirmedAt": "...",\n'
            '    "contagionRisk": "HIGH",\n'
            '    "quarantineStarted": true,\n'
            '    "symptoms": [\n'
            '      { "id": "uuid", "symptom": { "name", "category" },\n'
            '        "severity": "SEVERE", "observedAt": "..." }\n'
            '    ],\n'
            '    "treatments": [\n'
            '      { "id": "uuid", "treatmentType": "MEDICATION",\n'
            '        "medicationName": "Oxitetraciclina", "status": "IN_PROGRESS" }\n'
            '    ],\n'
            '    "labTests": [\n'
            '      { "id": "uuid", "testType": "PCR", "resultStatus": "POSITIVE",\n'
            '        "resultDate": "..." }\n'
            '    ]\n'
            '  }\n'
            '}'
        ),
        spacer(0.4),
    ]

    # 5.5 Cambiar estado
    story += [
        h2('5.5  PATCH .../disease-cases/:caseId/status — Cambiar estado'),
        endpoint_row('PATCH', '/api/bovines/:id/disease-cases/:caseId/status', 'Actualiza el estado del caso. Solo transiciones válidas (ver sección 3).'),
        spacer(0.2),
        h3('Body (JSON)'),
        field_table([
            ('status', 'CaseStatus', True,  'Nuevo estado. Debe ser transición válida desde el estado actual.'),
            ('notes',  'string',     False, 'Obligatorio si status = DISCARDED desde CONFIRMED'),
        ], [3.5*cm, 3*cm, 1.2*cm, 9*cm]),
        spacer(0.2),
        note('Side effects automáticos: si status=CONFIRMED → snapshot del bovino se actualiza con activeDiseaseId. Si status=RECOVERED → snapshot se limpia. Si status=DECEASED → Bovine.healthStatus se actualiza a DECEASED.'),
        spacer(0.4),
    ]

    # 5.6 Síntomas
    story += [
        h2('5.6  POST .../disease-cases/:caseId/symptoms — Registrar síntoma observado'),
        endpoint_row('POST', '/api/bovines/:id/disease-cases/:caseId/symptoms', 'Agrega un síntoma observado al caso.'),
        spacer(0.2),
        h3('Body (JSON)'),
        field_table([
            ('symptomId',   'UUID',          True,  'ID del síntoma del catálogo'),
            ('severity',    'SymptomSeverity',True, 'MILD | MODERATE | SEVERE'),
            ('observedAt',  'ISO datetime',  True,  'Cuándo se observó'),
            ('notes',       'string',        False, 'Observaciones adicionales'),
        ], [3.5*cm, 3.5*cm, 1.2*cm, 8.5*cm]),
        spacer(0.4),
    ]

    # 5.7 Tratamientos
    story += [
        h2('5.7  POST .../disease-cases/:caseId/treatments — Registrar tratamiento'),
        endpoint_row('POST', '/api/bovines/:id/disease-cases/:caseId/treatments', 'Agrega un tratamiento al caso.'),
        spacer(0.2),
        h3('Body (JSON)'),
        field_table([
            ('treatmentType',   'TreatmentType',   True,  'MEDICATION | PROCEDURE | SURGERY | ISOLATION | SUPPORTIVE | OTHER'),
            ('medicationName',  'string',           False, 'Obligatorio si treatmentType=MEDICATION'),
            ('dosage',          'string',           False, 'Ej: "10 mg/kg"'),
            ('frequency',       'string',           False, 'Ej: "Cada 12 horas"'),
            ('startDate',       'ISO datetime',     True,  ''),
            ('endDate',         'ISO datetime',     False, ''),
            ('status',          'TreatmentStatus',  True,  'PRESCRIBED | IN_PROGRESS | COMPLETED | SUSPENDED'),
            ('notes',           'string',           False, ''),
        ]),
        spacer(0.4),
    ]

    # 5.8 Lab tests
    story += [
        h2('5.8  POST .../disease-cases/:caseId/lab-tests — Registrar prueba de laboratorio'),
        endpoint_row('POST', '/api/bovines/:id/disease-cases/:caseId/lab-tests', 'Registra una prueba de laboratorio solicitada o realizada.'),
        spacer(0.2),
        h3('Body (JSON)'),
        field_table([
            ('testType',      'LabTestType',    True,  'PCR | ELISA | CULTURE | TUBERCULIN | etc.'),
            ('sampleType',    'LabSampleType',  True,  'BLOOD | MILK | URINE | etc.'),
            ('requestedAt',   'ISO datetime',   True,  ''),
            ('collectedAt',   'ISO datetime',   False, ''),
            ('labName',       'string',         False, 'Nombre del laboratorio'),
            ('notes',         'string',         False, ''),
        ], [3.5*cm, 3*cm, 1.2*cm, 9*cm]),
        spacer(0.4),
    ]

    # 5.9 Resultado lab
    story += [
        h2('5.9  PATCH .../lab-tests/:testId/result — Registrar resultado'),
        endpoint_row('PATCH', '/api/bovines/:id/disease-cases/:caseId/lab-tests/:testId/result',
                     'Actualiza el resultado de una prueba de laboratorio.'),
        spacer(0.2),
        h3('Body (JSON)'),
        field_table([
            ('resultStatus', 'LabResultStatus', True,  'POSITIVE | NEGATIVE | INCONCLUSIVE | CANCELLED'),
            ('result',       'string',          False, 'Texto libre del resultado (max 500 chars)'),
            ('resultDate',   'ISO datetime',    False, 'Fecha del resultado. Default: now()'),
            ('labName',      'string',          False, 'Actualizar nombre del lab si no se sabía al crear'),
        ], [3.5*cm, 3.5*cm, 1.2*cm, 8.5*cm]),
        note('Side effect: si resultStatus=POSITIVE y el caso está en SUSPECTED, la respuesta incluye "suggestConfirmCase": true como sugerencia al frontend para invitar al usuario a confirmar el caso.'),
        spacer(0.4),
        PageBreak(),
    ]
    return story

# ─────────────────────────────────────────────────────────────
# SECCIÓN 6: ENDPOINTS EXISTENTES ACTUALIZADOS
# ─────────────────────────────────────────────────────────────
def build_updated_endpoints():
    story = [section_banner('6. Endpoints Existentes Actualizados'), spacer(0.4)]

    # 6.1
    story += [
        h2('6.1  GET /api/bovines — Nuevo parámetro diseaseId'),
        endpoint_row('GET', '/api/bovines', 'Lista de bovinos. Se agregan nuevos query params para filtrar por enfermedad.'),
        spacer(0.2),
        h3('Nuevos Query Parameters (Fase 2)'),
        field_table([
            ('diseaseId', 'UUID',      False, 'Filtra bovinos con caso ACTIVE de esa enfermedad (SUSPECTED o CONFIRMED)'),
            ('disease',   'string',    False, 'Filtro por texto libre (Fase 1, deprecado en Fase 2 cuando diseaseId esté disponible)'),
        ], [3.5*cm, 3*cm, 1.2*cm, 9*cm]),
        note('El filtro diseaseId usa JOIN a bovine_disease_cases — solo muestra bovinos actualmente enfermos. No bovinos que alguna vez tuvieron esa enfermedad.'),
        spacer(0.4),
    ]

    # 6.2
    story += [
        h2('6.2  GET /api/bovines/:id/full — Nuevo campo activeCase'),
        endpoint_row('GET', '/api/bovines/:id/full', 'Detalle completo del bovino. Se agrega el campo activeCase si existe caso activo.'),
        spacer(0.2),
        h3('Nuevo campo en la respuesta (si hay caso activo)'),
        code(
            '"activeCase": {\n'
            '  "id": "uuid",\n'
            '  "disease": {\n'
            '    "name": "Brucelosis Bovina",\n'
            '    "slug": "brucelosis-bovina",\n'
            '    "severity": "CRITICAL",\n'
            '    "isContagious": true,\n'
            '    "isZoonotic": true\n'
            '  },\n'
            '  "status": "CONFIRMED",\n'
            '  "severity": "CRITICAL",\n'
            '  "detectedAt": "2026-05-10T08:00:00Z",\n'
            '  "confirmedAt": "2026-05-12T14:00:00Z",\n'
            '  "contagionRisk": "HIGH",\n'
            '  "quarantineStarted": true,\n'
            '  "symptoms": [ { "name", "severity", "observedAt" } ],\n'
            '  "treatments": [ { "treatmentType", "medicationName", "status" } ],\n'
            '  "labTests": [ { "testType", "resultStatus", "resultDate" } ]\n'
            '},\n'
            '"activeCase": null  // si no hay caso activo\n'
        ),
        spacer(0.4),
    ]

    # 6.3
    story += [
        h2('6.3  GET /api/bovines/geo/map-markers — Filtro diseaseId'),
        endpoint_row('GET', '/api/bovines/geo/map-markers', 'Marcadores del mapa. Nuevo parámetro diseaseId para filtrar.'),
        spacer(0.2),
        h3('Nuevo Query Parameter'),
        field_table([
            ('diseaseId', 'UUID',   False, 'Filtra marcadores por enfermedad activa (usa activeDiseaseId del snapshot)'),
            ('diseases',  'string', False, 'CSV de nombres de diagnóstico (modo texto libre, Fase 1)'),
        ], [3.5*cm, 3*cm, 1.2*cm, 9*cm]),
        h3('Nuevos campos en cada marker'),
        code(
            '{\n'
            '  "bovineId": "uuid",\n'
            '  "earTag": "B-042",\n'
            '  "lat": 20.123,\n'
            '  "lng": -103.456,\n'
            '  "healthStatus": "QUARANTINE",\n'
            '  "activeDiseaseId": "uuid",      // NUEVO\n'
            '  "diseaseName": "Brucelosis",     // NUEVO\n'
            '  "caseStatus": "CONFIRMED",       // NUEVO\n'
            '  "caseSeverity": "CRITICAL"       // NUEVO\n'
            '}'
        ),
        spacer(0.4),
    ]
    return story

# ─────────────────────────────────────────────────────────────
# SECCIÓN 7: REGLAS DE NEGOCIO
# ─────────────────────────────────────────────────────────────
def build_business_rules():
    story = [section_banner('7. Reglas de Negocio para el Frontend'), spacer(0.3)]

    rules = [
        ('No caso duplicado activo',
         'Un bovino no puede tener dos casos SUSPECTED o CONFIRMED de la misma enfermedad. El backend devuelve 409. El frontend debe verificar el caso activo antes de mostrar el formulario de creación.'),
        ('quarantineRecommended',
         'Si la respuesta de POST /disease-cases incluye quarantineRecommended: true, el frontend debe mostrar una notificación sugiriendo iniciar cuarentena. No es forzado, es sugerencia.'),
        ('suggestConfirmCase',
         'Si PATCH /lab-tests/:id/result devuelve suggestConfirmCase: true, el frontend debe mostrar un modal invitando al usuario a confirmar el caso (cambiar de SUSPECTED a CONFIRMED).'),
        ('Enfermedades zoonóticas',
         'Si disease.isZoonotic = true en el detalle del caso, mostrar una advertencia de riesgo sanitario para humanos (badge rojo o banner).'),
        ('Estado DECEASED',
         'Si se actualiza un caso a status=DECEASED, el bovino queda inactivo. El frontend debe refrescar el perfil del bovino y deshabilitar ediciones.'),
        ('Transiciones inválidas',
         'El backend rechaza (400) transiciones no permitidas. El frontend debe mostrar solo las opciones de estado válidas según el estado actual del caso.'),
        ('activeCase = null',
         'El campo activeCase en /full puede ser null. El frontend debe manejar ese estado mostrando "Sin enfermedad activa" en lugar de un error.'),
        ('locationId automático',
         'No es obligatorio enviar locationId al crear un caso — el backend lo resuelve del stay activo. Solo enviar si el vet quiere especificar una ubicación diferente.'),
    ]

    for title, desc in rules:
        row = Table([
            [Paragraph(f'<b>{title}</b>', S['Body']),
             Paragraph(desc, S['BodySmall'])]
        ], colWidths=[4*cm, 12.8*cm])
        row.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#d1d5db')),
            ('BACKGROUND', (0,0), (0,0), colors.HexColor('#dbeafe')),
            ('ROWPADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        story.append(row)
        story.append(spacer(0.15))

    story.append(spacer(0.4))
    return story

# ─────────────────────────────────────────────────────────────
# SECCIÓN 8: BADGES Y COLORES
# ─────────────────────────────────────────────────────────────
def build_colors():
    story = [section_banner('8. Badges y Colores por Severidad / Estado'), spacer(0.3)]

    story.append(h2('Severidad del caso (severity)'))
    sev = [
        ('LOW',      '#10b981', 'Verde',   'Leve, tratamiento simple'),
        ('MODERATE', '#f59e0b', 'Amarillo','Requiere atención veterinaria'),
        ('HIGH',     '#f97316', 'Naranja', 'Urgente, posible contagio'),
        ('CRITICAL', '#ef4444', 'Rojo',    'Emergencia sanitaria'),
    ]
    header = [Paragraph(f'<b>{h}</b>', S['BodySmall']) for h in ['Valor','Hex','Color','Significado']]
    data = [header] + [
        [Paragraph(f'<font name="Courier" size="8">{r[0]}</font>', S['Body']),
         Paragraph(f'<font name="Courier" size="8">{r[1]}</font>', S['Body']),
         Table([['']], colWidths=[1.5*cm], style=TableStyle([
             ('BACKGROUND',(0,0),(-1,-1), colors.HexColor(r[1])),
             ('ROWPADDING',(0,0),(-1,-1), 8),
         ])),
         Paragraph(r[3], S['BodySmall'])]
        for r in sev
    ]
    t = Table(data, colWidths=[2.5*cm, 2.5*cm, 2*cm, 9.8*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), C_WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [C_WHITE, C_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#d1d5db')),
        ('ROWPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t)
    story.append(spacer(0.4))

    story.append(h2('Estado del caso (status)'))
    statuses = [
        ('SUSPECTED',  '#f59e0b', 'Sospecha — pendiente de confirmar'),
        ('CONFIRMED',  '#ef4444', 'Confirmado — enfermedad activa'),
        ('RECOVERED',  '#10b981', 'Recuperado — caso cerrado'),
        ('DECEASED',   '#6b7280', 'Fallecido'),
        ('DISCARDED',  '#d1d5db', 'Descartado — no era la enfermedad'),
    ]
    header2 = [Paragraph(f'<b>{h}</b>', S['BodySmall']) for h in ['Estado','Color sugerido','Descripción']]
    data2 = [header2] + [
        [Paragraph(f'<font name="Courier" size="8">{r[0]}</font>', S['Body']),
         Table([['']], colWidths=[2*cm], style=TableStyle([
             ('BACKGROUND',(0,0),(-1,-1), colors.HexColor(r[1])),
             ('ROWPADDING',(0,0),(-1,-1), 8),
         ])),
         Paragraph(r[2], S['BodySmall'])]
        for r in statuses
    ]
    t2 = Table(data2, colWidths=[3.5*cm, 2.5*cm, 10.8*cm])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), C_WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [C_WHITE, C_LIGHT]),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#d1d5db')),
        ('ROWPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t2)
    story.append(spacer(0.5))

    # Nota final
    closing = Table([[
        Paragraph(
            '<b>Versión:</b> 1.0  ·  <b>Estado:</b> Draft para revisión  ·  '
            '<b>Proyecto:</b> Bovino Manager  ·  '
            f'<b>Generado:</b> {date.today().strftime("%d/%m/%Y")}',
            ParagraphStyle('footer', fontName='Helvetica', fontSize=8,
                           textColor=C_WHITE, alignment=TA_CENTER)
        )
    ]], colWidths=[16.8*cm])
    closing.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_PRIMARY),
        ('ROWPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(closing)
    return story

# ─────────────────────────────────────────────────────────────
# HEADER / FOOTER
# ─────────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4

    # Header (no en portada)
    if doc.page > 1:
        canvas.setFillColor(C_PRIMARY)
        canvas.rect(2*cm, h - 1.5*cm, w - 4*cm, 0.8*cm, fill=1, stroke=0)
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(C_WHITE)
        canvas.drawString(2.3*cm, h - 1.05*cm, 'BOVINO MANAGER')
        canvas.setFont('Helvetica', 8)
        canvas.drawRightString(w - 2*cm, h - 1.05*cm, 'Contrato de API — Módulo de Enfermedades')

    # Footer
    canvas.setFillColor(C_MEDIUM)
    canvas.setFont('Helvetica', 7)
    canvas.drawString(2*cm, 1.1*cm, 'Confidencial — uso interno del equipo de desarrollo')
    canvas.drawRightString(w - 2*cm, 1.1*cm, f'Página {doc.page}')
    canvas.setStrokeColor(colors.HexColor('#e5e7eb'))
    canvas.setLineWidth(0.5)
    canvas.line(2*cm, 1.5*cm, w - 2*cm, 1.5*cm)
    canvas.restoreState()

# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def main():
    output_path = 'api_contract_enfermedades.pdf'

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
        title='Contrato de API — Módulo Enfermedades Bovinas',
        author='Bovino Manager Backend Team',
        subject='API Contract v1.0 — Disease Module',
    )

    story = []
    story += build_cover()
    story += build_toc()
    story += build_response_format()
    story += build_error_codes()
    story += build_enums()
    story += build_phase1()
    story += build_phase2()
    story += build_updated_endpoints()
    story += build_business_rules()
    story += build_colors()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f'PDF generado: {output_path}')

if __name__ == '__main__':
    main()
