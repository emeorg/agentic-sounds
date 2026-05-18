import * as vscode from 'vscode';
import { logger } from './logger';
import { playSound } from './audio';

const CONFIG_SECTION = 'agenticSounds';
const VOLUME_KEY = 'volume';

let statusBarItem: vscode.StatusBarItem;

/**
 * Obtiene el nivel de volumen actual configurado (0 a 100).
 */
export function getVolume(): number {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<number>(VOLUME_KEY, 100);
}

/**
 * Actualiza el nivel de volumen en la configuración global de usuario.
 */
export async function updateVolume(volume: number): Promise<void> {
  const sanitizedVolume = Math.max(0, Math.min(100, Math.round(volume)));
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update(VOLUME_KEY, sanitizedVolume, vscode.ConfigurationTarget.Global);
  logger.info(`Volumen global actualizado a: ${sanitizedVolume}%`);
}

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
 * Muestra el menú de selección rápida para ajustar el volumen.
 */
export async function showVolumePicker(): Promise<void> {
  const currentVolume = getVolume();
  
  interface VolumeQuickPickItem extends vscode.QuickPickItem {
    volumeValue?: number;
    isCustom?: boolean;
  }

  const items: VolumeQuickPickItem[] = [
    {
      label: '$(unmute) 100% (Máximo)',
      description: currentVolume === 100 ? 'Actual' : '',
      volumeValue: 100
    },
    {
      label: '$(unmute) 75% (Alto)',
      description: currentVolume === 75 ? 'Actual' : '',
      volumeValue: 75
    },
    {
      label: '$(unmute) 50% (Medio)',
      description: currentVolume === 50 ? 'Actual' : '',
      volumeValue: 50
    },
    {
      label: '$(unmute) 25% (Bajo)',
      description: currentVolume === 25 ? 'Actual' : '',
      volumeValue: 25
    },
    {
      label: '$(mute) 0% (Silenciado)',
      description: currentVolume === 0 ? 'Actual' : '',
      volumeValue: 0
    },
    {
      label: '$(gear) Personalizado...',
      description: 'Ingresar un valor exacto entre 0 y 100',
      isCustom: true
    }
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

  // Probar sonido al nuevo volumen si no está silenciado
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
  // Crear ícono en la barra de estado
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'antigravityAlert.setVolume';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  // Registrar comando de ajuste de volumen
  const setVolumeCmd = vscode.commands.registerCommand(
    'antigravityAlert.setVolume',
    logger.safeRun('Error al abrir el selector de volumen', async () => {
      await showVolumePicker();
    })
  );
  context.subscriptions.push(setVolumeCmd);

  // Escuchar cambios de configuración externa (ej. si el usuario edita settings.json)
  const configListener = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration(`${CONFIG_SECTION}.${VOLUME_KEY}`)) {
      updateStatusBar();
      logger.info(`Cambio detectado en la configuración de volumen. Nuevo nivel: ${getVolume()}%`);
    }
  });
  context.subscriptions.push(configListener);

  logger.info('Control de volumen inicializado correctamente.');
}
