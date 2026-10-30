document.addEventListener('DOMContentLoaded', () => {
  // --- Base de Datos ---
  const dbWorkout = new Dexie('FitnessAppDB');
  dbWorkout.version(3).stores({
    medidas: '++id, fecha',
    sesiones: '++id, fecha',
    series: '++id, sesionId, ejercicio',
    rutinas: '++id, nombre'
  });

  let sesionActual = { ejercicios: [] };

  // --- Elementos del DOM ---
  const listaEjerciciosSesion = document.getElementById('lista-ejercicios-sesion');
  const inputNuevoEjercicio = document.getElementById('nuevo-ejercicio-nombre');
  const btnAddEjercicio = document.getElementById('btn-add-ejercicio');
  const btnCronoStop = document.getElementById('btn-crono-stop');
  
  const selectRutina = document.getElementById('select-rutina');
  const btnCargarRutina = document.getElementById('btn-cargar-rutina');
  const btnGuardarRutina = document.getElementById('btn-guardar-rutina');
  const btnBorrarRutina = document.getElementById('btn-borrar-rutina');

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
  if (btnAddEjercicio) {
    btnAddEjercicio.addEventListener('click', (e) => {
      e.preventDefault();
      const nombre = inputNuevoEjercicio.value.trim();
      if (!nombre) return;
      sesionActual.ejercicios.push({ nombre, series: [{ peso: '', reps: '', rir: '' }] });
      inputNuevoEjercicio.value = '';
      renderizarSesion();
    });
  }

  window.actualizarSerie = (indexEj, indexSerie, campo, valor) => {
    sesionActual.ejercicios[indexEj].series[indexSerie][campo] = valor;
  };

  window.borrarSerie = (indexEj, indexSerie) => {
    sesionActual.ejercicios[indexEj].series.splice(indexSerie, 1);
    renderizarSesion();
  };

  // --- 3. Lógica de Rutinas ---
  async function cargarListaRutinas() {
    try {
      const rutinas = await dbWorkout.rutinas.toArray();
      selectRutina.innerHTML = '<option value="">Cargar rutina guardada...</option>';
      
      rutinas.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.nombre;
        selectRutina.appendChild(opt);
      });
    } catch (error) {
      console.error("Error al cargar la lista de rutinas:", error);
    }
  }

  // Guardar la sesión actual como Rutina
  if (btnGuardarRutina) {
    btnGuardarRutina.addEventListener('click', async () => {
      if (sesionActual.ejercicios.length === 0) {
        alert("Añade al menos un ejercicio para guardar una rutina.");
        return;
      }
      
      const nombreRutina = prompt("Nombre para esta rutina (ej. Día de Pecho):");
      if (!nombreRutina) return;

      const nombresEjercicios = sesionActual.ejercicios.map(e => e.nombre);

      try {
        await dbWorkout.rutinas.add({
          nombre: nombreRutina,
          ejercicios: nombresEjercicios
        });
        
        alert("Rutina guardada correctamente.");
        cargarListaRutinas();
      } catch (err) {
        console.error("Error al guardar rutina:", err);
        alert("Error al guardar la rutina.");
      }
    });
  }

  // Cargar una Rutina desde la base de datos
  if (btnCargarRutina) {
    btnCargarRutina.addEventListener('click', async () => {
      const id = parseInt(selectRutina.value);
      if (!id) {
        alert("Selecciona una rutina de la lista.");
        return;
      }

      try {
        const rutina = await dbWorkout.rutinas.get(id);
        if (rutina && rutina.ejercicios) {
          sesionActual.ejercicios = rutina.ejercicios.map(nombre => ({
            nombre: nombre,
            series: [{ peso: '', reps: '', rir: '' }]
          }));
          renderizarSesion();
        }
      } catch (err) {
        console.error("Error al cargar rutina:", err);
        alert("Error al cargar la rutina.");
      }
    });
  }

  // Borrar una Rutina
  if (btnBorrarRutina) {
    btnBorrarRutina.addEventListener('click', async () => {
      const id = parseInt(selectRutina.value);
      if (!id) {
        alert("Selecciona una rutina de la lista para borrarla.");
        return;
      }
      
      const confirmar = confirm("¿Estás seguro de que quieres borrar esta rutina? Esta acción no se puede deshacer.");
      if (!confirmar) return;

      try {
        await dbWorkout.rutinas.delete(id);
        alert("Rutina borrada correctamente.");
        cargarListaRutinas(); // Refrescar la lista
      } catch (err) {
        console.error("Error al borrar rutina:", err);
        alert("Error al borrar la rutina.");
      }
    });
  }

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
        const sesionId = await dbWorkout.sesiones.add({
          fecha: new Date().toISOString(),
          duracion: displayText
        });

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