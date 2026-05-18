import * as vscode from 'vscode';
import { startMonitoring, stopMonitoring } from './watcher';
import { playSound } from './audio';
import { logger } from './logger';
import { initVolumeControl } from './volumeControl';
import { showSoundboard } from './soundboard';

export function activate(context: vscode.ExtensionContext) {
  logger.safeRun('Error crítico durante la activación de la extensión', () => {
    logger.info('Iniciando activación de la extensión Agentic Sounds en el IDE.');

    // Inicializar el control de volumen en la barra de estado
    initVolumeControl(context);

    // Inicializar botón del Catálogo Modal (Soundboard) en la barra de estado
    const soundboardStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    soundboardStatusBarItem.command = 'antigravityAlert.soundboard';
    soundboardStatusBarItem.text = '$(megaphone) Catálogo';
    soundboardStatusBarItem.tooltip = 'Agentic Sounds: Abrir catálogo interactivo de sonidos (Soundboard)';
    soundboardStatusBarItem.show();
    context.subscriptions.push(soundboardStatusBarItem);

    // Iniciar el monitoreo en segundo plano
    startMonitoring();

    // Mostrar mensaje de activación en el editor
    vscode.window.showInformationMessage('Agentic Sounds: Activado');

    // Comando de catálogo de sonidos (Soundboard modal)
    const soundboardCmd = vscode.commands.registerCommand(
      'antigravityAlert.soundboard',
      logger.safeRun('Error al abrir el catálogo de sonidos', async () => {
        await showSoundboard();
      })
    );

    // Comando de prueba de sonido directo
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

    context.subscriptions.push(soundboardCmd, testCmd, statusCmd);
    logger.info('Extensión activada exitosamente.');
  })();
}

export async function deactivate(): Promise<void> {
  await logger.safeRun('Error al detener el monitoreo durante la desactivación', async () => {
    logger.info('Desactivando la extensión Agentic Sounds.');
    await stopMonitoring();
  })();
}
