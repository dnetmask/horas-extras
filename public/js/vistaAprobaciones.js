async function renderAprobaciones(contenedor) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  const pendientes = await api.pendientesAprobacion();

  if (pendientes.length === 0) {
    contenedor.innerHTML = '<div class="card"><p>No hay registros pendientes de tu aprobación.</p></div>';
    return;
  }

  contenedor.innerHTML = `
    <div class="card">
      <h2>Pendientes de aprobación</h2>
      <table>
        <thead>
          <tr><th>Ingeniero</th><th>Líder</th><th>Fecha/hora</th><th>Total</th><th>Etapa</th><th>Obra</th><th></th></tr>
        </thead>
        <tbody id="tbodyAprobaciones">
          ${pendientes
            .map(
              (r) => `
            <tr data-id="${r.id}">
              <td>${r.ingeniero.nombre}</td>
              <td>${r.lider ? r.lider.nombre : ''}</td>
              <td>${r.fecha.slice(0, 10)} · ${r.horaInicio}-${r.horaFin}</td>
              <td>${r.horasTotales}h</td>
              <td>${badgeEstado(r.estado)}</td>
              <td>${r.obra || ''}</td>
              <td>
                <button class="btn btn-ok" onclick="decidirRegistro('${r.id}', 'aprobar')">Aprobar</button>
                <button class="btn btn-danger" onclick="decidirRegistro('${r.id}', 'rechazar')">Rechazar</button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function decidirRegistro(id, decision) {
  let motivo = null;
  if (decision === 'rechazar') {
    motivo = prompt('Motivo del rechazo (se le enviará al ingeniero):') || '';
  }
  try {
    await api.decidir(id, decision, motivo);
    renderAprobaciones(document.getElementById('app'));
  } catch (err) {
    alert(err.message);
  }
}
