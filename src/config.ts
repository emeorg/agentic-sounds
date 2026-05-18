import * as vscode from 'vscode';
import { logger } from './logger';

export const CONFIG_SECTION = 'agenticSounds';
export const VOLUME_KEY = 'volume';
export const COOLDOWN_KEY = 'cooldownMs';
export const INACTIVE_HOURS_KEY = 'maxInactiveHours';

/**
 * Obtiene el nivel de volumen actual (0 a 100).
 */
export function getVolume(): number {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<number>(VOLUME_KEY, 100);
}

/**
 * Actualiza el nivel de volumen de forma global.
 */
export async function updateVolume(volume: number): Promise<void> {
  const sanitizedVolume = Math.max(0, Math.min(100, Math.round(volume)));
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update(VOLUME_KEY, sanitizedVolume, vscode.ConfigurationTarget.Global);
  logger.info(`Volumen global actualizado a: ${sanitizedVolume}%`);
}

/**
 * Obtiene el tiempo de enfriamiento (cooldown) en milisegundos entre sonidos idénticos.
 */
export function getCooldownMs(): number {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<number>(COOLDOWN_KEY, 250);
}

/**
 * Obtiene el número máximo de horas de inactividad antes de evictar archivos de los buffers.
 */
export function getMaxInactiveHours(): number {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<number>(INACTIVE_HOURS_KEY, 24);
}
