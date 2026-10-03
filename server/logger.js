/* eslint-disable no-console */

const chalk = require('chalk');
const { networkInterfaces, homedir } = require('os');

const divider = chalk.gray('\n-----------------------------------');

const scrub = value => String(value)
  .replace(/\b(?:postgres(?:ql)?|smtp):\/\/[^\s"']+/gi, '[REDACTED_URL]')
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
  .replace(/\b(?:password|token|secret|authorization)\s*[:=]\s*\S+/gi, '[REDACTED_SECRET]')
  .slice(0, 1200);

const normalizeError = error => {
  if (!(error instanceof Error)) return error;
  const production = process.env.NODE_ENV === 'production';
  const safeStack = production && error.stack ? scrub(error.stack.split('\n').slice(1, 7)
    .map(frame => frame.replaceAll(process.cwd(), '[app]').replaceAll(homedir(), '[home]'))
    .join('\n')) : undefined;
  return {
    name: error.name,
    message: production ? 'Internal error' : scrub(error.message),
    code: error.code,
    stack: production ? safeStack : error.stack,
  };
};

const write = (level, event, details = {}) => {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME || 'ris-web',
    environment: process.env.NODE_ENV || 'development',
    event,
    ...details,
  };
  const output = JSON.stringify(record, (key, value) => {
    if (/password|token|authorization|secret|cookie/i.test(key)) return '[REDACTED]';
    if (value instanceof Error) return normalizeError(value);
    return typeof value === 'string' && key !== 'event' ? scrub(value) : value;
  });
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
};

/**
 * Logger middleware, you can customize it to make messages more personal
 */
const logger = {
  info: (event, details) => write('info', event, details),

  warn: (event, details) => write('warn', event, details),

  // Called whenever there's an error on the server we want to print
  error: (error, details = {}) => write('error', details.event || 'server_error', { ...details, error: normalizeError(error) }),

  audit: (event, details) => write('info', event, { audit: true, ...details }),

  // Called when express.js app starts on given port w/o errors
  appStarted: (port, host, tunnelStarted) => {
    const lanAddress = Object.values(networkInterfaces()).flat()
      .find(item => item && item.family === 'IPv4' && !item.internal);
    const localUrl = process.env.NODE_ENV === 'production' ? process.env.APP_BASE_URL : `http://${host}:${port}`;
    console.log(`Server started ! ${chalk.green('✓')}`);

    // If the tunnel started, log that and the URL it's available at
    if (tunnelStarted) {
      console.log(`Tunnel initialised ${chalk.green('✓')}`);
    }

    console.log(`
${chalk.bold('Access URLs:')}${divider}
Site: ${chalk.magenta(localUrl)}
      LAN: ${chalk.magenta(process.env.NODE_ENV === 'production' ? 'via reverse proxy' : `http://${lanAddress ? lanAddress.address : 'localhost'}:${port}`)
        + (tunnelStarted
          ? `\n    Proxy: ${chalk.magenta(tunnelStarted)}`
          : '')}${divider}
${chalk.blue(`Press ${chalk.italic('CTRL-C')} to stop`)}
${chalk('Webpack is building script...')}
    `);
  },
};

module.exports = logger;
