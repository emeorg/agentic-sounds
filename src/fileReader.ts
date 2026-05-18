import fs from 'fs';
import { parseIncomingChunk, clearBuffer } from './parser';
import { evaluateLogEntry } from './evaluator';
import { logger } from './logger';
import { getMaxInactiveHours } from './config';

const filePositions = new Map<string, number>();
const fileLastActive = new Map<string, number>();

/**
 * Registra o actualiza el tamaño inicial de un archivo observado y marca su actividad.
 */
export function updateFilePosition(filePath: string, size: number): void {
  try {
    filePositions.set(filePath, size);
    fileLastActive.set(filePath, Date.now());
  } catch (err) {
    logger.error(`Error al actualizar la posición del archivo ${filePath}`, err);
  }
}

/**
 * Lee únicamente la diferencia (delta) recién añadida a un archivo desde la última lectura
 * y envía el texto al analizador (parser).
 */
export function processFileDelta(filePath: string, currentSize: number): void {
  try {
    fileLastActive.set(filePath, Date.now());
    const lastPos = filePositions.get(filePath) ?? 0;
    
    if (currentSize <= lastPos) {
      filePositions.set(filePath, currentSize);
      return;
    }

    const lengthToRead = currentSize - lastPos;
    const buffer = Buffer.alloc(lengthToRead);

    try {
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, lengthToRead, lastPos);
      fs.closeSync(fd);

      const deltaText = buffer.toString('utf-8');
      const logEntries = parseIncomingChunk(filePath, deltaText);

      for (const entry of logEntries) {
        evaluateLogEntry(entry);
      }

      filePositions.set(filePath, currentSize);
    } catch (err) {
      logger.error(`Error de E/S al leer el delta de ${filePath}`, err);
    }
  } catch (error) {
    logger.error('Error general en processFileDelta', error);
  }
}

/**
 * Elimina de la memoria los registros de archivos que llevan inactivos más tiempo del permitido en la configuración.
 */
export function evictInactiveFiles(): void {
  try {
    const maxInactiveMs = getMaxInactiveHours() * 3600 * 1000;
    const now = Date.now();
    let evictedCount = 0;

    for (const [filePath, lastActive] of fileLastActive.entries()) {
      if (now - lastActive > maxInactiveMs) {
        filePositions.delete(filePath);
        fileLastActive.delete(filePath);
        clearBuffer(filePath);
        evictedCount++;
      }
    }

    if (evictedCount > 0) {
      logger.info(`Limpieza de memoria ejecutada: ${evictedCount} archivos inactivos evictados de los buffers.`);
    }
  } catch (err) {
    logger.error('Error durante la evicción de archivos inactivos', err);
  }
}

/**
 * Limpia totalmente el estado de los punteros de lectura.
 */
export function clearFilePositions(): void {
  try {
    filePositions.clear();
    fileLastActive.clear();
  } catch (err) {
    logger.error('Error al limpiar las posiciones de archivos', err);
  }
}
