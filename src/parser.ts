import { LogEntry } from './evaluator';
import { logger } from './logger';

const leftoverBuffers = new Map<string, string>();

/**
 * Procesa un nuevo fragmento de texto crudo de un archivo, ensambla líneas completas
 * y extrae objetos JSON válidos, evitando cortes a mitad de transmisión.
 */
export function parseIncomingChunk(filePath: string, chunk: string): LogEntry[] {
  try {
    const previousLeftover = leftoverBuffers.get(filePath) ?? '';
    const combinedText = previousLeftover + chunk;

    const lines = combinedText.split('\n');
    
    const endsWithNewline = chunk.endsWith('\n');
    const lastLine = lines.pop() ?? '';

    if (endsWithNewline) {
      if (lastLine) {
        lines.push(lastLine);
      }
      leftoverBuffers.set(filePath, '');
    } else {
      leftoverBuffers.set(filePath, lastLine);
    }

    const validEntries: LogEntry[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          validEntries.push(parsed);
        }
      } catch (err) {
        // Ignorar líneas que no sean JSON válido
      }
    }

    return validEntries;
  } catch (error) {
    logger.error(`Error al procesar el chunk entrante para ${filePath}`, error);
    return [];
  }
}

/**
 * Limpia el búfer acumulado para un archivo cuando se deja de monitorear.
 */
export function clearBuffer(filePath: string): void {
  try {
    leftoverBuffers.delete(filePath);
  } catch (err) {
    logger.error(`Error al limpiar el buffer para ${filePath}`, err);
  }
}

