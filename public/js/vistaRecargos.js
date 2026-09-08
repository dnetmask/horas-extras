async function renderRecargos(contenedor) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  const reglas = await api.reglasRecargo();

  contenedor.innerHTML = `
    <div class="card">
      <h2>Cómo se calculan las horas extra</h2>
      <p style="font-size:0.9rem;color:#556">Cada registro se reparte automáticamente entre estas 4 categorías, según la fecha en que ocurrió (no hay que marcar si el día era festivo, se calcula solo):</p>
      <div class="form-grid">
        <div><strong>Diurna ordinaria</strong><div style="font-size:0.85rem;color:#556">Entre semana, en horario diurno.</div></div>
        <div><strong>Nocturna ordinaria</strong><div style="font-size:0.85rem;color:#556">Entre semana, en horario nocturno.</div></div>
        <div><strong>Diurna dominical/festiva</strong><div style="font-size:0.85rem;color:#556">Domingo o festivo, de día.</div></div>
        <div><strong>Nocturna dominical/festiva</strong><div style="font-size:0.85rem;color:#556">Domingo o festivo, de noche.</div></div>
      </div>
      <p class="aviso" style="margin-top:1rem">Netmask compensa las horas extra con <strong>tiempo</strong>, no con dinero: el recargo de cada categoría se convierte en más horas acreditadas a tu banco de tiempo compensatorio (no en un valor en pesos). Por ejemplo, hoy 1 hora nocturna dominical/festiva acredita 1 × (1 + 75% + 80%) = <strong>2.55 horas compensables</strong>, no 1. Esa es la columna "Compensable" que ves en tus registros.</p>
    </div>

    <div class="card">
      <h2>Reglas vigentes (ley colombiana)</h2>
      <p style="font-size:0.82rem;color:#556">Los porcentajes suben por la reforma laboral (Ley 2466/2025) — cada fila aplica desde su fecha en adelante, hasta que empiece la siguiente.</p>
      <table>
        <thead><tr><th>Vigente desde</th><th>Horario diurno</th><th>% Extra diurna</th><th>% Extra nocturna</th><th>% Dominical/Festivo</th><th>Nota</th></tr></thead>
        <tbody id="tbodyReglas">
          ${reglas
            .map(
              (r) => `
            <tr>
              <td>${r.vigenteDesde.slice(0, 10)}</td>
              <td>${r.horaInicioDiurna}-${r.horaFinDiurna}</td>
              <td>${(r.pctExtraDiurna * 100).toFixed(0)}%</td>
              <td>${(r.pctExtraNocturna * 100).toFixed(0)}%</td>
              <td>${(r.pctDominicalFestivo * 100).toFixed(0)}%</td>
              <td style="font-size:0.82rem;color:#556">${r.nota || ''}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>

    ${usuarioSesion.rol === 'admin' ? plantillaFormNuevaRegla() : ''}
  `;

  if (usuarioSesion.rol === 'admin') {
    document.getElementById('formNuevaRegla').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const datos = Object.fromEntries(new FormData(ev.target).entries());
      datos.pctExtraDiurna = Number(datos.pctExtraDiurna) / 100;
      datos.pctExtraNocturna = Number(datos.pctExtraNocturna) / 100;
      datos.pctDominicalFestivo = Number(datos.pctDominicalFestivo) / 100;
      const errorBox = document.getElementById('errorNuevaRegla');
      errorBox.textContent = '';
      try {
        await api.agregarReglaRecargo(datos);
        renderRecargos(contenedor);
      } catch (err) {
        errorBox.textContent = err.message;
      }
    });
  }
}

function plantillaFormNuevaRegla() {
  return `
    <div class="card">
      <h2>Agregar una nueva vigencia</h2>
      <p style="font-size:0.85rem;color:#556">Usar solo cuando la ley cambie de verdad (ej. el recargo dominical/festivo sube a 100% el 2027-07-01, ya está precargado). No se edita ni se borra el historial - cada cambio queda como una fila nueva a partir de su fecha, para no alterar cómo se calcularon los registros ya existentes.</p>
      <form id="formNuevaRegla">
        <div class="form-grid">
          <label>Vigente desde <input type="date" name="vigenteDesde" required /></label>
          <label>Hora inicio diurna <input type="time" name="horaInicioDiurna" value="06:00" required /></label>
          <label>Hora fin diurna <input type="time" name="horaFinDiurna" value="19:00" required /></label>
          <label>% Extra diurna <input type="number" step="1" min="0" max="200" name="pctExtraDiurna" value="25" required /></label>
          <label>% Extra nocturna <input type="number" step="1" min="0" max="200" name="pctExtraNocturna" value="75" required /></label>
          <label>% Dominical/Festivo <input type="number" step="1" min="0" max="200" name="pctDominicalFestivo" required /></label>
          <label>Nota <input type="text" name="nota" placeholder="ej. Ley 2466/2025, tramo..." /></label>
        </div>
        <button class="btn btn-primary" type="submit">Agregar vigencia</button>
        <div class="error" id="errorNuevaRegla"></div>
      </form>
    </div>
  `;
}
