require('./server').startServer().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
