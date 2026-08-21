async function renderBanco(contenedor) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  const banco = await api.miBanco();

  contenedor.innerHTML = `
    <div class="card">
      <h2>Mi banco de horas compensatorias</h2>
      <p>Horas aprobadas: <strong>${banco.totalAprobado}h</strong> · Compensadas: <strong>${banco.totalCompensado}h</strong></p>
      <p style="font-size:1.2rem">Saldo pendiente por compensar: <strong>${banco.saldo}h</strong></p>
      ${banco.saldo > 0 ? '<p class="aviso">Si este saldo lleva más de 45 días sin compensar, llegará una alerta automática por correo a ti, tu líder y gerencia.</p>' : ''}
    </div>

    <div class="card">
      <h2>Registrar compensación (tiempo libre tomado)</h2>
      <form id="formCompensacion">
        <div class="form-grid">
          <label>Horas <input type="number" step="0.25" min="0.25" name="horas" required /></label>
          <label>Fecha <input type="date" name="fechaCompensacion" required /></label>
        </div>
        <button class="btn btn-primary" type="submit">Registrar</button>
        <div class="error" id="errorFormCompensacion"></div>
      </form>
    </div>

    <div class="card">
      <h2>Historial de compensaciones</h2>
      ${
        banco.historial.length === 0
          ? '<p>Sin compensaciones registradas todavía.</p>'
          : `<table><thead><tr><th>Fecha</th><th>Horas</th></tr></thead><tbody>
              ${banco.historial.map((c) => `<tr><td>${c.fechaCompensacion.slice(0, 10)}</td><td>${c.horas}h</td></tr>`).join('')}
            </tbody></table>`
      }
    </div>
  `;

  document.getElementById('formCompensacion').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(ev.target).entries());
    const errorBox = document.getElementById('errorFormCompensacion');
    errorBox.textContent = '';
    try {
      await api.registrarCompensacion(datos);
      renderBanco(contenedor);
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}
