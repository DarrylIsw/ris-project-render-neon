/* eslint-disable no-await-in-loop, no-restricted-syntax, no-continue */
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const { Prisma } = require('@prisma/client');
const { buildSeedRows, id } = require('../../internals/scripts/generate-database-seed');

const schema = fs.readFileSync(path.resolve(__dirname, '../../database.sql'), 'utf8');
const order = [...schema.matchAll(/^CREATE TABLE (\w+) \(/gm)].map(match => match[1]);
const models = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name, model]));

const keyFields = model => (model.primaryKey ? model.primaryKey.fields : model.fields.filter(field => field.isId).map(field => field.name));
const keyFor = (model, row) => keyFields(model).map(field => String(row[field])).join('|');
const whereFor = (model, row) => {
  const fields = keyFields(model);
  if (fields.length === 1) return { [fields[0]]: row[fields[0]] };
  const name = (model.primaryKey && model.primaryKey.name) || fields.join('_');
  return { [name]: Object.fromEntries(fields.map(field => [field, row[field]])) };
};
const rowsFor = (tables, table, model) => new Map((tables.get(table) || []).map(row => [keyFor(model, row), row]));
const same = isDeepStrictEqual;

const convert = async (tx, model, row) => {
  const result = {};
  for (const [column, value] of Object.entries(row)) {
    if (value === undefined) continue;
    const field = model.fields.find(item => item.name === column);
    if (!field) throw new Error(`Prisma model ${model.name} lacks ${column}`);
    if (column === 'password_hash') {
      if (!value || !value.seedPassword) continue;
      const encrypted = await tx.$queryRaw`SELECT crypt(${value.seedPassword}, gen_salt('bf', 12)) AS hash`;
      result[column] = encrypted[0].hash;
    } else if (value === null) result[column] = field.type === 'Json' && !field.isRequired ? Prisma.DbNull : null;
    else if (field.type === 'DateTime') {
      const clock = /^\d{2}:\d{2}(?::\d{2})?$/.test(String(value));
      result[column] = clock
        ? new Date(`1970-01-01T${String(value).length === 5 ? `${value}:00` : value}Z`)
        : new Date(value);
    } else if (field.type === 'BigInt') result[column] = global.BigInt(value);
    else if (['Int', 'Float', 'Decimal'].includes(field.type)) result[column] = Number(value);
    else result[column] = value;
  }
  return result;
};

const synchronize = async (tx, previous, next, actor) => {
  const oldTables = buildSeedRows('demo', previous).tables;
  const newTables = buildSeedRows('demo', next).tables;

  for (const scheme of next.schemes || []) {
    const prior = (previous.schemes || []).find(item => item.id === scheme.id);
    if (prior && !prior.deletedAt && scheme.deletedAt) {
      await tx.$queryRaw`SELECT delete_research_scheme(${id('scheme', scheme.id)}::uuid, ${actor.id}::uuid)::text AS result`;
    }
  }

  for (const table of order) {
    if (!oldTables.has(table) && !newTables.has(table)) continue;
    const model = models.get(table);
    if (!model) throw new Error(`Missing Prisma model for ${table}`);
    const oldRows = rowsFor(oldTables, table, model);
    const newRows = rowsFor(newTables, table, model);
    for (const [key, row] of newRows) {
      if (same(oldRows.get(key), row)) continue;
      const data = await convert(tx, model, row);
      const keys = new Set(keyFields(model));
      const update = Object.fromEntries(Object.entries(data).filter(([column]) => !keys.has(column) && column !== 'created_at'));
      try {
        if (oldRows.has(key)) await tx[table].update({ where: whereFor(model, row), data: update });
        else await tx[table].create({ data });
      } catch (error) {
        error.syncTable = table;
        error.syncKey = key;
        throw error;
      }
    }
  }

  for (const table of [...order].reverse()) {
    if (!oldTables.has(table)) continue;
    const model = models.get(table);
    const oldRows = rowsFor(oldTables, table, model);
    const newRows = rowsFor(newTables, table, model);
    for (const [key, row] of oldRows) {
      if (!newRows.has(key)) await tx[table].deleteMany({ where: Object.fromEntries(keyFields(model).map(field => [field, row[field]])) });
    }
  }
};

const insertSeedRows = async (tx, tables) => {
  for (const table of order) {
    if (!tables.has(table)) continue;
    const model = models.get(table);
    for (const row of tables.get(table)) {
      await tx[table].create({ data: await convert(tx, model, row) });
    }
  }
};

module.exports = { synchronize, insertSeedRows };
