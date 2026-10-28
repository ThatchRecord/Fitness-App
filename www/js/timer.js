// --- 1. Utilidades de Sonido y Permisos ---
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
    
    // Onda cuadrada para que suene fuerte y agudo
    osc.type = 'square'; 
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
    
    // Volumen al máximo
    gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {}
}

// --- 2. Integraciones Nativas (Vibración, Linterna, Servicios) ---
async function vibrarNativo() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
    try {
      const Haptics = window.Capacitor.Plugins.Haptics;
      if (Haptics.impact) await Haptics.impact({ style: 'HEAVY' });
      if (Haptics.vibrate) await Haptics.vibrate({ duration: 800 });
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

async function iniciarServicioPrimerPlano() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ForegroundService) {
    try {
      await window.Capacitor.Plugins.ForegroundService.start({
        id: 1,
        title: 'Descanso Activo',
        message: 'El temporizador está en marcha.',
        serviceType: 'specialUse' // Requerido en Android 14+ para alarmas/timers
      });
    } catch (e) {
      console.warn("No se pudo iniciar el servicio en primer plano:", e);
    }
  }
}

async function detenerServicioPrimerPlano() {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ForegroundService) {
    try {
      await window.Capacitor.Plugins.ForegroundService.stop();
    } catch (e) {}
  }
}

async function dispararAlertaNativa() {
  // 1. Intentar programar alarma nativa
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AlarmNotification) {
    try {
      await window.Capacitor.Plugins.AlarmNotification.setAlarm({
        delay: 0,
        title: "¡Descanso terminado!",
        message: "Es hora de la siguiente serie.",
        id: "rest-timer"
      });
    } catch (e) {}
  }
}

// --- 3. Lógica de la Interfaz de Alarma (Bucle) ---
let alarmLoopInterval = null;
let alarmTimerInterval = null;
let alarmStartTime = 0;

const alarmOverlay = document.getElementById('alarm-overlay');
const alarmElapsed = document.getElementById('alarm-elapsed');
const btnStopAlarm = document.getElementById('btn-stop-alarm');

function dispararAlertaVisualSonora() {
  reproducirPitido();
  vibrarNativo();
  parpadearLinterna();
}

async function iniciarAlarma() {
  alarmStartTime = Date.now();
  alarmOverlay.classList.remove('hidden');
  
  // 1. Levantar el servicio prioritario
  await iniciarServicioPrimerPlano();
  
  // 2. Disparar alarma nativa
  await dispararAlertaNativa();

  // 3. Primer aviso inmediato
  dispararAlertaVisualSonora();

  // 4. Bucle de repetición cada 1.5s
  alarmLoopInterval = setInterval(dispararAlertaVisualSonora, 1500);

  // 5. Actualizar contador de tiempo desde que sonó
  alarmTimerInterval = setInterval(() => {
    const elapsedSecs = Math.floor((Date.now() - alarmStartTime) / 1000);
    alarmElapsed.textContent = `+${formatTimeTimer(elapsedSecs)}`;
  }, 1000);
}

async function detenerAlarma() {
  clearInterval(alarmLoopInterval);
  clearInterval(alarmTimerInterval);
  alarmOverlay.classList.add('hidden');
  
  // 1. Bajar el servicio prioritario
  await detenerServicioPrimerPlano();

  // 2. Cancelar la alarma nativa
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AlarmNotification) {
    try {
      await window.Capacitor.Plugins.AlarmNotification.cancelAlarm();
    } catch (e) {}
  }

  // 3. Asegurar que la linterna se apaga
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Torch) {
    window.Capacitor.Plugins.Torch.disable().catch(() => {});
  }
}

if (btnStopAlarm) {
  btnStopAlarm.addEventListener('click', detenerAlarma);
}

// --- 4. Lógica del Cronómetro ---
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

if (btnCronoStart) {
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
}

if (btnCronoStop) {
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
}

// --- 5. Lógica del Temporizador de Descanso ---
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

if (btnTimerStart) {
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
}

if (btnTimerStop) {
  btnTimerStop.addEventListener('click', () => {
    clearInterval(timerInterval);
    timerRunning = false;
    timerDisplay.textContent = formatTimeTimer(defaultRestMinutes * 60);
    timerDisplay.style.color = "var(--text)";
    btnTimerStart.style.display = 'block';
    btnTimerStop.style.display = 'none';
  });
}

// Inicializar display
timerDisplay.textContent = formatTimeTimer(defaultRestMinutes * 60);