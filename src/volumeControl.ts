import * as vscode from 'vscode';
import { logger } from './logger';
import { playSound } from './audio';
import { getVolume, updateVolume, CONFIG_SECTION, VOLUME_KEY } from './config';

let statusBarItem: vscode.StatusBarItem;

/**
 * Actualiza el aspecto visual del ícono de la barra de estado según el volumen actual.
 */
function updateStatusBar(): void {
  if (!statusBarItem) {
    return;
  }
  const currentVolume = getVolume();
  const icon = currentVolume === 0 ? '$(mute)' : currentVolume < 50 ? '$(unmute)' : '$(unmute)';
  statusBarItem.text = `${icon} Vol: ${currentVolume}%`;
  statusBarItem.tooltip = `Agentic Sounds: Volumen actual ${currentVolume}% (Haz clic para ajustar)`;
  statusBarItem.show();
}

/**
 * Muestra el menú nativo (QuickPick) para ajustar el volumen.
 */
export async function showVolumePicker(): Promise<void> {
  const currentVolume = getVolume();
  
  interface VolumeQuickPickItem extends vscode.QuickPickItem {
    volumeValue?: number;
    isCustom?: boolean;
  }

  const items: VolumeQuickPickItem[] = [
    { label: '$(unmute) 100% (Máximo)', description: currentVolume === 100 ? 'Actual' : '', volumeValue: 100 },
    { label: '$(unmute) 75% (Alto)', description: currentVolume === 75 ? 'Actual' : '', volumeValue: 75 },
    { label: '$(unmute) 50% (Medio)', description: currentVolume === 50 ? 'Actual' : '', volumeValue: 50 },
    { label: '$(unmute) 25% (Bajo)', description: currentVolume === 25 ? 'Actual' : '', volumeValue: 25 },
    { label: '$(mute) 0% (Silenciado)', description: currentVolume === 0 ? 'Actual' : '', volumeValue: 0 },
    { label: '$(gear) Personalizado...', description: 'Ingresar un valor exacto entre 0 y 100', isCustom: true }
  ];

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: `Selecciona el volumen para las notificaciones (Actual: ${currentVolume}%)`
  });

  if (!selection) {
    return;
  }

  let newVolume = currentVolume;

  if (selection.isCustom) {
    const input = await vscode.window.showInputBox({
      prompt: 'Ingresa el nivel de volumen (0 a 100)',
      value: String(currentVolume),
      validateInput: (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0 || num > 100) {
          return 'Por favor ingresa un número válido entre 0 y 100';
        }
        return null;
      }
    });

    if (input === undefined) {
      return;
    }
    newVolume = parseInt(input, 10);
  } else if (selection.volumeValue !== undefined) {
    newVolume = selection.volumeValue;
  }

  await updateVolume(newVolume);
  updateStatusBar();

  if (newVolume > 0) {
    playSound('complete');
  } else {
    vscode.window.showInformationMessage('Agentic Sounds: Notificaciones silenciadas');
  }
}

/**
 * Inicializa el control de volumen, registrando comandos, eventos y barra de estado.
 */
export function initVolumeControl(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'antigravityAlert.setVolume';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  const setVolumeCmd = vscode.commands.registerCommand(
    'antigravityAlert.setVolume',
    logger.safeRun('Error al abrir el selector de volumen', async () => {
      await showVolumePicker();
    })
  );
  context.subscriptions.push(setVolumeCmd);

  const configListener = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration(`${CONFIG_SECTION}.${VOLUME_KEY}`)) {
      updateStatusBar();
      logger.info(`Cambio detectado en la configuración de volumen. Nuevo nivel: ${getVolume()}%`);
    }
  });
  context.subscriptions.push(configListener);

  logger.info('Control de volumen inicializado correctamente con config central.');
}
