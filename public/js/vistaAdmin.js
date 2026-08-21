async function renderAdmin(contenedor) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  const [usuarios, reglas] = await Promise.all([api.usuarios(), api.reglasRecargo()]);

  const opcionesLider = usuarios
    .filter((u) => ['lider', 'admin'].includes(u.rol))
    .map((u) => `<option value="${u.id}">${u.nombre}</option>`)
    .join('');

  contenedor.innerHTML = `
    <div class="card">
      <h2>Precargar usuario</h2>
      <p style="font-size:0.85rem;color:#556">Se vincula automáticamente a la cuenta de Microsoft la primera vez que esa persona inicie sesión.</p>
      <form id="formNuevoUsuario">
        <div class="form-grid">
          <label>Email <input type="email" name="email" required /></label>
          <label>Nombre <input type="text" name="nombre" required /></label>
          <label>Rol
            <select name="rol">
              <option value="ingeniero">Ingeniero</option>
              <option value="lider">Líder</option>
              <option value="gerencia">Gerencia</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <button class="btn btn-primary" type="submit">Precargar</button>
        <div class="error" id="errorNuevoUsuario"></div>
      </form>
    </div>

    <div class="card">
      <h2>Usuarios</h2>
      <table>
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Líder asignado</th><th>Activo</th></tr></thead>
        <tbody>
          ${usuarios
            .map(
              (u) => `
            <tr data-id="${u.id}">
              <td>${u.nombre}</td>
              <td>${u.email}</td>
              <td>
                <select onchange="actualizarUsuario('${u.id}', 'rol', this.value)">
                  ${['ingeniero', 'lider', 'gerencia', 'admin']
                    .map((r) => `<option value="${r}" ${r === u.rol ? 'selected' : ''}>${r}</option>`)
                    .join('')}
                </select>
              </td>
              <td>
                <select onchange="actualizarUsuario('${u.id}', 'liderId', this.value || null)">
                  <option value="">(sin líder)</option>
                  ${usuarios
                    .filter((l) => l.id !== u.id)
                    .map((l) => `<option value="${l.id}" ${l.id === u.liderId ? 'selected' : ''}>${l.nombre}</option>`)
                    .join('')}
                </select>
              </td>
              <td><input type="checkbox" ${u.activo ? 'checked' : ''} onchange="actualizarUsuario('${u.id}', 'activo', this.checked)" /></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Reglas de recargo vigentes (ley colombiana)</h2>
      <table>
        <thead><tr><th>Vigente desde</th><th>Diurna</th><th>% Extra diurna</th><th>% Extra nocturna</th><th>% Dominical/Festivo</th><th>Nota</th></tr></thead>
        <tbody>
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
      <p style="font-size:0.82rem;color:#556">Para agregar una nueva vigencia (ej. un futuro cambio de ley) usar <code>POST /api/reglas-recargo</code>.</p>
    </div>
  `;

  document.getElementById('formNuevoUsuario').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(ev.target).entries());
    const errorBox = document.getElementById('errorNuevoUsuario');
    errorBox.textContent = '';
    try {
      await api.crearUsuario(datos);
      renderAdmin(contenedor);
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}

async function actualizarUsuario(id, campo, valor) {
  try {
    await api.editarUsuario(id, { [campo]: valor });
  } catch (err) {
    alert(err.message);
  }
}
