const assert = require('assert');
const fs = require('fs');
const path = require('path');
const readExcelFile = require('read-excel-file/node').default;
const { parseRabSheets, mergeRabImport, removeRabImport } = require('../../app/containers/Ris/features/research/workflows/rabImport');

const header = ['Kelompok Anggaran', 'No.', 'Komponen', 'Item', '', '', 'Volume', 'Satuan', 'Harga Satuan', 'Total'];
const sheet = rows => [{ sheet: 'Sheet1', data: [header, ...rows] }];

describe('RAB spreadsheet import', () => {
  it('maps filled rows and ignores instructions, totals, and blank template slots', () => {
    const rows = parseRabSheets(sheet([
      ['(Isi Sesuai Jawaban)', null, null, 'Catatan : isi item'],
      ['Bahan', 1, 'Belanja ATK', 'Kertas A3', null, null, 2, 'Rim', 150000, 300000],
      ['Bahan', 2, null, null, null, null, 1, null, 0, 0],
      ['Total Biaya Bahan', null, null, null, null, null, null, null, null, 300000],
    ]));
    assert.strictEqual(rows.length, 1);
    assert.deepStrictEqual(rows[0], {
      group: 'Bahan', component: 'Belanja ATK', name: 'Kertas A3', volume: 2, unit: 'Rim', unitPrice: 150000, sourceRow: 3
    });
  });
  it('keeps manual items through replacement and removal, including shared sections', () => {
    const manual = { id: 'manual', tab: 'materials', name: 'Input sendiri' };
    const first = mergeRabImport([manual], [{ key: 'materials', label: 'Bahan dan Peralatan' }], parseRabSheets(sheet([
      ['Bahan', 1, 'Belanja ATK', 'Kertas A3', null, null, 2, 'Rim', 150000],
      ['Sewa Peralatan', 1, 'Peralatan Penelitian', 'Lisensi perangkat', null, null, 1, 'Per Tahun', 5000000],
    ])));
    assert.strictEqual(first.budgets.length, 3);
    assert.strictEqual(first.sections.length, 2);
    assert.strictEqual(first.budgets[1].componentCustom, true);
    assert.strictEqual(first.budgets[1].unitCustom, true);
    assert.strictEqual(first.sections[1].origin, 'rab');
    const replaced = mergeRabImport(first.budgets, first.sections, parseRabSheets(sheet([
      ['Analisis Data', 1, 'Transport', 'Perjalanan', null, null, 1, 'hari', 200000],
    ])));
    assert.strictEqual(replaced.budgets.length, 2);
    assert.strictEqual(replaced.sections.some(section => section.label === 'Sewa Peralatan'), false);
    assert.strictEqual(replaced.budgets[0], manual);
    const cleared = removeRabImport(replaced.budgets, replaced.sections);
    assert.deepStrictEqual(cleared.budgets, [manual]);
    assert.deepStrictEqual(cleared.sections, [{ key: 'materials', label: 'Bahan dan Peralatan' }]);
  });
  it('rejects a workbook without item rows', () => {
    assert.throws(() => parseRabSheets(sheet([['Bahan', 1, null, null]])), /tidak memiliki item/);
  });
  it('reads the supplied RAB workbook with its five budget groups', async () => {
    const workbook = path.join(__dirname, '..', '..', 'Konsep Tabel Anggaran.xlsx');
    if (!fs.existsSync(workbook)) return;
    const rows = parseRabSheets(await readExcelFile(fs.readFileSync(workbook)));
    const imported = mergeRabImport([], [], rows);
    assert.strictEqual(rows.length, 19);
    assert.strictEqual(imported.sections.length, 5);
    assert(imported.budgets.some(item => item.name === 'Lab komputer' && item.unit === 'unit'));
    assert.strictEqual(imported.budgets.reduce((sum, item) => sum + Number(item.volume) * Number(item.unitPrice), 0), 45342000);
  });
});
