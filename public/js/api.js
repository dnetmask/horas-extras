// Envoltorio minimo sobre fetch para la API propia (mismo origen, cookie de
// sesion via SSO). Scripts clasicos (sin modulos ES) - todo queda global a
// proposito, igual que en FieldSight, para que sea facil llamar desde
// atributos inline si hace falta.

async function apiFetch(ruta, opciones) {
  const resp = await fetch(ruta, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opciones,
  });
  let cuerpo = null;
  try {
    cuerpo = await resp.json();
  } catch (_) {
    // respuesta sin cuerpo JSON (ej. 204)
  }
  if (!resp.ok) {
    const mensaje = (cuerpo && cuerpo.error) || `Error ${resp.status}`;
    throw new Error(mensaje);
  }
  return cuerpo;
}

const api = {
  yo: () => apiFetch('/auth/yo'),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),

  misHoras: () => apiFetch('/api/horas-extra/mios'),
  crearHoras: (datos) => apiFetch('/api/horas-extra', { method: 'POST', body: JSON.stringify(datos) }),
  editarHoras: (id, datos) => apiFetch(`/api/horas-extra/${id}`, { method: 'PATCH', body: JSON.stringify(datos) }),
  horasDeUsuario: (usuarioId) => apiFetch(`/api/horas-extra/de/${usuarioId}`),

  pendientesAprobacion: () => apiFetch('/api/aprobaciones/pendientes'),
  decidir: (id, decision, motivo) =>
    apiFetch(`/api/aprobaciones/${id}/decidir`, { method: 'POST', body: JSON.stringify({ decision, motivo }) }),

  miBanco: () => apiFetch('/api/compensaciones/mias'),
  registrarCompensacion: (datos) => apiFetch('/api/compensaciones', { method: 'POST', body: JSON.stringify(datos) }),
  bancoDeTodos: () => apiFetch('/api/compensaciones/todas'),

  usuarios: () => apiFetch('/api/usuarios'),
  crearUsuario: (datos) => apiFetch('/api/usuarios', { method: 'POST', body: JSON.stringify(datos) }),
  editarUsuario: (id, datos) => apiFetch(`/api/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(datos) }),

  reglasRecargo: () => apiFetch('/api/reglas-recargo'),
  agregarReglaRecargo: (datos) => apiFetch('/api/reglas-recargo', { method: 'POST', body: JSON.stringify(datos) }),
};
