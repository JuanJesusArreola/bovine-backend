// src/controllers/inventory.controller.ts
import { Request, Response } from 'express';
import { inventoryService } from '../services/InventoryService';
import { BovineError } from '../utils/BovineErrors';
import logger from '../utils/logger';

export class InventoryController {
    private readonly context = 'InventoryController';

    constructor() {
        this.getInventory = this.getInventory.bind(this);
        this.getInventoryItem = this.getInventoryItem.bind(this);
        this.updateStock = this.updateStock.bind(this);
        this.reserveStock = this.reserveStock.bind(this);
        this.releaseStock = this.releaseStock.bind(this);
        this.calculateValuation = this.calculateValuation.bind(this);
        this.getInventoryAlerts = this.getInventoryAlerts.bind(this);
    }

    // ==========================================================================
    // CONSULTAS DE INVENTARIO
    // ==========================================================================

    /**
     * GET /api/inventory
     * Obtiene lista de items de inventario con filtros
     */
    async getInventory(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { 
                category, 
                status, 
                lowStock, 
                expired, 
                search, 
                location, 
                page, 
                limit 
            } = req.query;

            const filters = {
                category: category as any,
                status: status as any,
                lowStock: lowStock === 'true',
                expired: expired === 'true',
                search: search as string,
                location: location as string,
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
            };

            const ranchId = req.query.ranchId as string || req.user?.id;

            const result = await inventoryService.getInventory(filters, ranchId);

            res.json({
                success: true,
                data: result.items,
                pagination: result.metadata,
                summary: {
                    totalItems: result.total,
                    lowStockCount: result.items.filter(i => i.currentStock <= i.minimumStock).length,
                    expiredCount: result.items.filter(i => i.expirationDate && new Date(i.expirationDate) < new Date()).length,
                }
            });

        } catch (error) {
            logger.error('Error en getInventory', this.context, { query: req.query }, error as Error);
            res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    /**
     * GET /api/inventory/:itemId
     * Obtiene un item de inventario específico
     */
    async getInventoryItem(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { itemId } = req.params;

            const item = await inventoryService.getInventoryItemById(itemId);
            if (!item) {
                res.status(404).json({ success: false, error: 'Item de inventario no encontrado' });
                return;
            }

            res.json({ success: true, data: item });

        } catch (error) {
            logger.error('Error en getInventoryItem', this.context, { params: req.params }, error as Error);
            res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    // ==========================================================================
    // MOVIMIENTOS DE STOCK
    // ==========================================================================

    /**
     * POST /api/inventory/:itemId/update-stock
     * Actualiza el stock de un item (compra, uso, ajuste, etc.)
     */
    async updateStock(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { itemId } = req.params;
            const { movementType, quantity, reason, unitCost, reference, bovineId, treatmentId, notes } = req.body;

            if (!movementType || !quantity || !reason) {
                res.status(400).json({ 
                    success: false, 
                    error: 'movementType, quantity y reason son requeridos' 
                });
                return;
            }

            const updatedItem = await inventoryService.updateStock(
                itemId,
                { movementType, quantity, reason, unitCost, reference, bovineId, treatmentId, notes },
                userId
            );

            res.json({
                success: true,
                data: updatedItem,
                message: `Stock actualizado: ${quantity > 0 ? '+' : ''}${quantity} unidades`
            });

        } catch (error) {
            logger.error('Error en updateStock', this.context, { params: req.params, body: req.body }, error as Error);
            if (error instanceof Error) {
                res.status(400).json({ success: false, error: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * POST /api/inventory/:itemId/reserve
     * Reserva stock para un tratamiento
     */
    async reserveStock(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { itemId } = req.params;
            const { quantity, treatmentId } = req.body;

            if (!quantity || !treatmentId) {
                res.status(400).json({ success: false, error: 'quantity y treatmentId son requeridos' });
                return;
            }

            const updatedItem = await inventoryService.reserveStock(itemId, quantity, treatmentId, userId);

            res.json({
                success: true,
                data: updatedItem,
                message: `${quantity} unidades reservadas para tratamiento ${treatmentId}`
            });

        } catch (error) {
            logger.error('Error en reserveStock', this.context, { params: req.params, body: req.body }, error as Error);
            if (error instanceof Error) {
                res.status(400).json({ success: false, error: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    /**
     * POST /api/inventory/:itemId/release
     * Libera stock reservado
     */
    async releaseStock(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { itemId } = req.params;
            const { quantity, treatmentId } = req.body;

            if (!quantity || !treatmentId) {
                res.status(400).json({ success: false, error: 'quantity y treatmentId son requeridos' });
                return;
            }

            const updatedItem = await inventoryService.releaseStock(itemId, quantity, treatmentId, userId);

            res.json({
                success: true,
                data: updatedItem,
                message: `${quantity} unidades liberadas del tratamiento ${treatmentId}`
            });

        } catch (error) {
            logger.error('Error en releaseStock', this.context, { params: req.params, body: req.body }, error as Error);
            if (error instanceof Error) {
                res.status(400).json({ success: false, error: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Error interno del servidor' });
            }
        }
    }

    // ==========================================================================
    // VALUACIÓN Y ANÁLISIS
    // ==========================================================================

    /**
     * GET /api/inventory/valuation/:ranchId
     * Calcula valuación del inventario
     */
    async calculateValuation(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { ranchId } = req.params;
            const { method } = req.query;

            const valuation = await inventoryService.calculateInventoryValuation(
                ranchId,
                method as any || 'WEIGHTED_AVERAGE'
            );

            res.json({ success: true, data: valuation });

        } catch (error) {
            logger.error('Error en calculateValuation', this.context, { params: req.params }, error as Error);
            res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }

    // ==========================================================================
    // ALERTAS
    // ==========================================================================

    /**
     * GET /api/inventory/alerts/:ranchId
     * Obtiene alertas de inventario (stock bajo, vencimientos)
     */
    async getInventoryAlerts(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { ranchId } = req.params;

            // Obtener items con stock bajo
            const lowStockItems = await inventoryService.getInventory({ lowStock: true }, ranchId);
            
            // Obtener items próximos a vencer
            const expiringItems = await inventoryService.getInventory({ expired: false }, ranchId);
            const now = new Date();
            const expiringSoon = expiringItems.items.filter(item => 
                item.expirationDate && 
                Math.ceil((new Date(item.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 30
            );

            res.json({
                success: true,
                data: {
                    lowStock: lowStockItems.items,
                    expiringSoon: expiringSoon,
                    summary: {
                        lowStockCount: lowStockItems.total,
                        expiringSoonCount: expiringSoon.length,
                    }
                }
            });

        } catch (error) {
            logger.error('Error en getInventoryAlerts', this.context, { params: req.params }, error as Error);
            res.status(500).json({ success: false, error: 'Error interno del servidor' });
        }
    }
}

export const inventoryController = new InventoryController();