import { playSound } from './audio';
import { logger } from './logger';

export interface ToolCall {
  name: string;
  args?: Record<string, any>;
}

export interface LogEntry {
  step_index?: number;
  source?: string;
  type?: string;
  status?: string;
  content?: string;
  tool_calls?: ToolCall[];
}

/**
 * Verifica si alguna herramienta ejecutada requiere aprobación explícita del usuario.
 */
function hasUnsafeCommands(toolCalls: ToolCall[]): boolean {
  try {
    return toolCalls.some(call => {
      if (call.name === 'run_command' || call.name === 'send_command_input') {
        const isSafe = call.args?.SafeToAutoRun;
        return isSafe === false || isSafe === 'false';
      }
      return false;
    });
  } catch (err) {
    logger.error('Error al evaluar comandos inseguros', err);
    return false;
  }
}

/**
 * Verifica si se ejecutaron herramientas que modifican archivos en el proyecto.
 */
function hasFileModifications(toolCalls: ToolCall[]): boolean {
  try {
    const modTools = ['write_to_file', 'replace_file_content', 'multi_replace_file_content'];
    return toolCalls.some(call => modTools.includes(call.name));
  } catch (err) {
    logger.error('Error al evaluar modificaciones de archivos', err);
    return false;
  }
}

/**
 * Evalúa una entrada de registro y dispara los eventos sonoros pertinentes según la actividad del agente de IA.
 */
export function evaluateLogEntry(entry: LogEntry): void {
  try {
    if (!entry || entry.source !== 'MODEL' || entry.status !== 'DONE') {
      return;
    }

    const toolCalls = entry.tool_calls ?? [];

    // 1. Verificar si hay solicitudes de comandos peligrosos/sin auto-run
    if (hasUnsafeCommands(toolCalls)) {
      logger.info('Comando inseguro detectado, activando advertencia sonora.');
      playSound('warning');
      return;
    }

    // 2. Verificar modificaciones en archivos
    if (hasFileModifications(toolCalls)) {
      logger.info('Modificación de archivos detectada en el turno.');
      playSound('message');
    }

    // 3. Si el paso tiene contenido textual final (o tras procesar el paso), notificar completado
    if (entry.content) {
      logger.info('Turno de Antigravity completado exitosamente.');
      playSound('complete');
    }
  } catch (err) {
    logger.error('Error crítico al evaluar la entrada del log', err);
  }
}

