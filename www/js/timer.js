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
    
    // Onda cuadrada: suena mucho más fuerte y cortante que la sinusoidal
    osc.type = 'square'; 
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime); // Tono más agudo
    
    // Volumen al máximo
    gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4); // Duración de 0.4 segundos
  } catch (e) {}
}

async function vibrarNativo() {
  // 1. Intentar con el plugin de Capacitor de varias formas
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
    try {
      const Haptics = window.Capacitor.Plugins.Haptics;
      
      // Intentar un impacto fuerte (a veces se siente más que vibrate)
      if (Haptics.impact) {
        await Haptics.impact({ style: 'HEAVY' });
      }
      
      // Intentar la vibración estándar con duración
      if (Haptics.vibrate) {
        await Haptics.vibrate({ duration: 1000 });
      }
      return;
    } catch (e) {
      console.warn("Fallo Haptics nativo:", e);
    }
  }
  
  // 2. Fallback para navegador web (WebView)
  if (navigator.vibrate) {
    // Patrón: 800ms vibrando, 200 pausa, 800ms vibrando
    const exito = navigator.vibrate([800, 200, 800]);
    if (!exito) {
      console.warn("navigator.vibrate bloqueado por el sistema");
    }
  } else {
    console.warn("Este dispositivo no soporta navigator.vibrate");
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

function iniciarAlarma() {
  alarmStartTime = Date.now();
  alarmOverlay.classList.remove('hidden');
  
  // Disparar inmediatamente
  dispararAlerta();

  // Repetir la alerta cada 1.5 segundos (1500 ms)
  alarmLoopInterval = setInterval(dispararAlerta, 1500);

  // Actualizar el contador
  alarmTimerInterval = setInterval(() => {
    const elapsedSecs = Math.floor((Date.now() - alarmStartTime) / 1000);
    alarmElapsed.textContent = `+${formatTimeTimer(elapsedSecs)}`;
  }, 1000);
}

function detenerAlarma() {
  clearInterval(alarmLoopInterval);
  clearInterval(alarmTimerInterval);
  alarmOverlay.classList.add('hidden');
  
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