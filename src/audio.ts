import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';
import { getVolume, getCooldownMs } from './config';

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

interface AudioJob {
  type: SoundType;
  resolve: () => void;
  reject: (err: any) => void;
}

let cachedPlayerTemplate: ((file: string, id: string, vf: number, vp: number) => ExecCommand) | null = null;

// Control de concurrencia y ráfagas
const audioQueue: AudioJob[] = [];
let isPlaying = false;
const lastPlayedTimestamps: Record<SoundType, number> = {
  complete: 0,
  warning: 0,
  attention: 0,
  message: 0,
  login: 0
};

/**
 * Ejecuta directamente un archivo binario en el kernel pasándole los argumentos en un vector limpio.
 * Inmune a la inyección de comandos de shell (CWE-78).
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
 * Procesa secuencialmente los trabajos de audio en la cola (FIFO).
 */
async function processAudioQueue(): Promise<void> {
  if (isPlaying || audioQueue.length === 0) {
    return;
  }

  isPlaying = true;
  const job = audioQueue.shift()!;

  try {
    await executeAudioProcess(job.type);
    job.resolve();
  } catch (err) {
    job.reject(err);
  } finally {
    isPlaying = false;
    // Continuar procesando la cola
    processAudioQueue();
  }
}

/**
 * Lógica central que lanza el proceso del sistema operativo para reproducir el audio.
 */
async function executeAudioProcess(type: SoundType): Promise<void> {
  let file = SOUND_FILES[type];
  const id = SOUND_IDS[type];

  if (!fs.existsSync(file)) {
    logger.warn(`El archivo personalizado '${file}' no existe. Usando tono de respaldo por defecto.`);
    file = DEFAULT_TONE;
  }

  const volPercent = getVolume();
  if (volPercent === 0) {
    logger.info(`Notificación sonora omitida para '${type}': el volumen está configurado en 0% (Silenciado).`);
    return;
  }

  const volFactor = Number((volPercent / 100).toFixed(2));
  logger.info(`Reproduciendo sonido '${type}' (${file}) al ${volPercent}% en plataforma '${process.platform}'`);

  if (cachedPlayerTemplate) {
    const cmd = cachedPlayerTemplate(file, id, volFactor, volPercent);
    try {
      await runExecFileCommand(cmd);
      logger.info(`Sonido '${type}' reproducido con reproductor en caché al ${volPercent}%: ${cmd.bin}`);
      return;
    } catch (error) {
      logger.warn(`El reproductor en caché falló (${cmd.bin}), buscando otra alternativa...`, error);
      cachedPlayerTemplate = null;
    }
  }

  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  let playerOptions: Array<{ name: string; getCmd: (f: string, i: string, vf: number, vp: number) => ExecCommand }> = [];

  if (isWin) {
    playerOptions = [
      { 
        name: 'powershell (WMPlayer)', 
        getCmd: (f: string, i: string, vf: number, vp: number) => ({
          bin: 'powershell',
          args: [
            '-WindowStyle', 'Hidden',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `$player = New-Object -ComObject WMPlayer.OCX; $player.settings.volume = ${vp}; $player.URL = '${f}'; $player.controls.play(); while($player.playState -ne 1){ Start-Sleep -Milliseconds 100 }`
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
      { name: 'afplay', getCmd: (f: string, i: string, vf: number) => ({ bin: 'afplay', args: ['-v', String(vf), f] }) },
      { name: 'mpv', getCmd: (f: string, i: string, vf: number, vp: number) => ({ bin: 'mpv', args: ['--no-video', `--volume=${vp}`, f] }) }
    ];
  } else {
    // Linux
    playerOptions = [
      { name: 'pw-play', getCmd: (f: string, i: string, vf: number) => ({ bin: 'pw-play', args: [`--volume=${vf}`, f] }) },
      { name: 'mpv', getCmd: (f: string, i: string, vf: number, vp: number) => ({ bin: 'mpv', args: ['--no-video', `--volume=${vp}`, f] }) },
      { name: 'mpg123', getCmd: (f: string, i: string, vf: number, vp: number) => ({ bin: 'mpg123', args: ['-f', String(Math.round(49152 * vf)), f] }) },
      { name: 'paplay', getCmd: (f: string, i: string, vf: number) => ({ bin: 'paplay', args: [`--volume=${Math.round(65536 * vf)}`, f] }) },
      { name: 'ffplay', getCmd: (f: string, i: string, vf: number, vp: number) => ({ bin: 'ffplay', args: ['-nodisp', '-autoexit', '-volume', String(vp), f] }) },
      { name: 'play', getCmd: (f: string, i: string, vf: number) => ({ bin: 'play', args: [f, 'vol', String(vf)] }) },
      { name: 'canberra-gtk-play (file)', getCmd: (f: string) => ({ bin: 'canberra-gtk-play', args: [`--file=${f}`] }) },
      { name: 'canberra-gtk-play (id)', getCmd: (f: string, i: string) => ({ bin: 'canberra-gtk-play', args: [`--id=${i}`] }) }
    ];
  }

  let success = false;
  for (const player of playerOptions) {
    const cmd = player.getCmd(file, id, volFactor, volPercent);
    try {
      await runExecFileCommand(cmd);
      success = true;
      cachedPlayerTemplate = player.getCmd;
      logger.info(`Sonido '${type}' reproducido correctamente al ${volPercent}% y guardado en caché con: ${player.name}`);
      break;
    } catch (error) {
      logger.warn(`Intento fallido con reproductor ${player.name}:`, error);
    }
  }

  if (!success) {
    logger.warn(`Falló la reproducción del sonido '${type}' tras probar todos los reproductores disponibles en ${process.platform}.`);
  }
}

/**
 * Reproduce un archivo de sonido encolándolo de forma segura y evitando saturación por ráfagas idénticas.
 */
export function playSound(type: SoundType): Promise<void> {
  const now = Date.now();
  const cooldownMs = getCooldownMs();

  // Control de ráfagas (debouncer / cooldown)
  if (now - lastPlayedTimestamps[type] < cooldownMs) {
    logger.info(`Ráfaga de notificaciones detectada para '${type}'. Omitiendo sonido redundante (cooldown ${cooldownMs}ms).`);
    return Promise.resolve();
  }

  lastPlayedTimestamps[type] = now;

  return new Promise((resolve, reject) => {
    audioQueue.push({ type, resolve, reject });
    processAudioQueue();
  });
}
