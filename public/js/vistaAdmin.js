async function renderAdmin(contenedor) {
  contenedor.innerHTML = '<p>Cargando...</p>';
  const usuarios = await api.usuarios();

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
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Líder asignado</th><th>Activo</th><th></th></tr></thead>
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
              <td><a href="#/usuario/${u.id}">Ver detalle</a></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
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
