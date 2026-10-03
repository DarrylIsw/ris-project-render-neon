const argv = require('./argv');

const production = process.env.NODE_ENV === 'production';
const configuredPort = production ? process.env.PORT : (argv.port || process.env.PORT || '3001');
const port = Number(configuredPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(production
    ? 'Plesk/Passenger harus menyediakan PORT untuk aplikasi produksi.'
    : 'PORT harus berupa bilangan bulat antara 1 dan 65535.');
}

module.exports = port;
