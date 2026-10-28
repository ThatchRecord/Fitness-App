// --- Base de Datos (Ampliación) ---
// Instanciamos la misma base de datos 'FitnessAppDB' para añadir nuevas tablas
const dbWorkout = new Dexie('FitnessAppDB');
dbWorkout.version(2).stores({
  medidas: '++id, fecha', // Mantener la tabla anterior
  sesiones: '++id, fecha',
  series: '++id, sesionId, ejercicio'
});

// --- Estado de la Sesión Actual ---
let sesionActual = {
  ejercicios: [] // Array de objetos: { nombre: string, series: [] }
};

const listaEjerciciosSesion = document.getElementById('lista-ejercicios-sesion');
const inputNuevoEjercicio = document.getElementById('nuevo-ejercicio-nombre');
const btnAddEjercicio = document.getElementById('btn-add-ejercicio');
const btnCronoStop = document.getElementById('btn-crono-stop'); // El botón que dice "Terminar y Guardar"

// --- Función para renderizar la lista de ejercicios en pantalla ---
function renderizarSesion() {
  listaEjerciciosSesion.innerHTML = '';

  if (sesionActual.ejercicios.length === 0) {
    listaEjerciciosSesion.innerHTML = '<p class="placeholder" style="font-size: 14px;">Añade un ejercicio para empezar a registrar series.</p>';
    return;
  }

  sesionActual.ejercicios.forEach((ejercicio, indexEj) => {
    const card = document.createElement('div');
    card.className = 'ejercicio-card';
    
    // Cabecera del ejercicio
    card.innerHTML = `
      <div class="ejercicio-header">
        <span>${ejercicio.nombre}</span>
        <button class="btn-borrar-ejercicio" data-index="${indexEj}" style="background:none; border:none; color: #ef4444; cursor:pointer; font-size: 18px;">🗑️</button>
      </div>
    `;

    // Contenedor de series
    const setsContainer = document.createElement('div');
    setsContainer.id = `sets-${indexEj}`;

    ejercicio.series.forEach((serie, indexSerie) => {
      const setRow = document.createElement('div');
      setRow.className = 'set-row';
      // Añadimos inputs controlados por eventos onchange
      setRow.innerHTML = `
        <input type="number" step="0.5" placeholder="Kg" value="${serie.peso}" onchange="actualizarSerie(${indexEj}, ${indexSerie}, 'peso', this.value)">
        <input type="number" step="1" placeholder="Reps" value="${serie.reps}" onchange="actualizarSerie(${indexEj}, ${indexSerie}, 'reps', this.value)">
        <input type="number" step="1" placeholder="RIR" value="${serie.rir}" onchange="actualizarSerie(${indexEj}, ${indexSerie}, 'rir', this.value)">
        <button onclick="borrarSerie(${indexEj}, ${indexSerie})">✖</button>
      `;
      setsContainer.appendChild(setRow);
    });

    // Botón para añadir serie
    const btnAddSet = document.createElement('button');
    btnAddSet.className = 'btn-small-add';
    btnAddSet.textContent = '+ Añadir Serie';
    btnAddSet.onclick = () => {
      sesionActual.ejercicios[indexEj].series.push({ peso: '', reps: '', rir: '' });
      renderizarSesion();
    };
    setsContainer.appendChild(btnAddSet);
    
    card.appendChild(setsContainer);
    listaEjerciciosSesion.appendChild(card);
  });

  // Añadir eventos a los botones de borrar ejercicio (delegación de eventos)
  document.querySelectorAll('.btn-borrar-ejercicio').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index);
      sesionActual.ejercicios.splice(idx, 1);
      renderizarSesion();
    });
  });
}

// --- Añadir un nuevo ejercicio (CORREGIDO CON ID) ---
if (btnAddEjercicio) {
  btnAddEjercicio.addEventListener('click', () => {
    const nombre = inputNuevoEjercicio.value.trim();
    if (!nombre) return;

    // Añadir una serie vacía por defecto
    sesionActual.ejercicios.push({
      nombre: nombre,
      series: [{ peso: '', reps: '', rir: '' }]
    });
    
    inputNuevoEjercicio.value = '';
    renderizarSesion();
  });
}

// Permitir añadir ejercicio pulsando "Enter" en el teclado
if (inputNuevoEjercicio) {
  inputNuevoEjercicio.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      btnAddEjercicio.click();
    }
  });
}

// --- Actualizar valores de series (Peso, Reps, RIR) ---
window.actualizarSerie = function(indexEj, indexSerie, campo, valor) {
  sesionActual.ejercicios[indexEj].series[indexSerie][campo] = valor;
};

// --- Borrar una serie ---
window.borrarSerie = function(indexEj, indexSerie) {
  sesionActual.ejercicios[indexEj].series.splice(indexSerie, 1);
  renderizarSesion();
};

// --- Conectar con el Cronómetro para guardar la sesión ---
// Clonamos el botón para eliminar el event listener original de timer.js
// y poder asignarle la lógica de guardado sin que se dispare dos veces.
if (btnCronoStop) {
  const nuevoBtnCronoStop = btnCronoStop.cloneNode(true);
  btnCronoStop.parentNode.replaceChild(nuevoBtnCronoStop, btnCronoStop);

  nuevoBtnCronoStop.addEventListener('click', async () => {
    const displayText = document.getElementById('cronometro-display').textContent;
    
    // Validar que el cronómetro se haya iniciado
    if (displayText === '00:00:00') {
      alert('Inicia el cronómetro antes de guardar la sesión.');
      return;
    }

    // Validar que haya ejercicios con datos
    const ejerciciosValidos = sesionActual.ejercicios.filter(ej => 
      ej.series.some(s => s.peso !== '' && s.reps !== '')
    );

    if (ejerciciosValidos.length === 0) {
      if (!confirm('No has registrado ninguna serie con peso y repeticiones. ¿Guardar solo la duración del entrenamiento?')) {
        return;
      }
    }

    try {
      // 1. Guardar la sesión en Dexie
      const sesionId = await dbWorkout.sesiones.add({
        fecha: new Date().toISOString(),
        duracion: displayText
      });

      // 2. Preparar las series para guardar en lote
      const seriesParaGuardar = [];
      ejerciciosValidos.forEach(ej => {
        ej.series.forEach(s => {
          if (s.peso !== '' || s.reps !== '') {
            seriesParaGuardar.push({
              sesionId: sesionId,
              ejercicio: ej.nombre,
              peso: parseFloat(s.peso) || 0,
              reps: parseInt(s.reps) || 0,
              rir: parseInt(s.rir) || null
            });
          }
        });
      });

      // 3. Guardar en lote (bulkAdd es más eficiente que un bucle con add)
      if (seriesParaGuardar.length > 0) {
        await dbWorkout.series.bulkAdd(seriesParaGuardar);
      }

      alert('¡Entrenamiento guardado con éxito!');
      
      // 4. Limpiar estado y UI
      sesionActual.ejercicios = [];
      renderizarSesion();
      
      document.getElementById('cronometro-display').textContent = '00:00:00';
      const btnStart = document.getElementById('btn-crono-start');
      if (btnStart) {
        btnStart.textContent = '▶ Iniciar';
        btnStart.style.display = 'block';
      }
      nuevoBtnCronoStop.style.display = 'none';

    } catch (err) {
      console.error("Error al guardar en Dexie:", err);
      alert('Error al guardar el entrenamiento. Revisa la consola.');
    }
  });
}

// Renderizar la sesión vacía al cargar la página
renderizarSesion();