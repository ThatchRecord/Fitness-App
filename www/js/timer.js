// --- Utilidades de Tiempo y Sonido ---
let audioCtx = null;

function desbloquearAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function reproducirPitido() {
  try {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'square'; 
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {}
}

async function vibrarNativo() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
    try {
      const Haptics = window.Capacitor.Plugins.Haptics;
      if (Haptics.impact) {
        await Haptics.impact({ style: 'HEAVY' });
      }
      if (Haptics.vibrate) {
        await Haptics.vibrate({ duration: 800 });
      }
      return;
    } catch (e) {}
  }
  if (navigator.vibrate) {
    navigator.vibrate([800, 200, 800]);
  }
}

async function parpadearLinterna() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Torch) {
    try {
      const Torch = window.Capacitor.Plugins.Torch;
      await Torch.enable();
      setTimeout(async () => {
        await Torch.disable();
        setTimeout(async () => {
          await Torch.enable();
          setTimeout(() => Torch.disable(), 250);
        }, 250);
      }, 250);
    } catch (e) {}
  }
}

function dispararAlerta() {
  reproducirPitido();
  vibrarNativo();
  parpadearLinterna();
}

// --- Variables de Estado de la Alarma ---
let alarmLoopInterval = null;
let alarmTimerInterval = null;
let alarmStartTime = 0;

const alarmOverlay = document.getElementById('alarm-overlay');
const alarmElapsed = document.getElementById('alarm-elapsed');
const btnStopAlarm = document.getElementById('btn-stop-alarm');

// --- Inicialización del Plugin de Alarma ---
async function initAlarmPlugin() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AlarmNotification) {
    try {
      const Alarm = window.Capacitor.Plugins.AlarmNotification;
      const { hasPermission } = await Alarm.checkPermission();
      if (!hasPermission) {
        await Alarm.requestPermission();
      }
    } catch (e) {
      console.warn("No se pudo inicializar el plugin de alarma:", e);
    }
  }
}
initAlarmPlugin();

// --- Lógica de la Alarma ---
async function iniciarAlarma() {
  alarmStartTime = Date.now();
  alarmOverlay.classList.remove('hidden');
  
  // 1. Disparar la alarma nativa para despertar el dispositivo con prioridad
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AlarmNotification) {
    try {
      await window.Capacitor.Plugins.AlarmNotification.setAlarm({
        delay: 0,
        title: "¡Descanso terminado!",
        message: "Es hora de la siguiente serie.",
        id: "rest-timer"
      });
    } catch (e) {
      console.warn("Error al lanzar la alarma nativa:", e);
    }
  }

  // 2. Primer aviso inmediato (sonido/vibración/flash)
  dispararAlerta();

  // 3. Bucle de repetición cada 1.5 segundos
  alarmLoopInterval = setInterval(dispararAlerta, 1500);

  // 4. Contador de tiempo transcurrido desde que sonó
  alarmTimerInterval = setInterval(() => {
    const elapsedSecs = Math.floor((Date.now() - alarmStartTime) / 1000);
    alarmElapsed.textContent = `+${formatTimeTimer(elapsedSecs)}`;
  }, 1000);
}

async function detenerAlarma() {
  clearInterval(alarmLoopInterval);
  clearInterval(alarmTimerInterval);
  alarmOverlay.classList.add('hidden');
  
  // Cancelar la alarma nativa
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AlarmNotification) {
    try {
      await window.Capacitor.Plugins.AlarmNotification.cancelAlarm();
    } catch (e) {}
  }

  // Apagar linterna si quedó encendida
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Torch) {
    window.Capacitor.Plugins.Torch.disable().catch(() => {});
  }
}

btnStopAlarm.addEventListener('click', detenerAlarma);

// --- Lógica del Cronómetro ---
let cronoStartTime = 0;
let cronoAccumulated = 0;
let cronoInterval = null;
let cronoRunning = false;

const cronoDisplay = document.getElementById('cronometro-display');
const btnCronoStart = document.getElementById('btn-crono-start');
const btnCronoStop = document.getElementById('btn-crono-stop');

function formatTime(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSecs % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateCronoDisplay() {
  const now = Date.now();
  const elapsed = cronoAccumulated + (now - cronoStartTime);
  cronoDisplay.textContent = formatTime(elapsed);
}

btnCronoStart.addEventListener('click', () => {
  desbloquearAudio();
  if (cronoRunning) {
    cronoAccumulated += Date.now() - cronoStartTime;
    clearInterval(cronoInterval);
    cronoRunning = false;
    btnCronoStart.textContent = '▶ Reanudar';
    btnCronoStop.style.display = 'block';
  } else {
    cronoStartTime = Date.now();
    cronoInterval = setInterval(updateCronoDisplay, 1000);
    cronoRunning = true;
    btnCronoStart.textContent = '⏸ Pausar';
    btnCronoStop.style.display = 'none';
    updateCronoDisplay();
  }
});

btnCronoStop.addEventListener('click', () => {
  clearInterval(cronoInterval);
  cronoRunning = false;
  const finalTime = cronoAccumulated + (Date.now() - cronoStartTime);
  alert(`Entrenamiento guardado: ${formatTime(finalTime)}`);
  cronoAccumulated = 0;
  cronoDisplay.textContent = '00:00:00';
  btnCronoStart.textContent = '▶ Iniciar';
  btnCronoStop.style.display = 'none';
});

// --- Lógica del Temporizador de Descanso ---
let timerInterval = null;
let timerEndTime = 0;
let timerRunning = false;
let defaultRestMinutes = 1;

const timerDisplay = document.getElementById('timer-display');
const btnTimerStart = document.getElementById('btn-timer-start');
const btnTimerStop = document.getElementById('btn-timer-stop');

window.setRestTime = function(minutes) {
  if (timerRunning || !alarmOverlay.classList.contains('hidden')) return;
  defaultRestMinutes = minutes;
  timerDisplay.textContent = formatTimeTimer(minutes * 60);
};

window.setRestTimeCustom = function() {
  if (timerRunning || !alarmOverlay.classList.contains('hidden')) return;
  const input = prompt("Introduce los minutos de descanso (ej: 1.5):", defaultRestMinutes);
  if (input === null) return;
  
  const min = parseFloat(input);
  if (!isNaN(min) && min > 0) {
    setRestTime(min);
  } else {
    alert("Por favor, introduce un número válido mayor que 0.");
  }
};

function formatTimeTimer(totalSecs) {
  const m = Math.floor(totalSecs / 60).toString().padStart(1, '0');
  const s = Math.floor(totalSecs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((timerEndTime - now) / 1000));
  
  timerDisplay.textContent = formatTimeTimer(remaining);
  
  if (remaining <= 0) {
    clearInterval(timerInterval);
    timerRunning = false;
    
    timerDisplay.textContent = "0:00";
    btnTimerStart.textContent = '▶ Iniciar Descanso';
    btnTimerStart.style.display = 'block';
    btnTimerStop.style.display = 'none';
    
    iniciarAlarma();
  }
}

btnTimerStart.addEventListener('click', () => {
  if (timerRunning || !alarmOverlay.classList.contains('hidden')) return;
  
  desbloquearAudio();

  timerEndTime = Date.now() + (defaultRestMinutes * 60 * 1000);
  timerInterval = setInterval(updateTimerDisplay, 200);
  timerRunning = true;
  
  timerDisplay.style.color = "var(--text)";
  btnTimerStart.style.display = 'none';
  btnTimerStop.style.display = 'block';
  updateTimerDisplay();
});

btnTimerStop.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerDisplay.textContent = formatTimeTimer(defaultRestMinutes * 60);
  timerDisplay.style.color = "var(--text)";
  btnTimerStart.style.display = 'block';
  btnTimerStop.style.display = 'none';
});

// Inicializar display
timerDisplay.textContent = formatTimeTimer(defaultRestMinutes * 60);