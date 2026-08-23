async function renderEquipo(contenedor) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  const saldos = await api.bancoDeTodos();

  contenedor.innerHTML = `
    <div class="card">
      <h2>Horas disponibles del equipo</h2>
      <p style="font-size:0.85rem;color:#556">Saldo de banco de horas compensatorias de todos los ingenieros (horas extra aprobadas menos horas ya tomadas como permiso).</p>
      <table>
        <thead><tr><th>Nombre</th><th>Rol</th><th>Aprobadas</th><th>Compensadas</th><th>Saldo disponible</th></tr></thead>
        <tbody>
          ${saldos
            .map(
              (s) => `
            <tr>
              <td>${s.nombre}</td>
              <td>${s.rol}</td>
              <td>${s.totalAprobado}h</td>
              <td>${s.totalCompensado}h</td>
              <td><strong style="${s.saldo < 0 ? 'color:#c0362c' : ''}">${s.saldo}h</strong>${s.saldo < 0 ? ' <span class="badge badge-rechazada">en contra</span>' : ''}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}
