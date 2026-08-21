function badgeEstado(estado) {
  const textos = {
    pendiente_lider: 'Pendiente líder',
    pendiente_gerencia: 'Pendiente gerencia',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
  };
  const clase = estado === 'aprobada' ? 'badge-aprobada' : estado === 'rechazada' ? 'badge-rechazada' : 'badge-pendiente';
  return `<span class="badge ${clase}">${textos[estado] || estado}</span>`;
}

function filaFechaHora(r) {
  const fecha = r.fecha.slice(0, 10);
  return `${fecha} · ${r.horaInicio}-${r.horaFin}`;
}

async function renderMisHoras(contenedor) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  const [registros] = await Promise.all([api.misHoras()]);

  contenedor.innerHTML = `
    <div class="card">
      <h2>Registrar horas extra</h2>
      <form id="formHorasExtra">
        <div class="form-grid">
          <label>Fecha <input type="date" name="fecha" required /></label>
          <label>Hora inicio <input type="time" name="horaInicio" required /></label>
          <label>Hora fin <input type="time" name="horaFin" required /></label>
          <label># Caso <input type="text" name="caso" /></label>
          <label># OT <input type="text" name="ot" /></label>
          <label>Obra / proyecto <input type="text" name="obra" /></label>
        </div>
        <button class="btn btn-primary" type="submit">Enviar para aprobación</button>
        <div class="error" id="errorFormHoras"></div>
      </form>
    </div>

    <div class="card">
      <h2>Mis registros</h2>
      ${registros.length === 0 ? '<p>Todavía no tienes registros.</p>' : renderTablaMisHoras(registros)}
    </div>
  `;

  document.getElementById('formHorasExtra').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(ev.target).entries());
    const errorBox = document.getElementById('errorFormHoras');
    errorBox.textContent = '';
    try {
      const creado = await api.crearHoras(datos);
      if (creado.aviso) alert(creado.aviso);
      renderMisHoras(contenedor);
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}

function renderTablaMisHoras(registros) {
  return `
    <table>
      <thead>
        <tr><th>Fecha/hora</th><th>Total</th><th>Diurna</th><th>Nocturna</th><th>Dom/Fest diurna</th><th>Dom/Fest nocturna</th><th>Estado</th></tr>
      </thead>
      <tbody>
        ${registros
          .map(
            (r) => `
          <tr>
            <td>${filaFechaHora(r)}</td>
            <td>${r.horasTotales}h</td>
            <td>${r.horasExtraDiurnaOrd}h</td>
            <td>${r.horasExtraNocturnaOrd}h</td>
            <td>${r.horasExtraDiurnaDomFest}h</td>
            <td>${r.horasExtraNocturnaDomFest}h</td>
            <td>${badgeEstado(r.estado)}${r.motivoRechazo ? `<div style="font-size:0.8rem;color:#c0362c">${r.motivoRechazo}</div>` : ''}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}
