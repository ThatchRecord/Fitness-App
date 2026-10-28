// --- Utilidades de Tiempo y Sonido ---
let audioCtx = null;

function desbloquearAudio() {
  // Se llama en el primer toque para evitar el bloqueo de Android
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
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.warn("Error al reproducir audio:", e);
  }
}

async function alertaFinTemporizador() {
  // 1. Sonido
  reproducirPitido();

  // 2. Vibración
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
    try {
      await window.Capacitor.Plugins.Haptics.vibrate({ duration: 1000 });
    } catch (e) { console.warn("Haptics error", e); }
  } else if (navigator.vibrate) {
    navigator.vibrate([500, 200, 500, 200, 500]); // Patrón largo
  }

  // 3. Linterna (Flash)
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Torch) {
    try {
      const Torch = window.Capacitor.Plugins.Torch;
      await Torch.enable();
      // Parpadeo: apagar y encender a los 300ms
      setTimeout(async () => {
        await Torch.disable();
        setTimeout(async () => {
          await Torch.enable();
          setTimeout(() => Torch.disable(), 300);
        }, 300);
      }, 300);
    } catch (e) {
      console.warn("Error con la linterna (quizás no hay hardware o permisos):", e);
    }
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
  desbloquearAudio(); // Desbloquear sonido
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
  if (timerRunning) return;
  defaultRestMinutes = minutes;
  timerDisplay.textContent = formatTimeTimer(minutes * 60);
};

window.setRestTimeCustom = function() {
  if (timerRunning) return;
  const input = prompt("Introduce los minutos de descanso (puedes usar decimales, ej: 1.5):", defaultRestMinutes);
  if (input === null) return; // Cancelado
  
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
    timerDisplay.textContent = "¡LISTO!";
    timerDisplay.style.color = "var(--accent)";
    btnTimerStart.textContent = '▶ Iniciar Descanso';
    btnTimerStart.style.display = 'block';
    btnTimerStop.style.display = 'none';
    
    alertaFinTemporizador();
  }
}

btnTimerStart.addEventListener('click', () => {
  if (timerRunning) return;
  
  desbloquearAudio(); // CRUCIAL: desbloquear audio en el toque

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