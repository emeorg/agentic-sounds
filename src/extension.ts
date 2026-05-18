import * as vscode from 'vscode';
import { startMonitoring, stopMonitoring } from './watcher';
import { playSound } from './audio';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
  logger.safeRun('Error crítico durante la activación de la extensión', () => {
    logger.info('Iniciando activación de la extensión Agentic Sounds en el IDE.');

    // Iniciar el monitoreo en segundo plano
    startMonitoring();

    // Mostrar mensaje en la UI del editor sin emojis
    vscode.window.showInformationMessage('Agentic Sounds: Activado');

    // Comando de prueba de sonido
    const testCmd = vscode.commands.registerCommand(
      'antigravityAlert.testSound',
      logger.safeRun('Error al ejecutar el comando de prueba de sonido', () => {
        logger.info('Ejecutando comando de prueba de sonido.');
        playSound('complete');
        vscode.window.showInformationMessage('Sonido de prueba ejecutado');
      })
    );

    // Comando para verificar estado
    const statusCmd = vscode.commands.registerCommand(
      'antigravityAlert.status',
      logger.safeRun('Error al ejecutar el comando de estado', () => {
        logger.show();
        vscode.window.showInformationMessage('Agentic Sounds está monitoreando la actividad del agente');
      })
    );

    context.subscriptions.push(testCmd, statusCmd);
    logger.info('Extensión activada exitosamente.');
  })();
}

export async function deactivate(): Promise<void> {
  await logger.safeRun('Error al detener el monitoreo durante la desactivación', async () => {
    logger.info('Desactivando la extensión Agentic Sounds.');
    await stopMonitoring();
  })();
}


