(() => {
  // --- Navegación ---
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

  // --- Lógica de Medidas y PAE ---
  const inputIds = ['peso-real', 'torax', 'cintura', 'abdomen', 'gluteos', 'muslo-izq', 'muslo-der', 'brazo-izq', 'brazo-der'];
  const inputs = inputIds.map(id => document.getElementById(id));
  const sexoSelect = document.getElementById('sexo-select');
  const paeResultado = document.getElementById('pae-resultado');
  const paeDetalle = document.getElementById('pae-detalle');

  // Cargar sexo guardado si existe
  try {
    const savedSexo = localStorage.getItem('sexo');
    if (savedSexo) sexoSelect.value = savedSexo;
  } catch {}

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
      paeResultado.textContent = `${res.paeRounded.toFixed(2)} kg`;
      paeResultado.style.color = 'var(--accent)';
      paeDetalle.textContent = `IAM: ${res.iam.toFixed(2)} | K: ${res.k}`;
    } else {
      paeResultado.textContent = '--';
      paeResultado.style.color = 'var(--text-muted)';
      if (!sexo) {
        paeDetalle.textContent = 'Selecciona tu sexo para calcular';
      } else if (res.missing.length > 0) {
        paeDetalle.textContent = `Faltan medidas: ${res.missing.join(', ')}`;
      }
    }
  }

  // Escuchar cambios en todos los inputs y el selector
  inputs.forEach(input => input.addEventListener('input', updatePAE));
  sexoSelect.addEventListener('change', () => {
    try { localStorage.setItem('sexo', sexoSelect.value); } catch {}
    updatePAE();
  });

  // Botón de guardar (por ahora solo muestra un aviso)
  document.getElementById('guardar-medidas').addEventListener('click', () => {
    alert('¡Medidas guardadas! (La persistencia real la añadiremos en la siguiente fase).');
  });

  // Ejecutar una vez al inicio
  updatePAE();
})();