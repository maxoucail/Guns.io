'use strict';

class Logger {
  static _stamp() {
    return new Date().toISOString();
  }

  static _format(level, msg, extra) {
    const pid = process.pid;
    const base = `[${Logger._stamp()}] [${pid}] [${level}] ${msg}`;
    if (!extra) return base;
    if (extra instanceof Error) return `${base}\n${extra.stack || extra.message}`;
    try { return `${base} ${JSON.stringify(extra)}`; } catch { return `${base} ${extra}`; }
  }

  static info(msg, extra)  { console.log(Logger._format('INFO',  msg, extra)); }
  static warn(msg, extra)  { console.warn(Logger._format('WARN', msg, extra)); }
  static error(msg, extra) { console.error(Logger._format('ERROR', msg, extra)); }
  static debug(msg, extra) {
    if (process.env.NODE_ENV !== 'production') console.log(Logger._format('DEBUG', msg, extra));
  }
}

module.exports = Logger;
