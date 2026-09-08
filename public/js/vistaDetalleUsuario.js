async function renderDetalleUsuario(contenedor, usuarioId) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  let datos;
  try {
    datos = await api.horasDeUsuario(usuarioId);
  } catch (err) {
    contenedor.innerHTML = `<div class="card"><p class="error">${err.message}</p></div>`;
    return;
  }
  const { usuario, registros, compensaciones, totalHorasTrabajadas, totalAprobado, totalCompensado, saldo } = datos;

  contenedor.innerHTML = `
    <p><a href="#/equipo">← Horas del equipo</a></p>

    <div class="card">
      <h2>${usuario.nombre}</h2>
      <p style="font-size:0.85rem;color:#556">${usuario.email} · rol ${usuario.rol}</p>
      <p>Horas trabajadas: <strong>${totalHorasTrabajadas}h</strong> · Compensables acreditadas: <strong>${totalAprobado}h</strong> · Ya tomadas: <strong>${totalCompensado}h</strong></p>
      <p style="font-size:1.15rem">Saldo disponible: <strong style="${saldo < 0 ? 'color:#c0362c' : ''}">${saldo}h</strong>${saldo < 0 ? ' <span class="badge badge-rechazada">en contra</span>' : ''}</p>
    </div>

    <div class="card">
      <h2>Horas extra registradas (${registros.length})</h2>
      ${
        registros.length === 0
          ? '<p>Sin registros todavía.</p>'
          : `<table>
              <thead>
                <tr><th>Fecha/hora</th><th>Trabajado</th><th>Diurna</th><th>Nocturna</th><th>Dom/Fest diurna</th><th>Dom/Fest nocturna</th><th>Compensable</th><th>Líder</th><th>Caso</th><th>OT</th><th>Obra</th><th>Estado</th></tr>
              </thead>
              <tbody>
                ${registros
                  .map(
                    (r) => `
                  <tr>
                    <td>${r.fecha.slice(0, 10)} · ${r.horaInicio}-${r.horaFin}</td>
                    <td>${r.horasTotales}h</td>
                    <td>${r.horasExtraDiurnaOrd}h</td>
                    <td>${r.horasExtraNocturnaOrd}h</td>
                    <td>${r.horasExtraDiurnaDomFest}h</td>
                    <td>${r.horasExtraNocturnaDomFest}h</td>
                    <td><strong>${r.horasCompensables}h</strong></td>
                    <td>${r.lider ? r.lider.nombre : ''}</td>
                    <td>${r.caso || ''}</td>
                    <td>${r.ot || ''}</td>
                    <td>${r.obra || ''}</td>
                    <td>${badgeEstado(r.estado)}${r.motivoRechazo ? `<div style="font-size:0.8rem;color:#c0362c">${r.motivoRechazo}</div>` : ''}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>`
      }
    </div>

    <div class="card">
      <h2>Permisos tomados (${compensaciones.length})</h2>
      ${
        compensaciones.length === 0
          ? '<p>Sin permisos registrados todavía.</p>'
          : `<table>
              <thead><tr><th>Fecha</th><th>Horario</th><th>Horas</th></tr></thead>
              <tbody>
                ${compensaciones
                  .map((c) => `<tr><td>${c.fechaCompensacion.slice(0, 10)}</td><td>${c.horaInicio}-${c.horaFin}</td><td>${c.horas}h</td></tr>`)
                  .join('')}
              </tbody>
            </table>`
      }
    </div>
  `;
}
