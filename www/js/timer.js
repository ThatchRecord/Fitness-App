// --- Utilidades de Tiempo y Sonido ---
let audioCtx = null;

function reproducirPitido() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Nota La5
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); // Baja a La4
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn("Audio no permitido aún (requiere interacción):", e);
  }
}

async function vibrarNativo() {
  // Intentar usar el plugin nativo de Capacitor (solo funciona en el APK de Android)
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
      await window.Capacitor.Plugins.Haptics.vibrate({ duration: 1000 });
      return;
    }
  } catch (e) {
    console.warn("Haptics falló, usando fallback web");
  }
  
  // Fallback para navegador web
  if (navigator.vibrate) {
    navigator.vibrate([500, 200, 500]); // Patrón: 500ms vibra, 200 pausa, 500ms vibra
  }
}

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
  if (cronoRunning) {
    // Pausar
    cronoAccumulated += Date.now() - cronoStartTime;
    clearInterval(cronoInterval);
    cronoRunning = false;
    btnCronoStart.textContent = '▶ Reanudar';
    btnCronoStop.style.display = 'block';
  } else {
    // Iniciar
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
let defaultRestSeconds = 60;

const timerDisplay = document.getElementById('timer-display');
const btnTimerStart = document.getElementById('btn-timer-start');
const btnTimerStop = document.getElementById('btn-timer-stop');

window.setRestTime = function(seconds) {
  if (timerRunning) return;
  defaultRestSeconds = seconds;
  timerDisplay.textContent = formatTimeTimer(seconds);
};

function formatTimeTimer(totalSecs) {
  const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
  const s = (totalSecs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerDisplay() {
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((timerEndTime - now) / 1000));
  
  timerDisplay.textContent = formatTimeTimer(remaining);
  
  if (remaining <= 0) {
    clearInterval(timerInterval);
    timerRunning = false;
    timerDisplay.textContent = "¡LISTO!";
    timerDisplay.style.color = "var(--accent)";
    btnTimerStart.textContent = '▶ Iniciar Descanso';
    btnTimerStart.style.display = 'block';
    btnTimerStop.style.display = 'none';
    
    // ALARMA
    vibrarNativo();
    reproducirPitido();
  }
}

btnTimerStart.addEventListener('click', () => {
  if (timerRunning) return; // No hacer nada si ya corre
  
  // Desbloquear audio en el primer toque
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  timerEndTime = Date.now() + (defaultRestSeconds * 1000);
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
  timerDisplay.textContent = formatTimeTimer(defaultRestSeconds);
  timerDisplay.style.color = "var(--text)";
  btnTimerStart.style.display = 'block';
  btnTimerStop.style.display = 'none';
});

// Inicializar display
timerDisplay.textContent = formatTimeTimer(defaultRestSeconds);