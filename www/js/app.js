(() => {
  // --- 1. Base de Datos (Dexie) ---
  const db = new Dexie('FitnessAppDB');
  db.version(1).stores({
    medidas: '++id, fecha' // '++id' es autoincremental
  });

  // --- 2. Navegación ---
  const tabs = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');

  function activate(name) {
    views.forEach(v => v.classList.toggle('active', v.dataset.view === name));
    tabs.forEach(t => {
      const isActive = t.dataset.tab === name;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    try { localStorage.setItem('lastTab', name); } catch {}
  }

  tabs.forEach(tab => tab.addEventListener('click', () => activate(tab.dataset.tab)));

  let initial = 'hoy';
  try {
    const saved = localStorage.getItem('lastTab');
    if (saved && document.querySelector(`.tab[data-tab="${saved}"]`)) initial = saved;
  } catch {}
  activate(initial);

  // --- 3. Lógica de Medidas y PAE ---
  const inputIds = ['peso-real', 'torax', 'cintura', 'abdomen', 'gluteos', 'muslo-izq', 'muslo-der', 'brazo-izq', 'brazo-der'];
  const inputs = inputIds.map(id => document.getElementById(id));
  const sexoSelect = document.getElementById('sexo-select');
  const paeResultado = document.getElementById('pae-resultado');
  const paeDetalle = document.getElementById('pae-detalle');
  const listaMedidas = document.getElementById('lista-medidas');

  // Cargar sexo guardado si existe
  try {
    const savedSexo = localStorage.getItem('sexo');
    if (savedSexo) sexoSelect.value = savedSexo;
  } catch {}

  let currentPAE = null; // Guardar el último cálculo exitoso

  function updatePAE() {
    const data = {
      torax: inputs[1].value,
      cintura: inputs[2].value,
      abdomen: inputs[3].value,
      gluteos: inputs[4].value,
      musloIzq: inputs[5].value,
      musloDer: inputs[6].value,
      brazoIzq: inputs[7].value,
      brazoDer: inputs[8].value,
    };
    const sexo = sexoSelect.value;

    const res = estimatePAE(data, sexo);

    if (res.ok) {
      currentPAE = res;
      paeResultado.textContent = `${res.paeRounded.toFixed(2)} kg`;
      paeResultado.style.color = 'var(--accent)';
      paeDetalle.textContent = `IAM: ${res.iam.toFixed(2)} | K: ${res.k}`;
    } else {
      currentPAE = null;
      paeResultado.textContent = '--';
      paeResultado.style.color = 'var(--text-muted)';
      if (!sexo) {
        paeDetalle.textContent = 'Selecciona tu sexo para calcular';
      } else if (res.missing.length > 0) {
        paeDetalle.textContent = `Faltan medidas: ${res.missing.join(', ')}`;
      }
    }
  }

  inputs.forEach(input => input.addEventListener('input', updatePAE));
  sexoSelect.addEventListener('change', () => {
    try { localStorage.setItem('sexo', sexoSelect.value); } catch {}
    updatePAE();
  });

  // --- 4. Guardar en Base de Datos ---
  document.getElementById('guardar-medidas').addEventListener('click', async () => {
    if (!currentPAE) {
      alert('Faltan datos para guardar. Revisa el formulario.');
      return;
    }

    const registro = {
      fecha: new Date().toISOString(),
      sexo: sexoSelect.value,
      pesoReal: parseFloat(inputs[0].value) || null,
      torax: parseFloat(inputs[1].value),
      cintura: parseFloat(inputs[2].value),
      abdomen: parseFloat(inputs[3].value),
      gluteos: parseFloat(inputs[4].value),
      musloIzq: parseFloat(inputs[5].value) || null,
      musloDer: parseFloat(inputs[6].value) || null,
      brazoIzq: parseFloat(inputs[7].value) || null,
      brazoDer: parseFloat(inputs[8].value) || null,
      pae: currentPAE.paeRounded,
      iam: currentPAE.iam,
      k: currentPAE.k
    };

    try {
      await db.medidas.add(registro);
      alert('¡Medidas guardadas con éxito!');
      limpiarFormulario();
      cargarHistorial();
    } catch (err) {
      console.error(err);
      alert('Error al guardar en la base de datos.');
    }
  });

  function limpiarFormulario() {
    inputs.forEach(input => input.value = '');
    updatePAE();
  }

  // --- 5. Cargar y Mostrar Historial ---
  async function cargarHistorial() {
    try {
      const registros = await db.medidas.orderBy('fecha').reverse().toArray();
      listaMedidas.innerHTML = '';

      if (registros.length === 0) {
        listaMedidas.innerHTML = '<p class="placeholder">No hay medidas guardadas aún.</p>';
        return;
      }

      registros.forEach(reg => {
        const fecha = new Date(reg.fecha).toLocaleDateString('es-ES', { 
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
        
        const div = document.createElement('div');
        div.className = 'card medida-item';
        div.innerHTML = `
          <div class="medida-header">
            <span class="medida-fecha">${fecha}</span>
            <button class="btn-borrar" data-id="${reg.id}">🗑️</button>
          </div>
          <div class="medida-resumen">
            <strong>PAE:</strong> ${reg.pae} kg ${reg.pesoReal ? `(Real: ${reg.pesoReal} kg)` : ''}
          </div>
          <div class="medida-detalle">
            Tórax: ${reg.torax} | Cintura: ${reg.cintura} | Abdomen: ${reg.abdomen} | Glúteos: ${reg.gluteos}
          </div>
        `;
        listaMedidas.appendChild(div);
      });

      // Añadir eventos a los botones de borrar
      document.querySelectorAll('.btn-borrar').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = parseInt(e.target.dataset.id);
          if (confirm('¿Borrar este registro?')) {
            await db.medidas.delete(id);
            cargarHistorial();
          }
        });
      });

    } catch (err) {
      console.error(err);
    }
  }

  // Inicializar
  updatePAE();
  cargarHistorial();
})();