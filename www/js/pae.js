const K_VALUES = { hombre: 5.93, mujer: 7.15 };

function estimatePAE(input, sexo) {
  const missing = [];
  const required = ['torax', 'cintura', 'abdomen', 'gluteos'];
  
  for (const field of required) {
    if (input[field] == null || input[field] === '') missing.push(field);
  }
  if (!sexo) missing.push('sexo');

  const muslos = promedioApice(input.musloIzq, input.musloDer, missing, 'muslos');
  const brazos = promedioApice(input.brazoIzq, input.brazoDer, missing, 'brazos');

  if (missing.length) return { ok: false, missing };

  const iam =
      2.2 * muslos
    + 2.0 * input.gluteos
    + 1.5 * brazos
    + 1.6 * input.torax
    - 1.2 * input.cintura
    - 1.0 * input.abdomen;

  const k = K_VALUES[sexo];
  const pae = iam / k;

  return {
    ok: true,
    iam,
    k,
    pae,
    paeRounded: Math.round(pae * 100) / 100
  };
}

function promedioApice(izq, der, missing, nombre) {
  const vals = [izq, der].filter(v => v != null && v !== '').map(Number);
  if (vals.length === 0) { missing.push(nombre); return null; }
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}