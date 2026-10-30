document.addEventListener('DOMContentLoaded', () => {
  // Base de datos
  const db = new Dexie('FitnessAppDB');
  db.version(3).stores({
    medidas: '++id, fecha',
    sesiones: '++id, fecha',
    series: '++id, sesionId, ejercicio',
    rutinas: '++id, nombre'
  });

  const ctx = document.getElementById('progressChart').getContext('2d');
  let myChart = null; // Instancia global del gráfico

  const selectMetrica = document.getElementById('select-metrica');
  const containerSelectEjercicio = document.getElementById('container-select-ejercicio');
  const selectEjercicioFuerza = document.getElementById('select-ejercicio-fuerza');
  const chartMensaje = document.getElementById('chart-mensaje');

  // --- 1. Cargar Ejercicios para el selector de Fuerza ---
  async function cargarEjerciciosUnicos() {
    const todasLasSeries = await db.series.toArray();
    const ejercicios = [...new Set(todasLasSeries.map(s => s.ejercicio))].sort();
    
    selectEjercicioFuerza.innerHTML = '<option value="">Selecciona un ejercicio...</option>';
    ejercicios.forEach(ej => {
      const opt = document.createElement('option');
      opt.value = ej;
      opt.textContent = ej;
      selectEjercicioFuerza.appendChild(opt);
    });
  }

  // --- 2. Formatear Fechas para los Gráficos (dd/MM) ---
  function formatFecha(fechaISO) {
    const d = new Date(fechaISO);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  // --- 3. Renderizar Gráficos ---
  async function renderizarGrafico() {
    const metrica = selectMetrica.value;
    
    // Ocultar mensaje por defecto
    chartMensaje.style.display = 'none';
    document.getElementById('progressChart').style.display = 'block';

    // Mostrar u ocultar selector de ejercicio
    containerSelectEjercicio.style.display = (metrica === 'fuerza') ? 'block' : 'none';

    // Destruir gráfico anterior si existe
    if (myChart) {
      myChart.destroy();
    }

    let data = [];
    let labels = [];
    let datasets = [];

    // --- Lógica para PESO CORPORAL ---
    if (metrica === 'peso') {
      const medidas = await db.medidas.orderBy('fecha').toArray();
      if (medidas.length === 0) return mostrarMensajeVacio();

      labels = medidas.map(m => formatFecha(m.fecha));
      
      const pesosReales = medidas.map(m => m.pesoReal || null);
      const pesosPAE = medidas.map(m => m.pae || null);

      datasets = [
        {
          label: 'Peso Real (kg)',
          data: pesosReales,
          borderColor: '#4ade80', // Verde
          backgroundColor: '#4ade80',
          tension: 0.3,
          spanGaps: true
        },
        {
          label: 'PAE Estimado (kg)',
          data: pesosPAE,
          borderColor: '#60a5fa', // Azul
          backgroundColor: '#60a5fa',
          borderDash: [5, 5],
          tension: 0.3
        }
      ];
    }

    // --- Lógica para DURACIÓN ---
    else if (metrica === 'duracion') {
      const sesiones = await db.sesiones.orderBy('fecha').toArray();
      if (sesiones.length === 0) return mostrarMensajeVacio();

      labels = sesiones.map(s => formatFecha(s.fecha));
      
      // Convertir "HH:MM:SS" a minutos totales
      const duracionesMin = sesiones.map(s => {
        const partes = s.duracion.split(':');
        const horas = parseInt(partes[0]) || 0;
        const mins = parseInt(partes[1]) || 0;
        const segs = parseInt(partes[2]) || 0;
        return horas * 60 + mins + (segs / 60);
      });

      datasets = [{
        label: 'Duración (minutos)',
        data: duracionesMin,
        backgroundColor: '#f59e0b', // Ámbar
        borderRadius: 4
      }];
    }

    // --- Lógica para FUERZA ---
    else if (metrica === 'fuerza') {
      const ejercicioSeleccionado = selectEjercicioFuerza.value;
      if (!ejercicioSeleccionado) {
        mostrarMensajeVacio("Selecciona un ejercicio para ver su progresión.");
        return;
      }

      // Buscar series de ese ejercicio
      const series = await db.series.where('ejercicio').equals(ejercicioSeleccionado).toArray();
      if (series.length === 0) return mostrarMensajeVacio();

      // Agrupar por sesionId para obtener la fecha, y sacar el peso máximo del día
      const sesionesMap = new Map();
      
      // Necesitamos las fechas de las sesiones
      for (const s of series) {
        if (!sesionesMap.has(s.sesionId)) {
          const sesion = await db.sesiones.get(s.sesionId);
          if (sesion) {
            sesionesMap.set(s.sesionId, {
              fecha: sesion.fecha,
              maxPeso: s.peso
            });
          }
        } else {
          const current = sesionesMap.get(s.sesionId);
          if (s.peso > current.maxPeso) current.maxPeso = s.peso;
        }
      }

      // Convertir a array y ordenar por fecha
      const progreso = Array.from(sesionesMap.values()).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      
      labels = progreso.map(p => formatFecha(p.fecha));
      const pesos = progreso.map(p => p.maxPeso);

      datasets = [{
        label: `Peso Máximo - ${ejercicioSeleccionado} (kg)`,
        data: pesos,
        borderColor: '#ec4899', // Rosa
        backgroundColor: 'rgba(236, 72, 153, 0.2)',
        fill: true,
        tension: 0.3,
        pointRadius: 4
      }];
    }

    // --- Dibujar Gráfico ---
    myChart = new Chart(ctx, {
      type: metrica === 'duracion' ? 'bar' : 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#f0f0f2' } }
        },
        scales: {
          x: { 
            ticks: { color: '#9a9aa0' },
            grid: { color: '#242428' }
          },
          y: { 
            ticks: { color: '#9a9aa0' },
            grid: { color: '#242428' },
            beginAtZero: false
          }
        }
      }
    });
  }

  function mostrarMensajeVacio(msg = "No hay suficientes datos para mostrar este gráfico.") {
    document.getElementById('progressChart').style.display = 'none';
    chartMensaje.textContent = msg;
    chartMensaje.style.display = 'block';
  }

  // --- 4. Event Listeners ---
  selectMetrica.addEventListener('change', renderizarGrafico);
  selectEjercicioFuerza.addEventListener('change', renderizarGrafico);

  // Ejecutar al entrar en la pestaña (hack rápido para que cargue los datos al cambiar de pestaña)
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'progreso') {
        cargarEjerciciosUnicos();
        renderizarGrafico();
      }
    });
  });

  // Inicialización
  cargarEjerciciosUnicos();
});