// imports here
import { CNLogger, CNLogLevel } from "./cn-logger";
import { CNShellExt } from "./cn-shell-ext";
import { CNLoggerConsole } from "./cn-logger-console";
import { CNConfigMan, ConfigTypes, ConfigOptions } from "./cn-config-man";

import * as shell from "shelljs";

import * as http from "http";
import os from "os";
import readline from "readline";

export {
  CNLogger,
  CNLogLevel,
  CNShellExt,
  CNConfigMan,
  ConfigTypes,
  ConfigOptions,
};

// Config consts here
const CFG_LOG_LEVEL = "LOG_LEVEL";
const CFG_LOG_TIMESTAMP = "LOG_TIMESTAMP";
const CFG_LOG_TIMESTAMP_FORMAT = "LOG_TIMESTAMP_FORMAT";

const CFG_HTTP_KEEP_ALIVE_TIMEOUT = "HTTP_KEEP_ALIVE_TIMEOUT";
const CFG_HTTP_HEADER_TIMEOUT = "HTTP_HEADER_TIMEOUT";

const CFG_HTTP_HEALTHCHECK_PORT = "HTTP_HEALTHCHECK_PORT";
const CFG_HTTP_HEALTHCHECK_INTERFACE = "HTTP_HEALTHCHECK_INTERFACE";
const CFG_HTTP_HEALTHCHECK_PATH = "HTTP_HEALTHCHECK_PATH";
const CFG_HTTP_HEALTHCHECK_GOOD_RES = "HTTP_HEALTHCHECK_GOOD_RES";
const CFG_HTTP_HEALTHCHECK_BAD_RES = "HTTP_HEALTHCHECK_BAD_RES";

// Config defaults here
const DEFAULT_LOG_LEVEL = "INFO";
const DEFAULT_LOG_TIMESTAMP = "N";

const DEFAULT_HTTP_KEEP_ALIVE_TIMEOUT = "65000";
const DEFAULT_HTTP_HEADER_TIMEOUT = "66000";

const DEFAULT_HTTP_HEALTHCHECK_PORT = "8080";
const DEFAULT_HTTP_HEALTHCHECK_PATH = "/healthcheck";
const DEFAULT_HTTP_HEALTHCHECK_GOOD_RES = "200";
const DEFAULT_HTTP_HEALTHCHECK_BAD_RES = "503";

// Misc consts here
const CN_VERSION = require("../package.json").version; // Version of CNShell

const NODE_ENV =
  process.env.NODE_ENV === undefined ? "development" : process.env.NODE_ENV;

const LOGGER_APP_NAME = "App";

const DEFAULT_CONFIG_OPTIONS = {
  envVarPrefix: "CNA_",
};

// enums here

// Interfaces here
export interface CNShellConfig {
  name: string;
  appVersion: string;
  logger?: CNLogger;
}

export interface QuestionOptions {
  muteAnswer?: boolean;
  muteChar?: string;
}

const DEFAULT_QUESTION_OPTIONS = {
  muteAnswer: false,
  muteChar: "*",
};

// CNShell class here
export class CNShell {
  // Properties here
  private readonly _name: string;
  private readonly _appVersion: string;
  private _configMan: CNConfigMan;

  private _logger: CNLogger;

  private _healthcheckServer?: http.Server;
  private _healthCheckPath?: string;
  private _healthCheckGoodResCode: number;
  private _healthCheckBadResCode: number;

  private _exts: CNShellExt[];

  // Constructor here
  constructor(config: CNShellConfig) {
    this._name = config.name;
    this._appVersion = config.appVersion;
    this._configMan = new CNConfigMan();
    this._exts = [];

    // If a logger has been past in ...
    if (config.logger !== undefined) {
      // ... then use it
      this._logger = config.logger;
    } else {
      // ... otherwise create and use a console logger
      let logTimestamps = this.getConfigBool({
        config: CFG_LOG_TIMESTAMP,
        defaultVal: DEFAULT_LOG_TIMESTAMP,
      });

      let logTimestampFormat = this.getConfigStr({
        config: CFG_LOG_TIMESTAMP_FORMAT,
      });

      this._logger = new CNLoggerConsole(
        config.name,
        logTimestamps,
        logTimestampFormat,
      );
    }

    this._logger.start();

    let logLevel = this.getConfigStr({
      config: CFG_LOG_LEVEL,
      defaultVal: DEFAULT_LOG_LEVEL,
    });

    switch (logLevel.toUpperCase()) {
      case "SILENT":
        this._logger.level = CNLogLevel.LOG_COMPLETE_SILENCE;
        break;
      case "QUIET":
        this._logger.level = CNLogLevel.LOG_QUIET;
        break;
      case "INFO":
        this._logger.level = CNLogLevel.LOG_INFO;
        break;
      case "STARTUP":
        this._logger.level = CNLogLevel.LOG_START_UP;
        break;
      case "DEBUG":
        this._logger.level = CNLogLevel.LOG_DEBUG;
        break;
      case "TRACE":
        this._logger.level = CNLogLevel.LOG_TRACE;
        break;
      default:
        this._logger.level = CNLogLevel.LOG_INFO;
        this._logger.warn(
          `LogLevel ${logLevel} is unknown. Setting level to INFO.`,
        );
        break;
    }

    this.startup("CNShell created!");
  }

  // Protected methods (that should be overridden) here
  protected async start(): Promise<boolean> {
    this.startup("Started!");

    return true;
  }
  protected async stop(): Promise<void> {
    this.startup("Stopped!");

    return;
  }
  protected async healthCheck(): Promise<boolean> {
    this.debug("Health check called");

    return true;
  }

  // Getters here
  get name(): string {
    return this._name;
  }

  get cnVersion(): string {
    return CN_VERSION;
  }

  get appVersion(): string {
    return this._appVersion;
  }

  get logger(): CNLogger {
    return this._logger;
  }

  get sh() {
    return shell;
  }

  // Setters here
  set level(level: CNLogLevel) {
    this._logger.level = level;
  }

  // Private methods here
  private setupHealthcheck(): void {
    this._healthCheckGoodResCode = this.getConfigNum({
      config: CFG_HTTP_HEALTHCHECK_GOOD_RES,
      defaultVal: DEFAULT_HTTP_HEALTHCHECK_GOOD_RES,
    });
    this._healthCheckBadResCode = this.getConfigNum({
      config: CFG_HTTP_HEALTHCHECK_BAD_RES,
      defaultVal: DEFAULT_HTTP_HEALTHCHECK_BAD_RES,
    });

    let httpif = this.getConfigStr({ config: CFG_HTTP_HEALTHCHECK_INTERFACE });

    if (httpif.length === 0) {
      this.startup(
        "No HTTP interface specified for healthcheck endpoint - healthcheck disabled!",
      );
      return;
    }

    this.startup("Initialising healthcheck HTTP endpoint ...");

    let port = this.getConfigNum({
      config: CFG_HTTP_HEALTHCHECK_PORT,
      defaultVal: DEFAULT_HTTP_HEALTHCHECK_PORT,
    });

    this.startup(`Finding IP for interface (${httpif})`);

    let ifaces = os.networkInterfaces();
    this.startup("Interfaces on host: %j", ifaces);

    if (ifaces[httpif] === undefined) {
      throw new Error(`${httpif} is not an interface on this server`);
    }

    let ip = "";

    // Search for the first I/F with a family of type IPv4
    let found = ifaces[httpif].find((i) => i.family === "IPv4");
    if (found !== undefined) {
      ip = found.address;
      this.startup(`Found IP (${ip}) for interface ${httpif}`);
      this.startup(`Will listen on interface ${httpif} (IP: ${ip})`);
    }

    if (ip.length === 0) {
      throw new Error(`${httpif} is not an interface on this server`);
    }

    this.startup(`Attempting to listen on (http://${ip}:${port})`);

    let path = this.getConfigStr({
      config: CFG_HTTP_HEALTHCHECK_PATH,
      defaultVal: DEFAULT_HTTP_HEALTHCHECK_PATH,
    });

    this._healthCheckPath = path;

    this._healthcheckServer = http
      .createServer((req, res) => this.healthcheckCallback(req, res))
      .listen(port, ip);

    // NOTE: The default node keep alive is 5 secs. This needs to be set
    // higher then any load balancers in front of this CNA
    let keepAlive = this.getConfigNum({
      config: CFG_HTTP_KEEP_ALIVE_TIMEOUT,
      defaultVal: DEFAULT_HTTP_KEEP_ALIVE_TIMEOUT,
    });

    this._healthcheckServer.keepAliveTimeout = keepAlive;

    // NOTE: There is a potential race condition and the recommended
    // solution is to make the header timeouts greater then the keep alive
    // timeout. See - https://github.com/nodejs/node/issues/27363
    let timeout = this.getConfigNum({
      config: CFG_HTTP_HEADER_TIMEOUT,
      defaultVal: DEFAULT_HTTP_HEADER_TIMEOUT,
    });

    this._healthcheckServer.headersTimeout = timeout;

    this.startup("Now listening. Healthcheck endpoint enabled!");
  }

  private async startupError(testing: boolean) {
    this.error("Heuston, we have a problem. Shutting down now ...");

    if (testing) {
      // Do a soft stop so we don't force any testing code to exit
      await this.exit(false);
      return;
    }

    await this.exit();
  }

  // Public methods here
  async init(testing: boolean = false) {
    this.startup("Initialising ...");
    this.startup(`CN-Shell Version (${CN_VERSION})`);
    this.startup(`App Version (${this._appVersion})`);
    this.startup(`NODE_ENV (${NODE_ENV})`);

    // NB: start the extensions first because the app may need them to start
    for (let ext of this._exts) {
      this.startup(`Attempting to start extension ${ext.name} ...`);

      await ext.start().catch(async (e) => {
        this.error(e);

        // This will exit the app
        await this.startupError(testing);
      });
    }

    this.startup("Attempting to start the application ...");

    await this.start().catch(async (e) => {
      this.error(e);

      // This will exit the app
      await this.startupError(testing);
    });

    // NB: We should create the healhcheck HTTP endpoint AFTER we start the app
    await this.setupHealthcheck();

    this.startup("Setting up event handler for SIGINT and SIGTERM");
    process.on("SIGINT", async () => await this.exit());
    process.on("SIGTERM", async () => await this.exit());

    this.startup("Ready to Rock and Roll baby!");
  }

  async exit(hard: boolean = true): Promise<void> {
    this.startup("Exiting ...");

    if (this._healthcheckServer !== undefined) {
      this.startup("Closing healthcheck endpoint port now ...");
      this._healthcheckServer.close();
      this.startup("Port closed");
    }

    // Stop the application before the extensions
    this.startup("Attempting to stop the application ...");
    await this.stop().catch((e) => {
      this.error(e);
    });

    // Stop the extensions in the reverse order you started them
    for (let ext of this._exts.reverse()) {
      this.startup(`Attempting to stop extension ${ext.name} ...`);
      await ext.stop().catch((e) => {
        this.error(e);
      });
    }

    this.startup("So long and thanks for all the fish!");

    this._logger.stop();

    if (hard) {
      process.exit();
    }
  }

  getConfigStr(
    passedParams: ConfigOptions,
    appOrExtName = LOGGER_APP_NAME,
  ): string {
    let params = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedParams,
      type: ConfigTypes.String,
    };

    return <string>this._configMan.get(params, appOrExtName, this._logger);
  }

  getConfigBool(
    passedParams: ConfigOptions,
    appOrExtName = LOGGER_APP_NAME,
  ): boolean {
    let params = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedParams,
      type: ConfigTypes.Boolean,
    };

    return <boolean>this._configMan.get(params, appOrExtName, this._logger);
  }

  getConfigNum(
    passedParams: ConfigOptions,
    appOrExtName = LOGGER_APP_NAME,
  ): number {
    let params = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedParams,
      type: ConfigTypes.Number,
    };

    return <number>this._configMan.get(params, appOrExtName, this._logger);
  }

  async healthcheckCallback(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // We will only run a healthcheck if this is a GET on the healthcheck path
    if (
      req.method?.toLowerCase() !== "get" ||
      req.url !== this._healthCheckPath
    ) {
      res.statusCode = 404;
      res.end();
      return;
    }

    let healthy = await this.healthCheck().catch((e) => {
      this.error(e);
    });

    if (healthy) {
      res.statusCode = this._healthCheckGoodResCode;
    } else {
      res.statusCode = this._healthCheckBadResCode;
    }

    res.end();
  }

  fatal(...args: any): void {
    this._logger.fatal(LOGGER_APP_NAME, ...args);
  }

  error(...args: any): void {
    this._logger.error(LOGGER_APP_NAME, ...args);
  }

  warn(...args: any): void {
    this._logger.warn(LOGGER_APP_NAME, ...args);
  }

  info(...args: any): void {
    this._logger.info(LOGGER_APP_NAME, ...args);
  }

  startup(...args: any): void {
    this._logger.startup(LOGGER_APP_NAME, ...args);
  }

  debug(...args: any): void {
    this._logger.debug(LOGGER_APP_NAME, ...args);
  }

  trace(...args: any): void {
    this._logger.trace(LOGGER_APP_NAME, ...args);
  }

  force(...args: any): void {
    this._logger.force(LOGGER_APP_NAME, ...args);
  }

  addExt(ext: CNShellExt): void {
    this.startup(`Adding extension ${ext.name}`);
    this._exts.push(ext);
  }

  async sleep(durationInSeconds: number): Promise<void> {
    // Convert duration to ms
    let ms = Math.round(durationInSeconds * 1000);

    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async question(
    ask: string,
    passedOptions?: QuestionOptions,
  ): Promise<string> {
    let input = process.stdin;
    let output = process.stdout;

    let options = {
      ...DEFAULT_QUESTION_OPTIONS,
      ...passedOptions,
    };
    return new Promise((resolve) => {
      let rl = readline.createInterface({
        input,
        output,
      });

      if (options.muteAnswer) {
        input.on("keypress", () => {
          // get the number of characters entered so far:
          var len = rl.line.length;

          if (options.muteChar.length === 0) {
            // move cursor back one since we will always be at the start
            readline.moveCursor(output, -1, 0);
            // clear everything to the right of the cursor
            readline.clearLine(output, 1);
          } else {
            // move cursor back to the beginning of the input
            readline.moveCursor(output, -len, 0);
            // clear everything to the right of the cursor
            readline.clearLine(output, 1);

            // If there is a muteChar then replace the original input with it
            for (var i = 0; i < len; i++) {
              // In case the user passes a string just use the 1st char
              output.write(options.muteChar[0]);
            }
          }
        });
      }

      rl.question(ask, (answer) => {
        resolve(answer);
        rl.close();
      });
    });
  }
}
