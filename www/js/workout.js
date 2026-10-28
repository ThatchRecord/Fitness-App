document.addEventListener('DOMContentLoaded', () => {
  // --- Base de Datos (Ampliación) ---
  // Usamos la misma base de datos 'FitnessAppDB' y subimos a la versión 2
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

  // --- Selección de Elementos del DOM ---
  const listaEjerciciosSesion = document.getElementById('lista-ejercicios-sesion');
  const inputNuevoEjercicio = document.getElementById('nuevo-ejercicio-nombre');
  const btnAddEjercicio = document.getElementById('btn-add-ejercicio');
  const btnCronoStop = document.getElementById('btn-crono-stop');

  // Validación de seguridad: si falta algún elemento, avisamos en consola y detenemos.
  if (!listaEjerciciosSesion || !inputNuevoEjercicio || !btnAddEjercicio) {
    console.error("Faltan elementos en el HTML para el registro de series.");
    return;
  }

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
          <button type="button" class="btn-borrar-ejercicio" data-index="${indexEj}" style="background:none; border:none; color: #ef4444; cursor:pointer; font-size: 18px;">🗑️</button>
        </div>
      `;

      // Contenedor de series
      const setsContainer = document.createElement('div');
      setsContainer.id = `sets-${indexEj}`;

      ejercicio.series.forEach((serie, indexSerie) => {
        const setRow = document.createElement('div');
        setRow.className = 'set-row';
        setRow.innerHTML = `
          <input type="number" step="0.5" placeholder="Kg" value="${serie.peso}" onchange="actualizarSerie(${indexEj}, ${indexSerie}, 'peso', this.value)">
          <input type="number" step="1" placeholder="Reps" value="${serie.reps}" onchange="actualizarSerie(${indexEj}, ${indexSerie}, 'reps', this.value)">
          <input type="number" step="1" placeholder="RIR" value="${serie.rir}" onchange="actualizarSerie(${indexEj}, ${indexSerie}, 'rir', this.value)">
          <button type="button" onclick="borrarSerie(${indexEj}, ${indexSerie})">✖</button>
        `;
        setsContainer.appendChild(setRow);
      });

      // Botón para añadir serie
      const btnAddSet = document.createElement('button');
      btnAddSet.type = 'button';
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

    // Añadir eventos a los botones de borrar ejercicio
    document.querySelectorAll('.btn-borrar-ejercicio').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        sesionActual.ejercicios.splice(idx, 1);
        renderizarSesion();
      });
    });
  }

  // --- Añadir un nuevo ejercicio (CORREGIDO Y BLINDADO) ---
  btnAddEjercicio.addEventListener('click', (e) => {
    e.preventDefault(); // Evita comportamientos por defecto (como recargar la página)
    
    const nombre = inputNuevoEjercicio.value.trim();
    if (!nombre) {
      console.log("El campo de nombre está vacío");
      return;
    }

    // Añadir una serie vacía por defecto
    sesionActual.ejercicios.push({
      nombre: nombre,
      series: [{ peso: '', reps: '', rir: '' }]
    });
    
    inputNuevoEjercicio.value = '';
    renderizarSesion();
    console.log("Ejercicio añadido:", nombre);
  });

  // Permitir añadir ejercicio pulsando "Enter"
  inputNuevoEjercicio.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddEjercicio.click();
    }
  });

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
  if (btnCronoStop) {
    const nuevoBtnCronoStop = btnCronoStop.cloneNode(true);
    btnCronoStop.parentNode.replaceChild(nuevoBtnCronoStop, btnCronoStop);

    nuevoBtnCronoStop.addEventListener('click', async (e) => {
      e.preventDefault();
      const displayText = document.getElementById('cronometro-display').textContent;
      
      if (displayText === '00:00:00') {
        alert('Inicia el cronómetro antes de guardar la sesión.');
        return;
      }

      const ejerciciosValidos = sesionActual.ejercicios.filter(ej => 
        ej.series.some(s => s.peso !== '' && s.reps !== '')
      );

      if (ejerciciosValidos.length === 0) {
        if (!confirm('No has registrado ninguna serie con peso y repeticiones. ¿Guardar solo la duración del entrenamiento?')) {
          return;
        }
      }

      try {
        // 1. Guardar la sesión
        const sesionId = await dbWorkout.sesiones.add({
          fecha: new Date().toISOString(),
          duracion: displayText
        });

        // 2. Preparar series
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

        // 3. Guardar en lote
        if (seriesParaGuardar.length > 0) {
          await dbWorkout.series.bulkAdd(seriesParaGuardar);
        }

        alert('¡Entrenamiento guardado con éxito!');
        
        // 4. Limpiar UI
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

  // Renderizar al cargar
  renderizarSesion();
});