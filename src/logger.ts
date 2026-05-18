import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

class Logger {
  private outputChannel: vscode.OutputChannel | null = null;
  private logFilePath: string = '';

  constructor() {
    try {
      this.outputChannel = vscode.window.createOutputChannel('Agentic Sounds');
    } catch (err) {
      // No estamos en el contexto de VSCode (ej. ejecución en entorno de test o CLI)
    }

    try {
      const logDir = path.join(os.homedir(), '.gemini', 'antigravity', 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      this.logFilePath = path.join(logDir, 'extension_alert.log');
    } catch (err) {
      console.error('[Logger Init Error] No se pudo inicializar la ruta del archivo de log:', err);
    }
  }

  private write(level: 'INFO' | 'WARN' | 'ERROR', message: string, ...args: any[]): void {
    try {
      const timestamp = new Date().toISOString();
      const formattedArgs = args.length > 0 
        ? ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ') 
        : '';
      const logLine = `[${timestamp}] [${level}] ${message}${formattedArgs}`;

      // 1. Imprimir en consola de desarrollo
      if (level === 'ERROR') {
        console.error(logLine);
      } else if (level === 'WARN') {
        console.warn(logLine);
      } else {
        console.log(logLine);
      }

      // 2. Enviar al Output Channel de VSCode
      if (this.outputChannel) {
        this.outputChannel.appendLine(logLine);
      }

      // 3. Escribir en el archivo de registro en disco
      if (this.logFilePath) {
        fs.appendFileSync(this.logFilePath, logLine + '\n', 'utf8');
      }
    } catch (err) {
      console.error('[Logger Write Error] Error crítico al intentar escribir en log:', err);
    }
  }

  public info(message: string, ...args: any[]): void {
    this.write('INFO', message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    this.write('WARN', message, ...args);
  }

  public error(message: string, error?: any): void {
    try {
      let errorDetails = '';
      if (error instanceof Error) {
        errorDetails = `${error.message}\n${error.stack ?? ''}`;
      } else if (error !== undefined && error !== null) {
        errorDetails = typeof error === 'object' ? JSON.stringify(error) : String(error);
      }
      this.write('ERROR', message, errorDetails ? errorDetails : '');
    } catch (err) {
      console.error('[Logger Error Handler] Error al formatear error:', err);
    }
  }

  public show(): void {
    try {
      if (this.outputChannel) {
        this.outputChannel.show(true);
      }
    } catch (err) {
      console.error('[Logger Show Error] No se pudo mostrar el canal de salida:', err);
    }
  }

  /**
   * Envuelve una función o callback para ejecutarla de manera segura, capturando y registrando cualquier error
   * sin necesidad de escribir bloques try-catch repetitivos.
   */
  public safeRun<T extends (...args: any[]) => any>(
    contextMessage: string,
    fn: T
  ): (...args: Parameters<T>) => ReturnType<T> | void {
    return (...args: Parameters<T>) => {
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result.catch(err => {
            this.error(contextMessage, err);
          }) as ReturnType<T>;
        }
        return result;
      } catch (err) {
        this.error(contextMessage, err);
      }
    };
  }
}

export const logger = new Logger();
