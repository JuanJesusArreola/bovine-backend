// controllers/bovine.controller.ts
import { Request, Response } from 'express';
import { bovineService } from '../services/BovineService';
import { bovineDeathService } from '../services/BovineDeathService';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class BovineController {
    private readonly context = 'BovineController';

    constructor() {
        // Binding de métodos para que `this` esté disponible
        // cuando Express los ejecute como callbacks.
        this.listBovines = this.listBovines.bind(this);
        this.getBovineById = this.getBovineById.bind(this);
        this.createBovine = this.createBovine.bind(this);
        this.markSick = this.markSick.bind(this);
        this.decease = this.decease.bind(this);
        this.getMortalityReport = this.getMortalityReport.bind(this);
        this.updateBovine = this.updateBovine.bind(this);
        this.deleteBovine = this.deleteBovine.bind(this);
        this.getBovineByEarTag = this.getBovineByEarTag.bind(this);
        this.getStatistics = this.getStatistics.bind(this);
        this.regenerateQR = this.regenerateQR.bind(this);
    }

    /**
     * POST /api/bovines/:id/decease  (X-03)
     * Registra la muerte/baja de un bovino.
     */
    async decease(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }
            const { id } = req.params;
            const death = await bovineDeathService.deceaseBovine(id, req.body, userId);
            res.status(201).json({ success: true, data: death, message: 'Baja por muerte registrada' });
        } catch (error) {
            logger.error('Error en decease', this.context, { id: req.params.id, body: req.body }, error as Error);
            if (error instanceof BovineError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/ranches/:ranchId/mortality  (X-07)
     * Reporte de mortalidad por causa | mes | ubicación.
     */
    async getMortalityReport(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.params;
            const report = await bovineDeathService.getMortalityReport(ranchId, {
                from: req.query.from ? new Date(req.query.from as string) : undefined,
                to: req.query.to ? new Date(req.query.to as string) : undefined,
                groupBy: req.query.groupBy as 'cause' | 'month' | 'location' | undefined,
            });
            res.json({ success: true, data: report });
        } catch (error) {
            logger.error('Error en getMortalityReport', this.context, { params: req.params, query: req.query }, error as Error);
            if (error instanceof BovineError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * GET /api/bovines
     * Lista bovinos con filtros y paginación
     */
    async listBovines(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }
            // Parsear ranchIds (CSV) — multi-rancho
            const rawRanchIds = req.query.ranchIds as string | undefined;
            const ranchIds = rawRanchIds
                ? rawRanchIds.split(',').map((s) => s.trim()).filter(Boolean)
                : undefined;

            const filters = {
                // F-1: el parámetro de búsqueda es `searchTerm` (alineado con el validador).
                searchTerm: req.query.searchTerm as string,
                cattleType: req.query.cattleType as any,
                breed: req.query.breed as string,
                gender: req.query.gender as any,
                healthStatus: req.query.healthStatus as any,
                vaccinationStatus: req.query.vaccinationStatus as any,
                ranchId: req.query.ranchId as string,
                ranchIds, // multi-rancho (CSV → string[])
                locationId: req.query.locationId as string, // ubicación actual (stay activa)
                ownerId: req.query.ownerId as string,
                // B-02: edad en MESES con rangos abiertos (basta con ageMin O ageMax).
                ageRange: (req.query.ageMin !== undefined || req.query.ageMax !== undefined) ? {
                    min: req.query.ageMin !== undefined ? parseInt(req.query.ageMin as string, 10) : undefined,
                    max: req.query.ageMax !== undefined ? parseInt(req.query.ageMax as string, 10) : undefined
                } : undefined,
                // Preset de grupo etario: calf | young | adult (se resuelve a meses)
                ageGroup: req.query.ageGroup as any,
                weightRange: req.query.weightMin && req.query.weightMax ? {
                    min: parseInt(req.query.weightMin as string),
                    max: parseInt(req.query.weightMax as string)
                } : undefined,
                isPregnant: req.query.isPregnant === 'true'
                    ? true
                    : req.query.isPregnant === 'false'
                        ? false
                        : undefined,
                disease: req.query.disease as string,
                diseaseId: req.query.diseaseId as string,
                // G-03: candidatos genealógicos
                excludeIds: req.query.excludeIds
                    ? (req.query.excludeIds as string).split(',').map((s) => s.trim()).filter(Boolean)
                    : undefined,
                purpose: req.query.purpose as 'dam' | 'sire' | undefined,
                // F-30: visibilidad de inactivos / fallecidos
                isActive: req.query.isActive === 'true' ? true
                    : req.query.isActive === 'false' ? false
                    : undefined,
                includeInactive: req.query.includeInactive === 'true',
                exitReason: req.query.exitReason as any,
            };

            // Whitelist de campos permitidos para ordenar (nombres de columnas reales)
            const ALLOWED_SORT_FIELDS = [
                'created_at', 'updated_at', 'ear_tag', 'name',
                'weight', 'birth_date', 'health_status', 'cattle_type',
                'breed', 'gender', 'vaccination_status'
            ];
            const requestedSort = req.query.sortBy as string;
            const safeSortBy = ALLOWED_SORT_FIELDS.includes(requestedSort)
                ? requestedSort
                : 'created_at';

            const pagination = {
                page: parseInt(req.query.page as string) || 1,
                limit: parseInt(req.query.limit as string) || 20,
                sortBy: safeSortBy,
                sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC'
            };

            const result = await bovineService.getBovines(filters, pagination, userId);

            // H-2: enriquecer cada bovino del listado con los campos formateados
            // (classificationLabel, isReproductiveAge, labels, ageDisplay) SIN perder
            // los campos crudos que el front ya consumía → merge no-breaking.
            res.json({
                success: true,
                data: {
                    bovines: result.bovines.map((b) => ({
                        ...(b.toJSON() as object),
                        ...bovineService.formatBovineResponse(b),
                    })),
                    pagination: result.pagination
                }
            });

        } catch (error) {
            logger.error('Error en listBovines', this.context, { query: req.query }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/:id
     * Obtiene un bovino por ID
     */
    async getBovineById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            // G-05: ?include=parents → eager-load madre/padre
            const includeParents = typeof req.query.include === 'string'
                && req.query.include.split(',').map((s) => s.trim()).includes('parents');

            const bovine = await bovineService.getBovineById(id, userId, { includeParents });

            if (!bovine) {
                res.status(404).json({
                    success: false,
                    error: 'Bovino no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                data: bovineService.formatBovineResponse(bovine)
            });

        } catch (error) {
            logger.error('Error en getBovineById', this.context, { id: req.params.id }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/bovines
     * Crea un nuevo bovino
     */
    async createBovine(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const bovine = await bovineService.createBovine(req.body, userId);

            res.status(201).json({
                success: true,
                data: bovineService.formatBovineResponse(bovine),
                message: 'Bovino creado exitosamente'
            });

        } catch (error) {
            logger.error('Error en createBovine', this.context, { body: req.body }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/bovines/:id/sick  (C-04)
     * Marca enfermo a un bovino existente abriendo un caso clínico.
     */
    async markSick(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }
            const { id } = req.params;
            const diseaseCase = await bovineService.markBovineSick(id, req.body, userId);
            res.status(201).json({
                success: true,
                data: diseaseCase,
                message: 'Bovino marcado como enfermo (caso clínico abierto)'
            });
        } catch (error) {
            logger.error('Error en markSick', this.context, { id: req.params.id, body: req.body }, error as Error);
            if (error instanceof BovineError) {
                res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * PUT /api/bovines/:id
     * Actualiza un bovino existente
     */
    async updateBovine(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const bovine = await bovineService.updateBovine(
                { id, ...req.body },
                userId
            );

            res.json({
                success: true,
                data: bovineService.formatBovineResponse(bovine),
                message: 'Bovino actualizado exitosamente'
            });

        } catch (error) {
            logger.error('Error en updateBovine', this.context, { id: req.params.id, body: req.body }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * DELETE /api/bovines/:id
     * Elimina un bovino (soft delete)
     */
    async deleteBovine(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            await bovineService.deleteBovine(id, userId);

            res.json({
                success: true,
                message: 'Bovino eliminado exitosamente'
            });

        } catch (error) {
            logger.error('Error en deleteBovine', this.context, { id: req.params.id }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/ear-tag/:earTag
     * Obtiene un bovino por su etiqueta de oreja
     */
    async getBovineByEarTag(req: Request, res: Response): Promise<void> {
        try {
            const { earTag } = req.params;
            const { ranchId } = req.query;

            const bovine = await bovineService.getBovineByEarTag(
                earTag,
                ranchId as string
            );

            if (!bovine) {
                res.status(404).json({
                    success: false,
                    error: 'Bovino no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                data: bovineService.formatBovineResponse(bovine)
            });

        } catch (error) {
            logger.error('Error en getBovineByEarTag', this.context, { earTag: req.params.earTag }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * GET /api/bovines/statistics
     * Obtiene estadísticas de bovinos
     */
    async getStatistics(req: Request, res: Response): Promise<void> {
        try {
            const { ranchId } = req.query;
            const userId = req.user?.id;

            const stats = await bovineService.getBovineStatistics(
                ranchId as string,
                userId
            );

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('Error en getStatistics', this.context, { query: req.query }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }

    /**
     * POST /api/bovines/:id/regenerate-qr
     * Regenera el código QR de un bovino
     */
    async regenerateQR(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado'
                });
                return;
            }

            const qrCode = await bovineService.regenerateQRCode(id, userId);

            res.json({
                success: true,
                data: { qrCode },
                message: 'QR regenerado exitosamente'
            });

        } catch (error) {
            logger.error('Error en regenerateQR', this.context, { id: req.params.id }, error as Error);

            if (error instanceof BovineError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                    code: error.code
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor'
                });
            }
        }
    }
}

export const bovineController = new BovineController();