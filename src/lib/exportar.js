'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const COLUMNAS = [
  { header: 'Fecha', key: 'fecha', width: 12 },
  { header: 'Hora inicio', key: 'horaInicio', width: 11 },
  { header: 'Hora fin', key: 'horaFin', width: 11 },
  { header: 'Ingeniero', key: 'ingeniero', width: 22 },
  { header: 'Líder', key: 'lider', width: 20 },
  { header: 'Estado', key: 'estado', width: 16 },
  { header: '# Caso', key: 'caso', width: 16 },
  { header: '# OT', key: 'ot', width: 12 },
  { header: 'Obra', key: 'obra', width: 28 },
  { header: 'Diurna ord.', key: 'diurnaOrd', width: 10 },
  { header: 'Nocturna ord.', key: 'nocturnaOrd', width: 11 },
  { header: 'Diurna dom/fest', key: 'diurnaDomFest', width: 13 },
  { header: 'Nocturna dom/fest', key: 'nocturnaDomFest', width: 14 },
  { header: 'Total trabajado', key: 'trabajado', width: 13 },
  { header: 'Compensable', key: 'compensable', width: 12 },
];

const ESTADOS_LEGIBLES = {
  pendiente_lider: 'Pendiente líder',
  pendiente_gerencia: 'Pendiente gerencia',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

function fila(registro) {
  return {
    fecha: registro.fecha.toISOString().slice(0, 10),
    horaInicio: registro.horaInicio,
    horaFin: registro.horaFin,
    ingeniero: registro.ingeniero.nombre,
    lider: registro.lider ? registro.lider.nombre : '',
    estado: ESTADOS_LEGIBLES[registro.estado] || registro.estado,
    caso: registro.caso || '',
    ot: registro.ot || '',
    obra: registro.obra || '',
    diurnaOrd: Number(registro.horasExtraDiurnaOrd),
    nocturnaOrd: Number(registro.horasExtraNocturnaOrd),
    diurnaDomFest: Number(registro.horasExtraDiurnaDomFest),
    nocturnaDomFest: Number(registro.horasExtraNocturnaDomFest),
    trabajado: Number(registro.horasTotales),
    compensable: Number(registro.horasCompensables),
  };
}

async function generarExcel(registros) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Horas Extra - Netmask';
  wb.created = new Date();

  const hoja = wb.addWorksheet('Historial');
  hoja.columns = COLUMNAS;
  hoja.getRow(1).font = { bold: true };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2540' } };
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  for (const registro of registros) {
    hoja.addRow(fila(registro));
  }

  const numericas = ['diurnaOrd', 'nocturnaOrd', 'diurnaDomFest', 'nocturnaDomFest', 'trabajado', 'compensable'];
  for (const key of numericas) {
    hoja.getColumn(key).numFmt = '0.00';
  }

  if (registros.length > 0) {
    const filaTotales = hoja.addRow({
      fecha: '',
      ingeniero: 'TOTAL',
      diurnaOrd: { formula: `SUM(J2:J${registros.length + 1})` },
      nocturnaOrd: { formula: `SUM(K2:K${registros.length + 1})` },
      diurnaDomFest: { formula: `SUM(L2:L${registros.length + 1})` },
      nocturnaDomFest: { formula: `SUM(M2:M${registros.length + 1})` },
      trabajado: { formula: `SUM(N2:N${registros.length + 1})` },
      compensable: { formula: `SUM(O2:O${registros.length + 1})` },
    });
    filaTotales.font = { bold: true };
  }

  return wb.xlsx.writeBuffer();
}

function generarPdf(registros, { titulo }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).fillColor('#0A2540').text(titulo, { align: 'left' });
    doc.fontSize(9).fillColor('#4B5A6B').text(`Generado el ${new Date().toISOString().slice(0, 10)} · ${registros.length} registro(s)`);
    doc.moveDown(0.8);

    const columnas = [
      { key: 'fecha', label: 'Fecha', width: 55 },
      { key: 'horario', label: 'Horario', width: 65 },
      { key: 'ingeniero', label: 'Ingeniero', width: 100 },
      { key: 'lider', label: 'Líder', width: 90 },
      { key: 'estado', label: 'Estado', width: 90 },
      { key: 'caso', label: 'Caso', width: 75 },
      { key: 'obra', label: 'Obra', width: 150 },
      { key: 'trabajado', label: 'Trab.', width: 40 },
      { key: 'compensable', label: 'Comp.', width: 45 },
    ];

    const xInicial = doc.page.margins.left;
    let y = doc.y;

    function encabezado() {
      let x = xInicial;
      doc.fontSize(8).fillColor('#FFFFFF');
      doc.rect(xInicial, y, columnas.reduce((s, c) => s + c.width, 0), 16).fill('#0A2540');
      doc.fillColor('#FFFFFF');
      for (const col of columnas) {
        doc.text(col.label, x + 2, y + 4, { width: col.width - 4 });
        x += col.width;
      }
      y += 16;
    }

    encabezado();

    for (const r of registros) {
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        y = doc.page.margins.top;
        encabezado();
      }
      const f = fila(r);
      const valores = {
        fecha: f.fecha,
        horario: `${f.horaInicio}-${f.horaFin}`,
        ingeniero: f.ingeniero,
        lider: f.lider,
        estado: f.estado,
        caso: f.caso,
        obra: f.obra,
        trabajado: f.trabajado.toFixed(2),
        compensable: f.compensable.toFixed(2),
      };
      let x = xInicial;
      doc.fontSize(7.5).fillColor('#16202A');
      for (const col of columnas) {
        doc.text(String(valores[col.key] ?? ''), x + 2, y + 3, { width: col.width - 4, height: 14, ellipsis: true });
        x += col.width;
      }
      doc.moveTo(xInicial, y + 14.5).lineTo(x, y + 14.5).strokeColor('#D9DEE3').lineWidth(0.5).stroke();
      y += 15;
    }

    doc.end();
  });
}

module.exports = { generarExcel, generarPdf };
