import { Logger, LogLevel } from "./logger.js";

import * as util from "node:util";

// LoggerConsole class here
export class LoggerConsole extends Logger {
  constructor(name: string, logTimestamps: boolean, timestampFormat: string) {
    super(name, logTimestamps, timestampFormat);
  }

  fatal(appOrExtName: string, ...args: any): void {
    // fatals are always logged unless level = LOG_COMPLETE_SILENCE
    if (this._level > LogLevel.LOG_COMPLETE_SILENCE) {
      let msg = util.format(
        `${this.timestamp()} FATAL: ${this._name}: ${appOrExtName}: ${args[0]}`,
        ...args.slice(1),
      );
      console.error(msg);
    }
  }

  error(appOrExtName: string, ...args: any): void {
    // errors are always logged unless level = LOG_COMPLETE_SILENCE
    if (this._level > LogLevel.LOG_COMPLETE_SILENCE) {
      let msg = util.format(
        `${this.timestamp()} ERROR: ${this._name}: ${appOrExtName}: ${args[0]}`,
        ...args.slice(1),
      );
      console.error(msg);
    }
  }

  warn(appOrExtName: string, ...args: any): void {
    // warnings are always logged unless level = LOG_COMPLETE_SILENCE
    if (this._level > LogLevel.LOG_COMPLETE_SILENCE) {
      let msg = util.format(
        `${this.timestamp()} WARN: ${this._name}: ${appOrExtName}: ${args[0]}`,
        ...args.slice(1),
      );
      console.warn(msg);
    }
  }

  info(appOrExtName: string, ...args: any): void {
    if (this._level >= LogLevel.LOG_INFO) {
      let msg = util.format(
        `${this.timestamp()} INFO: ${this._name}: ${appOrExtName}: ${args[0]}`,
        ...args.slice(1),
      );
      console.info(msg);
    }
  }

  startup(appOrExtName: string, ...args: any): void {
    if (this._level >= LogLevel.LOG_START_UP) {
      let msg = util.format(
        `${this.timestamp()} STARTUP: ${this._name}: ${appOrExtName}: ${
          args[0]
        }`,
        ...args.slice(1),
      );
      console.info(msg);
    }
  }

  debug(appOrExtName: string, ...args: any): void {
    if (this._level >= LogLevel.LOG_DEBUG) {
      let msg = util.format(
        `${this.timestamp()} DEBUG: ${this._name}: ${appOrExtName}: ${args[0]}`,
        ...args.slice(1),
      );
      console.info(msg);
    }
  }

  trace(appOrExtName: string, ...args: any): void {
    if (this._level >= LogLevel.LOG_TRACE) {
      let msg = util.format(
        `${this.timestamp()} TRACE: ${this._name}: ${appOrExtName}: ${args[0]}`,
        ...args.slice(1),
      );
      console.info(msg);
    }
  }

  force(appOrExtName: string, ...args: any): void {
    // forces are always logged even if level == LOG_COMPLETE_SILENCE
    let msg = util.format(
      `${this.timestamp()} FORCED: ${this._name}: ${appOrExtName}: ${args[0]}`,
      ...args.slice(1),
    );
    console.error(msg);
  }
}
