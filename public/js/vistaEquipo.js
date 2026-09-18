async function renderEquipo(contenedor) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  const saldos = await api.bancoDeTodos();
  const esLider = usuarioSesion.rol === 'lider';

  contenedor.innerHTML = `
    <div class="card">
      <h2>${esLider ? 'Horas disponibles de mi equipo' : 'Horas disponibles del equipo'}</h2>
      <p style="font-size:0.85rem;color:#556">
        ${esLider ? 'Solo se muestran las personas que te tienen asignado como líder en Administración.' : 'Saldo de banco de horas compensatorias de todos los ingenieros.'}
        Horas ya con el recargo convertido en tiempo, menos horas ya tomadas como permiso.
      </p>
      ${
        saldos.length === 0 && esLider
          ? '<p>Todavía no tienes a nadie asignado como líder — pide a un admin que te asigne a tu equipo en Administración.</p>'
          : `<table>
        <thead><tr><th>Nombre</th><th>Rol</th><th>Trabajadas</th><th>Compensables</th><th>Ya tomadas</th><th>Saldo disponible</th><th></th></tr></thead>
        <tbody>
          ${saldos
            .map(
              (s) => `
            <tr>
              <td>${s.nombre}</td>
              <td>${s.rol}</td>
              <td>${s.totalHorasTrabajadas}h</td>
              <td>${s.totalAprobado}h</td>
              <td>${s.totalCompensado}h</td>
              <td><strong style="${s.saldo < 0 ? 'color:#c0362c' : ''}">${s.saldo}h</strong>${s.saldo < 0 ? ' <span class="badge badge-rechazada">en contra</span>' : ''}</td>
              <td>${['lider', 'admin'].includes(usuarioSesion.rol) ? `<a href="#/usuario/${s.id}">Ver detalle</a>` : ''}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`
      }
    </div>

    <div class="card">
      <h2>Exportar historial</h2>
      ${plantillaFormExportar()}
    </div>
  `;
}
