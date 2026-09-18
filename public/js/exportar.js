// Formulario reutilizable de exportacion (Excel/PDF) - usa un <form
// method="get"> nativo hacia /api/exportar/horas-extra, asi el navegador
// arma la descarga solo (misma sesion/cookie), sin necesitar fetch+blob.

function plantillaFormExportar() {
  return `
    <form action="/api/exportar/horas-extra" method="get" class="form-grid" style="align-items:end">
      <label>Desde <input type="date" name="desde" /></label>
      <label>Hasta <input type="date" name="hasta" /></label>
      <div style="display:flex;gap:0.5rem">
        <button class="btn" type="submit" name="formato" value="excel">Descargar Excel</button>
        <button class="btn" type="submit" name="formato" value="pdf">Descargar PDF</button>
      </div>
    </form>
    <p style="font-size:0.8rem;color:#556;margin-top:0.4rem">Sin fechas, exporta todo el historial disponible según tu alcance.</p>
  `;
}
