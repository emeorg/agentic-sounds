import fs from 'fs';
import path from 'path';
import os from 'os';
import { watch, FSWatcher } from 'chokidar';
import { updateFilePosition, processFileDelta, clearFilePositions } from './fileReader';
import { playSound } from './audio';
import { logger } from './logger';

let activeWatcher: FSWatcher | null = null;

/**
 * Inicia el observador del sistema de archivos sobre los registros de Antigravity.
 */
export function startMonitoring(): void {
  try {
    if (activeWatcher) {
      logger.info('El monitor ya se encuentra activo.');
      return;
    }

    const homeDir = os.homedir();
    const brainDir = path.join(homeDir, '.gemini', 'antigravity', 'brain');

    if (!fs.existsSync(brainDir)) {
      logger.warn(`El directorio raíz de Antigravity no existe en: ${brainDir}`);
      return;
    }

    logger.info(`Monitoreando actividad en el directorio: ${brainDir}`);
    playSound('login');

    activeWatcher = watch(brainDir, {
      persistent: true,
      ignored: () => false,
      usePolling: false,
      ignoreInitial: false,
      depth: 5,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 50
      }
    });

    activeWatcher
      .on('add', (filePath: string) => {
        if (!filePath.endsWith('overview.txt')) return;
        try {
          const stats = fs.statSync(filePath);
          updateFilePosition(filePath, stats.size);
          logger.info(`Archivo añadido al monitoreo: ${filePath} (${stats.size} bytes)`);
        } catch (err) {
          logger.error(`Error al registrar archivo inicial ${filePath}`, err);
        }
      })
      .on('change', (filePath: string) => {
        if (!filePath.endsWith('overview.txt')) return;
        try {
          const stats = fs.statSync(filePath);
          processFileDelta(filePath, stats.size);
        } catch (err) {
          logger.error(`Error al procesar cambios en el archivo ${filePath}`, err);
        }
      })
      .on('error', (error: unknown) => {
        logger.error('Error en el monitor de sistema de archivos Chokidar', error);
      });
  } catch (error) {
    logger.error('Error crítico al iniciar la monitorización', error);
  }
}

/**
 * Detiene la monitorización y limpia los recursos.
 */
export async function stopMonitoring(): Promise<void> {
  try {
    if (activeWatcher) {
      await activeWatcher.close();
      activeWatcher = null;
      clearFilePositions();
      logger.info('Monitoreo detenido correctamente y recursos limpiados.');
    }
  } catch (error) {
    logger.error('Error al intentar detener el monitoreo', error);
  }
}

