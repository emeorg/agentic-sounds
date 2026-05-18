import * as vscode from 'vscode';
import { playSound, SoundType } from './audio';
import { logger } from './logger';

/**
 * Muestra un modal nativo (QuickPick) interactivo en bucle para visualizar y probar todos los sonidos.
 */
export async function showSoundboard(): Promise<void> {
  interface SoundQuickPickItem extends vscode.QuickPickItem {
    soundType?: SoundType;
  }

  const items: SoundQuickPickItem[] = [
    { label: '$(play) Complete (Éxito)', description: 'Tono al completar un turno o tarea de IA con éxito', soundType: 'complete' },
    { label: '$(shield) Warning (Advertencia)', description: 'Tono ante comandos del sistema o de terminal inseguros', soundType: 'warning' },
    { label: '$(broadcast) Message (Modificación)', description: 'Tono de aviso al editar o generar archivos de código', soundType: 'message' },
    { label: '$(bell) Attention (Atención)', description: 'Tono para solicitar la supervisión del usuario', soundType: 'attention' },
    { label: '$(megaphone) Login (Inicio)', description: 'Tono inicial al activarse el monitor de archivos', soundType: 'login' }
  ];

  const selection = await vscode.window.showQuickPick(items, {
    title: 'Agentic Sounds: Catálogo Interactivo de Sonidos (Haz clic para escuchar)',
    placeHolder: 'Selecciona cualquier tono para reproducir su archivo de audio (Presiona Escape para salir)'
  });

  if (selection && selection.soundType) {
    logger.info(`Probando sonido desde el catálogo modal: ${selection.soundType}`);
    await playSound(selection.soundType);

    // Reabrir el modal para crear un bucle interactivo fluido (Soundboard)
    await showSoundboard();
  }
}
