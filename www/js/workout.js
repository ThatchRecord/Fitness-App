document.addEventListener('DOMContentLoaded', () => {
  const dbWorkout = new Dexie('FitnessAppDB');
  dbWorkout.version(3).stores({
    medidas: '++id, fecha',
    sesiones: '++id, fecha',
    series: '++id, sesionId, ejercicio',
    rutinas: '++id, nombre'
  });

  let sesionActual = { ejercicios: [] };

  const listaEjerciciosSesion = document.getElementById('lista-ejercicios-sesion');
  const inputNuevoEjercicio = document.getElementById('nuevo-ejercicio-nombre');
  const btnAddEjercicio = document.getElementById('btn-add-ejercicio');
  const btnCronoStop = document.getElementById('btn-crono-stop');
  
  // Elementos de Rutinas
  const selectRutina = document.getElementById('select-rutina');
  const btnCargarRutina = document.getElementById('btn-cargar-rutina');
  const btnGuardarRutina = document.getElementById('btn-guardar-rutina');

  // --- 1. Renderizado en Pantalla ---
  function renderizarSesion() {
    listaEjerciciosSesion.innerHTML = '';

    if (sesionActual.ejercicios.length === 0) {
      listaEjerciciosSesion.innerHTML = '<p class="placeholder" style="font-size: 14px;">Carga una rutina o añade ejercicios manualmente.</p>';
      return;
    }

    sesionActual.ejercicios.forEach((ejercicio, indexEj) => {
      const card = document.createElement('div');
      card.className = 'ejercicio-card';
      card.innerHTML = `
        <div class="ejercicio-header">
          <span>${ejercicio.nombre}</span>
          <button type="button" class="btn-borrar-ejercicio" data-index="${indexEj}" style="background:none; border:none; color: #ef4444; cursor:pointer; font-size: 18px;">🗑️</button>
        </div>
      `;

      const setsContainer = document.createElement('div');
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

    document.querySelectorAll('.btn-borrar-ejercicio').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index);
        sesionActual.ejercicios.splice(idx, 1);
        renderizarSesion();
      });
    });
  }

  // --- 2. Añadir Ejercicio Manual ---
  btnAddEjercicio.addEventListener('click', (e) => {
    e.preventDefault();
    const nombre = inputNuevoEjercicio.value.trim();
    if (!nombre) return;
    sesionActual.ejercicios.push({ nombre, series: [{ peso: '', reps: '', rir: '' }] });
    inputNuevoEjercicio.value = '';
    renderizarSesion();
  });

  window.actualizarSerie = (indexEj, indexSerie, campo, valor) => {
    sesionActual.ejercicios[indexEj].series[indexSerie][campo] = valor;
  };

  window.borrarSerie = (indexEj, indexSerie) => {
    sesionActual.ejercicios[indexEj].series.splice(indexSerie, 1);
    renderizarSesion();
  };

  // --- 3. Lógica de Rutinas ---
  async function cargarListaRutinas() {
    const rutinas = await dbWorkout.rutinas.toArray();
    selectRutina.innerHTML = '<option value="">Cargar rutina guardada...</option>';
    rutinas.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.nombre;
      selectRutina.appendChild(opt);
    });
  }

  // Guardar la sesión actual como Rutina
  btnGuardarRutina.addEventListener('click', async () => {
    if (sesionActual.ejercicios.length === 0) {
      alert("Añade al menos un ejercicio para guardar una rutina.");
      return;
    }
    
    const nombreRutina = prompt("Nombre para esta rutina (ej. Día de Pecho):");
    if (!nombreRutina) return;

    // Solo guardamos los nombres de los ejercicios, NO los pesos ni las reps.
    const nombresEjercicios = sesionActual.ejercicios.map(e => e.nombre);

    try {
      await dbWorkout.rutinas.add({
        nombre: nombreRutina,
        ejercicios: nombresEjercicios
      });
      alert("Rutina guardada. La próxima vez podrás cargarla en blanco.");
      cargarListaRutinas();
    } catch (err) {
      console.error(err);
      alert("Error al guardar la rutina.");
    }
  });

  // Cargar una Rutina desde la base de datos
  btnCargarRutina.addEventListener('click', async () => {
    const id = parseInt(selectRutina.value);
    if (!id) {
      alert("Selecciona una rutina de la lista.");
      return;
    }

    try {
      const rutina = await dbWorkout.rutinas.get(id);
      
      // Sobrescribimos la sesión actual con los ejercicios de la rutina
      // y les ponemos las series en blanco
      sesionActual.ejercicios = rutina.ejercicios.map(nombre => ({
        nombre: nombre,
        series: [{ peso: '', reps: '', rir: '' }]
      }));
      
      renderizarSesion();
    } catch (err) {
      console.error(err);
      alert("Error al cargar la rutina.");
    }
  });

  // --- 4. Guardar la Sesión Histórica (Cronómetro) ---
  if (btnCronoStop) {
    const nuevoBtnCronoStop = btnCronoStop.cloneNode(true);
    btnCronoStop.parentNode.replaceChild(nuevoBtnCronoStop, btnCronoStop);

    nuevoBtnCronoStop.addEventListener('click', async (e) => {
      e.preventDefault();
      const displayText = document.getElementById('cronometro-display').textContent;
      
      if (displayText === '00:00:00') return alert('Inicia el cronómetro antes de guardar.');

      const ejerciciosValidos = sesionActual.ejercicios.filter(ej => 
        ej.series.some(s => s.peso !== '' || s.reps !== '')
      );

      try {
        // 1. Guardar sesión (Histórico del día)
        const sesionId = await dbWorkout.sesiones.add({
          fecha: new Date().toISOString(),
          duracion: displayText
        });

        // 2. Guardar series del día
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

        if (seriesParaGuardar.length > 0) {
          await dbWorkout.series.bulkAdd(seriesParaGuardar);
        }

        alert('¡Entrenamiento del día guardado con éxito!');
        
        // 3. Limpiar UI (La rutina en la BD NO se borra)
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
        console.error("Error al guardar:", err);
        alert('Error al guardar el entrenamiento.');
      }
    });
  }

  // Inicialización
  cargarListaRutinas();
  renderizarSesion();
});