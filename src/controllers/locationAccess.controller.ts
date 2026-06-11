// controllers/location/locationAccess.controller.ts
import { Request, Response } from 'express';
import { locationAccessService } from '../services/location/LocationAccessService';
import { LocationError } from '../utils/LocationErrors';
import logger from '../utils/logger';

export class LocationAccessController {
  private readonly context = 'LocationAccessController';

  constructor() {
    this.canAccess = this.canAccess.bind(this);
    this.grantAccess = this.grantAccess.bind(this);
    this.revokeAccess = this.revokeAccess.bind(this);
    this.extendAccess = this.extendAccess.bind(this);
    this.recordAccess = this.recordAccess.bind(this);
    this.getUserActiveAccesses = this.getUserActiveAccesses.bind(this);
    this.cleanupExpiredAccesses = this.cleanupExpiredAccesses.bind(this);
  }

  async canAccess(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { locationId } = req.params;
      const { purpose } = req.query;
      const access = await locationAccessService.canAccess(userId, locationId, purpose as any);
      res.json({ success: true, data: { canAccess: access } });
    } catch (error) {
      logger.error('Error en canAccess', this.context, { params: req.params, query: req.query }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async grantAccess(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { locationId, targetUserId, accessLevel, expiresAt, timeRestrictions, purposeRestrictions } = req.body;
      if (!locationId || !targetUserId || !accessLevel) {
        res.status(400).json({ success: false, error: 'locationId, targetUserId y accessLevel son requeridos' });
        return;
      }

      const access = await locationAccessService.grantAccess({
        locationId,
        userId: targetUserId,
        accessLevel,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        timeRestrictions,
        purposeRestrictions,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: access,
        message: 'Acceso otorgado exitosamente',
      });
    } catch (error) {
      logger.error('Error en grantAccess', this.context, { body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async revokeAccess(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { accessId } = req.params;
      const { reason } = req.body;
      const access = await locationAccessService.revokeAccess(accessId, userId, reason);
      res.json({ success: true, data: access, message: 'Acceso revocado' });
    } catch (error) {
      logger.error('Error en revokeAccess', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async extendAccess(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { accessId } = req.params;
      const { newExpirationDate, reason } = req.body;
      if (!newExpirationDate) {
        res.status(400).json({ success: false, error: 'newExpirationDate es requerido' });
        return;
      }

      const access = await locationAccessService.extendAccess({
        accessId,
        newExpirationDate: new Date(newExpirationDate),
        extendedBy: userId,
        reason,
      });

      res.json({ success: true, data: access, message: 'Acceso extendido' });
    } catch (error) {
      logger.error('Error en extendAccess', this.context, { params: req.params, body: req.body }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async recordAccess(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const { accessId } = req.params;
      await locationAccessService.recordAccess(accessId);
      res.json({ success: true, message: 'Uso registrado' });
    } catch (error) {
      logger.error('Error en recordAccess', this.context, { params: req.params }, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async getUserActiveAccesses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      const accesses = await locationAccessService.getUserActiveAccesses(userId);
      res.json({ success: true, data: accesses });
    } catch (error) {
      logger.error('Error en getUserActiveAccesses', this.context, {}, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }

  async cleanupExpiredAccesses(req: Request, res: Response): Promise<void> {
    try {
      // Solo permitir a administradores ejecutar esta operación
      if (req.user?.role !== 'SUPER_ADMIN') {
        res.status(403).json({ success: false, error: 'No autorizado' });
        return;
      }

      const count = await locationAccessService.cleanupExpiredAccesses();
      res.json({ success: true, data: { cleaned: count }, message: 'Limpieza completada' });
    } catch (error) {
      logger.error('Error en cleanupExpiredAccesses', this.context, {}, error as Error);
      if (error instanceof LocationError) {
        res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
      } else {
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
      }
    }
  }
}

export const locationAccessController = new LocationAccessController();