(() => {
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

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activate(tab.dataset.tab));
  });

  let initial = 'hoy';
  try {
    const saved = localStorage.getItem('lastTab');
    if (saved && document.querySelector(`.tab[data-tab="${saved}"]`)) initial = saved;
  } catch {}
  activate(initial);
})();