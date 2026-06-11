// services/user/UserPushService.ts
import  User, {PushToken } from '../models/User';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errorUtils';
import {Op} from 'sequelize'
import { Sequelize } from 'sequelize';

export class UserPushService {
  private readonly context = 'UserPushService';

  /**
   * Agrega o actualiza un token push para el usuario
   */
  async addPushToken(
    userId: string,
    tokenData: Omit<PushToken, 'lastUsed' | 'createdAt' | 'active'>
  ): Promise<User> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      // Validar datos
      if (!tokenData.token || tokenData.token.length < 10) {
        throw new ValidationError('Token inválido');
      }
      if (!['android', 'ios', 'web'].includes(tokenData.deviceType)) {
        throw new ValidationError('Tipo de dispositivo inválido');
      }

      // Inicializar pushTokens si no existe
      if (!user.pushTokens) {
        user.pushTokens = [];
      }

      const now = new Date();
      const existingIndex = user.pushTokens.findIndex(t => t.token === tokenData.token);

      const newToken: PushToken = {
        ...tokenData,
        lastUsed: now,
        createdAt: existingIndex === -1 ? now : user.pushTokens[existingIndex].createdAt,
        active: true,
        preferences: tokenData.preferences || {
          sound: true,
          vibrate: true,
          badge: true,
          priority: 'normal'
        }
      };

      if (existingIndex >= 0) {
        // Actualizar existente
        user.pushTokens[existingIndex] = {
          ...user.pushTokens[existingIndex],
          ...newToken,
          createdAt: user.pushTokens[existingIndex].createdAt
        };
      } else {
        // Agregar nuevo
        user.pushTokens.push(newToken);
      }

      // Limitar a máximo 10 tokens por usuario
      if (user.pushTokens.length > 10) {
        user.pushTokens.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
        user.pushTokens = user.pushTokens.slice(0, 10);
      }

      await user.save();

      logger.info('Token push agregado', this.context, {
        userId,
        deviceType: tokenData.deviceType
      });

      return user;

    } catch (error) {
      logger.error('Error agregando token push', this.context, { userId }, error as Error);
      throw error;
    }
  }

  /**
   * Elimina un token push específico
   */
  async removePushToken(userId: string, token: string): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (user.pushTokens) {
      user.pushTokens = user.pushTokens.filter(t => t.token !== token);
      await user.save();
    }

    return user;
  }

  /**
   * Desactiva un token push (cuando FCM reporta token inválido)
   */
  async deactivatePushToken(userId: string, token: string): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const tokenIndex = user.pushTokens?.findIndex(t => t.token === token);
    if (tokenIndex !== undefined && tokenIndex >= 0 && user.pushTokens) {
      user.pushTokens[tokenIndex].active = false;
      await user.save();
    }

    return user;
  }

  /**
   * Obtiene tokens activos de un usuario
   */
  async getActivePushTokens(
    userId: string,
    deviceType?: 'android' | 'ios' | 'web'
  ): Promise<string[]> {
    const user = await User.findByPk(userId);
    if (!user || !user.pushTokens) {
      return [];
    }

    return user.pushTokens
      .filter(t => t.active && (!deviceType || t.deviceType === deviceType))
      .map(t => t.token);
  }

  /**
   * Actualiza última fecha de uso de un token
   */
  async updateTokenLastUsed(userId: string, token: string): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user || !user.pushTokens) return;

    const tokenIndex = user.pushTokens.findIndex(t => t.token === token);
    if (tokenIndex >= 0) {
      user.pushTokens[tokenIndex].lastUsed = new Date();
      await user.save();
    }
  }

  /**
   * Limpia tokens inactivos de todos los usuarios (tarea programada)
   */
  async cleanupInactiveTokens(daysInactive: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const users = await User.findAll({
      where: {
        pushTokens: { [Op.ne]: null } as any
      }
    });

    let totalRemoved = 0;

    for (const user of users) {
      if (!user.pushTokens) continue;

      const originalLength = user.pushTokens.length;
      user.pushTokens = user.pushTokens.filter(t => 
        t.active && t.lastUsed > cutoffDate
      );

      if (originalLength !== user.pushTokens.length) {
        await user.save();
        totalRemoved += originalLength - user.pushTokens.length;
      }
    }

    logger.info('Limpieza de tokens inactivos completada', this.context, {
      removed: totalRemoved,
      daysInactive
    });

    return totalRemoved;
  }

  /**
   * Obtiene estadísticas de push tokens de un usuario
   */
  async getPushTokenStats(userId: string): Promise<{
    total: number;
    active: number;
    byDeviceType: Record<string, number>;
    lastUsed: Date | null;
  }> {
    const user = await User.findByPk(userId);
    
    if (!user || !user.pushTokens || user.pushTokens.length === 0) {
      return {
        total: 0,
        active: 0,
        byDeviceType: {},
        lastUsed: null
      };
    }

    const active = user.pushTokens.filter(t => t.active);
    const byDeviceType: Record<string, number> = {};
    
    user.pushTokens.forEach(t => {
      byDeviceType[t.deviceType] = (byDeviceType[t.deviceType] || 0) + 1;
    });

    const lastUsed = user.pushTokens.reduce(
      (latest, t) => !latest || t.lastUsed > latest ? t.lastUsed : latest,
      null as Date | null
    );

    return {
      total: user.pushTokens.length,
      active: active.length,
      byDeviceType,
      lastUsed
    };
  }
}

export const userPushService = new UserPushService();