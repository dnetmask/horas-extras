async function renderBanco(contenedor) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  const banco = await api.miBanco();

  contenedor.innerHTML = `
    <div class="card">
      <h2>Mi banco de horas compensatorias</h2>
      <p>Horas trabajadas: <strong>${banco.totalHorasTrabajadas}h</strong> · Compensables acreditadas (con recargo): <strong>${banco.totalAprobado}h</strong> · Ya tomadas: <strong>${banco.totalCompensado}h</strong></p>
      <p style="font-size:1.2rem">Saldo disponible: <strong style="${banco.saldo < 0 ? 'color:#c0362c' : ''}">${banco.saldo}h</strong>${banco.saldo < 0 ? ' <span class="badge badge-rechazada">en contra</span>' : ''}</p>
      ${banco.saldo < 0 ? '<p class="aviso">Tienes un saldo en contra - se descuenta solo con las próximas horas extra que te aprueben.</p>' : ''}
      ${banco.saldo > 0 ? '<p class="aviso">Si este saldo lleva más de 45 días sin compensar, llegará una alerta automática por correo a ti, tu líder y gerencia.</p>' : ''}
    </div>

    <div class="card">
      <h2>Solicitar uso de horas disponibles</h2>
      <p style="font-size:0.85rem;color:#556">Indica la fecha y el horario del permiso. Las horas se calculan solas a partir del horario y se descuentan de tu saldo disponible de inmediato (no requiere aprobación).</p>
      <form id="formCompensacion">
        <div class="form-grid">
          <label>Fecha <input type="date" name="fechaCompensacion" required /></label>
          <label>Hora inicio <input type="time" name="horaInicio" required /></label>
          <label>Hora fin <input type="time" name="horaFin" required /></label>
        </div>
        <button class="btn btn-primary" type="submit">Registrar permiso</button>
        <div class="error" id="errorFormCompensacion"></div>
      </form>
    </div>

    <div class="card">
      <h2>Historial de permisos tomados</h2>
      ${
        banco.historial.length === 0
          ? '<p>Sin permisos registrados todavía.</p>'
          : `<table><thead><tr><th>Fecha</th><th>Horario</th><th>Horas</th></tr></thead><tbody>
              ${banco.historial.map((c) => `<tr><td>${c.fechaCompensacion.slice(0, 10)}</td><td>${c.horaInicio}-${c.horaFin}</td><td>${c.horas}h</td></tr>`).join('')}
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
      const creada = await api.registrarCompensacion(datos);
      mostrarToast(creada.aviso || 'Permiso registrado.', creada.aviso ? 'warn' : 'ok');
      renderBanco(contenedor);
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}
