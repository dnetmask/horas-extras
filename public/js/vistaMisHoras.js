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
  const [registros, usuarios] = await Promise.all([api.misHoras(), api.usuarios()]);
  // Gerencia (y admin) tambien pueden aparecer como "lider" elegible - en
  // ocasiones el Gerente cumple ese papel para quienes le reportan directo.
  const lideres = usuarios.filter((u) => ['lider', 'gerencia', 'admin'].includes(u.rol) && u.activo);

  contenedor.innerHTML = `
    <div class="card">
      <h2>Registrar horas extra</h2>
      <form id="formHorasExtra">
        <div class="form-grid">
          <label>Fecha <input type="date" name="fecha" required /></label>
          <label>Hora inicio <input type="time" name="horaInicio" required /></label>
          <label>Hora fin <input type="time" name="horaFin" required /></label>
          <label>Líder (pre-aprobación)
            <select name="liderId" required>
              <option value="" disabled selected>Selecciona un líder</option>
              ${lideres.map((l) => `<option value="${l.id}">${l.nombre}${l.rol !== 'lider' ? ` (${l.rol})` : ''}</option>`).join('')}
            </select>
          </label>
          <label># Caso <input type="text" name="caso" /></label>
          <label># OT <input type="text" name="ot" /></label>
          <label>Obra / proyecto <input type="text" name="obra" /></label>
        </div>
        ${lideres.length === 0 ? '<p class="aviso">Todavía no hay ningún líder disponible (rol Líder, Gerencia o Admin) - pide a un admin que configure uno antes de poder enviar tu solicitud.</p>' : ''}
        <button class="btn btn-primary" type="submit" ${lideres.length === 0 ? 'disabled' : ''}>Enviar para pre-aprobación</button>
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
      await api.crearHoras(datos);
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
        <tr><th>Fecha/hora</th><th>Total</th><th>Diurna</th><th>Nocturna</th><th>Dom/Fest diurna</th><th>Dom/Fest nocturna</th><th>Líder</th><th>Estado</th></tr>
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
            <td>${r.lider ? r.lider.nombre : ''}</td>
            <td>${badgeEstado(r.estado)}${r.motivoRechazo ? `<div style="font-size:0.8rem;color:#c0362c">${r.motivoRechazo}</div>` : ''}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}
