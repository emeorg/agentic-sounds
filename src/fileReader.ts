import fs from 'fs';
import { parseIncomingChunk } from './parser';
import { evaluateLogEntry } from './evaluator';
import { logger } from './logger';

const filePositions = new Map<string, number>();

/**
 * Registra o actualiza el tamaño inicial de un archivo observado.
 */
export function updateFilePosition(filePath: string, size: number): void {
  try {
    filePositions.set(filePath, size);
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
 * Limpia el estado de los punteros de lectura.
 */
export function clearFilePositions(): void {
  try {
    filePositions.clear();
  } catch (err) {
    logger.error('Error al limpiar las posiciones de archivos', err);
  }
}

