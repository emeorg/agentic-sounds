import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

const SOUNDS_DIR = path.resolve(__dirname, '../sounds');
const DEFAULT_TONE = path.join(SOUNDS_DIR, 'complete.mp3');

const SOUND_IDS = {
  complete: 'complete',
  warning: 'dialog-warning',
  attention: 'window-attention',
  message: 'message',
  login: 'service-login'
} as const;

const SOUND_FILES = {
  complete: path.join(SOUNDS_DIR, 'complete.mp3'),
  warning: path.join(SOUNDS_DIR, 'warning.mp3'),
  attention: path.join(SOUNDS_DIR, 'attention.mp3'),
  message: path.join(SOUNDS_DIR, 'message.mp3'),
  login: path.join(SOUNDS_DIR, 'login.mp3')
} as const;

export type SoundType = keyof typeof SOUND_IDS;

interface ExecCommand {
  bin: string;
  args: string[];
}

let cachedPlayerTemplate: ((file: string, id: string) => ExecCommand) | null = null;

/**
 * Ejecuta directamente un archivo binario en el kernel pasándole los argumentos en un vector limpio.
 * Inmune a la inyección de comandos de shell (CWE-78) y evita alarmas heurísticas de consolas ocultas.
 */
function runExecFileCommand(cmd: ExecCommand, timeoutMs: number = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd.bin, cmd.args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Reproduce un archivo de sonido adaptándose dinámicamente al sistema operativo (Windows, macOS o Linux).
 * Implementa un mecanismo de caché para usar el reproductor exitoso y evitar lanzar procesos redundantes.
 */
export async function playSound(type: SoundType): Promise<void> {
  let file = SOUND_FILES[type];
  const id = SOUND_IDS[type];

  if (!fs.existsSync(file)) {
    logger.warn(`El archivo personalizado '${file}' no existe. Usando tono de respaldo por defecto.`);
    file = DEFAULT_TONE;
  }

  logger.info(`Intentando reproducir sonido de tipo: '${type}' (${file}) en plataforma '${process.platform}'`);

  // Si ya tenemos un reproductor en caché que funcionó previamente, lo probamos primero
  if (cachedPlayerTemplate) {
    const cmd = cachedPlayerTemplate(file, id);
    try {
      await runExecFileCommand(cmd);
      logger.info(`Sonido '${type}' reproducido con reproductor en caché: ${cmd.bin}`);
      return;
    } catch (error) {
      logger.warn(`El reproductor en caché falló (${cmd.bin}), buscando otra alternativa...`, error);
      cachedPlayerTemplate = null; // Invalida la caché si falla
    }
  }

  const VOLUME = 1.0; // 100% (0dB). Valores > 1.0 saturan el servidor PipeWire/PulseAudio y activan el limitador de recorte bajando la ganancia real.
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  let playerOptions: Array<{ name: string; getCmd: (f: string, i: string) => ExecCommand }> = [];

  if (isWin) {
    playerOptions = [
      { 
        name: 'powershell (WMPlayer)', 
        getCmd: (f: string) => ({
          bin: 'powershell',
          args: [
            '-WindowStyle', 'Hidden',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `$player = New-Object -ComObject WMPlayer.OCX; $player.URL = '${f}'; $player.controls.play(); while($player.playState -ne 1){ Start-Sleep -Milliseconds 100 }`
          ]
        })
      },
      {
        name: 'powershell (SoundPlayer)',
        getCmd: (f: string) => ({
          bin: 'powershell',
          args: [
            '-WindowStyle', 'Hidden',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `(New-Object System.Media.SoundPlayer '${f}').PlaySync()`
          ]
        })
      }
    ];
  } else if (isMac) {
    playerOptions = [
      { name: 'afplay', getCmd: (f: string) => ({ bin: 'afplay', args: [f] }) },
      { name: 'mpv', getCmd: (f: string) => ({ bin: 'mpv', args: ['--no-video', f] }) }
    ];
  } else {
    // Linux
    playerOptions = [
      { name: 'pw-play', getCmd: (f: string) => ({ bin: 'pw-play', args: [`--volume=${VOLUME}`, f] }) },
      { name: 'mpv', getCmd: (f: string) => ({ bin: 'mpv', args: ['--no-video', `--volume=${Math.round(VOLUME * 100)}`, f] }) },
      { name: 'mpg123', getCmd: (f: string) => ({ bin: 'mpg123', args: ['-f', '49152', f] }) },
      { name: 'paplay', getCmd: (f: string) => ({ bin: 'paplay', args: [f] }) },
      { name: 'ffplay', getCmd: (f: string) => ({ bin: 'ffplay', args: ['-nodisp', '-autoexit', '-volume', '100', f] }) },
      { name: 'play', getCmd: (f: string) => ({ bin: 'play', args: [f, 'vol', String(VOLUME)] }) },
      { name: 'canberra-gtk-play (file)', getCmd: (f: string) => ({ bin: 'canberra-gtk-play', args: [`--file=${f}`] }) },
      { name: 'canberra-gtk-play (id)', getCmd: (f: string, i: string) => ({ bin: 'canberra-gtk-play', args: [`--id=${i}`] }) }
    ];
  }

  let success = false;
  for (const player of playerOptions) {
    const cmd = player.getCmd(file, id);
    try {
      await runExecFileCommand(cmd);
      success = true;
      cachedPlayerTemplate = player.getCmd;
      logger.info(`Sonido '${type}' reproducido correctamente y guardado en caché con: ${player.name}`);
      break;
    } catch (error) {
      logger.warn(`Intento fallido con reproductor ${player.name}:`, error);
    }
  }

  if (!success) {
    logger.warn(`Falló la reproducción del sonido '${type}' tras probar todos los reproductores disponibles en ${process.platform}.`);
  }
}
