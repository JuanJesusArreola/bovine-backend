// controllers/push.controller.ts
import { Request, Response } from 'express';
import { userPushService } from '../services/UserPushService';
import logger from '../utils/logger';

export class PushController {

    /**
     * Registra un token push
     */
    async registerToken(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }
            const { token, deviceType, deviceName, deviceId, platform, appVersion } = req.body;

            if (!token || !deviceType) {
                res.status(400).json({
                    success: false,
                    error: 'Token y deviceType son requeridos'
                });
                return;
            }

            await userPushService.addPushToken(userId, {
                token,
                deviceType,
                deviceName,
                deviceId,
                platform,
                appVersion
            });

            logger.info('Token push registrado', 'PushController', {
                userId,
                deviceType
            });

            res.json({
                success: true,
                message: 'Token registrado exitosamente'
            });

        } catch (error) {
            logger.error('Error registrando token', 'PushController', {}, error as Error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    /**
     * Elimina un token
     */
    async removeToken(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ success: false, error: 'Usuario no autenticado' });
                return;
            }

            const { token } = req.params;
            if (!token) {
                res.status(400).json({ success: false, error: 'Token requerido' });
                return;
            }

            await userPushService.removePushToken(userId, token);

            res.json({
                success: true,
                message: 'Token eliminado'
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }

    /**
     * Obtiene estadísticas de tokens
     */
    async getStats(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(400).json({ succes: false, errror: 'Usuario no encontrado' });
                return;
            }
            const stats = await userPushService.getPushTokenStats(userId);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    }
}

export const pushController = new PushController();