// imports here
import { Logger, LogLevel } from "./logger.js";
import { LoggerConsole } from "./logger-console.js";
import { ShellExt, ShellExtConfig } from "./shell-ext.js";
import { ConfigMan, ConfigTypes, ConfigOptions } from "./config-man.js";

import shelljs from "shelljs";
import { Pool } from "undici";
import * as undici from "undici";

import * as http from "node:http";
import * as os from "node:os";
import * as readline from "node:readline";

export {
  Logger,
  LogLevel,
  ShellExt,
  ShellExtConfig,
  ConfigMan,
  ConfigTypes,
  ConfigOptions,
  undici,
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

// Default configs here
const DEFAULT_SHELL_CONFIG = {
  appVersion: "N/A",
  log: {
    level: "INFO",
    timestamp: false,
    timestampFormat: "ISO",
  },
  http: {
    keepAliveTimeout: 65000,
    headerTimeout: 66000,

    healthcheckPort: 8080,
    healthcheckInterface: "",
    healthcheckPath: "/healthcheck",
    healthcheckGoodRes: 200,
    healthcheckBadRes: 503,
  },
};

const DEFAULT_CONFIG_OPTIONS = {
  envVarPrefix: "CNA_",
};

const DEFAULT_QUESTION_OPTIONS = {
  muteAnswer: false,
  muteChar: "*",
};

const DEFAULT_HTTP_REQ_POOL_OPTIONS = {};

const DEFAULT_HTTP_REQ_OPTIONS: HttpReqOptions = {
  method: "GET",
};

// Misc consts here
const NODE_ENV =
  process.env.NODE_ENV === undefined ? "development" : process.env.NODE_ENV;

const LOGGER_APP_NAME = "App";

// Interfaces here
export interface ShellConfig {
  name: string;
  appVersion?: string;
  log?: {
    logger?: Logger;
    level?: string; // string because it has to work like the env var
    timestamp?: boolean;
    timestampFormat?: string;
  };
  http?: {
    keepAliveTimeout?: number;
    headerTimeout?: number;

    healthcheckPort?: number;
    healthcheckInterface?: string;
    healthcheckPath?: string;
    healthcheckGoodRes?: number;
    healthcheckBadRes?: number;
  };
}

export interface QuestionOptions {
  muteAnswer?: boolean;
  muteChar?: string;
}

export interface HttpReqPoolOptions extends Pool.Options {}

export interface HttpReqResponse {
  statusCode: number;
  headers: { [key: string]: string | string[] | undefined };
  trailers: { [key: string]: string };
  body: string | object;
}

export interface HttpReqOptions {
  method: "GET" | "PUT" | "POST" | "DELETE" | "PATCH";
  searchParams?: { [key: string]: string | string[] };
  headers?: { [key: string]: string };
  body?: object | string;
  auth?: {
    username: string;
    password: string;
  };
  bearerToken?: string;
}

// Shell class here
export class Shell {
  // Properties here
  private readonly _name: string;
  private readonly _appVersion: string;
  private _configMan: ConfigMan;

  private _logger: Logger;

  private _httpKeepAliveTimeout: number;
  private _httpHeaderTimeout: number;

  private _healthcheckPort: number;
  private _healthcheckInterface: string;
  private _healthCheckPath: string;
  private _healthCheckGoodResCode: number;
  private _healthCheckBadResCode: number;

  private _healthcheckServer?: http.Server;

  private _exts: ShellExt[];
  private _httpReqPools: { [key: string]: Pool };

  // These are public methods for acessing the shelljs methods
  public cat = shelljs.cat;
  public cd = shelljs.cd;
  public chmod = shelljs.chmod;
  public cp = shelljs.cp;
  public dirs = shelljs.dirs;
  public echo = shelljs.echo;
  public env = shelljs.env;
  public testError = shelljs.error;
  public exec = shelljs.exec;
  public find = shelljs.find;
  public grep = shelljs.grep;
  public head = shelljs.head;
  public ln = shelljs.ln;
  public ls = shelljs.ls;
  public mkdir = shelljs.mkdir;
  public mv = shelljs.mv;
  public popd = shelljs.popd;
  public pushd = shelljs.pushd;
  public pwd = shelljs.pwd;
  public rm = shelljs.rm;
  public sed = shelljs.sed;
  public set = shelljs.set;
  public sort = shelljs.sort;
  public tail = shelljs.tail;
  public tempdir = shelljs.tempdir;
  public touch = shelljs.touch;
  public uniq = shelljs.uniq;

  // Constructor here
  constructor(passedConfig: ShellConfig) {
    let config = {
      name: passedConfig.name,
      appVersion:
        passedConfig.appVersion === undefined
          ? DEFAULT_SHELL_CONFIG.appVersion
          : passedConfig.appVersion,
      http: {
        ...DEFAULT_SHELL_CONFIG.http,
        ...passedConfig.http,
      },
      log: {
        ...DEFAULT_SHELL_CONFIG.log,
        ...passedConfig.log,
      },
    };

    this._name = config.name;
    this._appVersion = config.appVersion;
    this._configMan = new ConfigMan();
    this._exts = [];
    this._httpReqPools = {};

    this.ls = shelljs.ls;

    // If a logger has been past in ...
    if (config.log?.logger !== undefined) {
      // ... then use it
      this._logger = config.log.logger;
    } else {
      // ... otherwise create and use a console logger
      let logTimestamps = this.getConfigBool(CFG_LOG_TIMESTAMP, {
        defaultVal: config.log.timestamp,
      });

      let logTimestampFormat = this.getConfigStr(CFG_LOG_TIMESTAMP_FORMAT, {
        defaultVal: config.log.timestampFormat,
      });

      this._logger = new LoggerConsole(
        config.name,
        logTimestamps,
        logTimestampFormat,
      );
    }

    this._logger.start();

    let logLevel = this.getConfigStr(CFG_LOG_LEVEL, {
      defaultVal: config.log.level,
    });

    switch (logLevel.toUpperCase()) {
      case "SILENT":
        this._logger.level = LogLevel.LOG_COMPLETE_SILENCE;
        break;
      case "QUIET":
        this._logger.level = LogLevel.LOG_QUIET;
        break;
      case "INFO":
        this._logger.level = LogLevel.LOG_INFO;
        break;
      case "STARTUP":
        this._logger.level = LogLevel.LOG_START_UP;
        break;
      case "DEBUG":
        this._logger.level = LogLevel.LOG_DEBUG;
        break;
      case "TRACE":
        this._logger.level = LogLevel.LOG_TRACE;
        break;
      default:
        this._logger.level = LogLevel.LOG_INFO;
        this._logger.warn(
          `LogLevel ${logLevel} is unknown. Setting level to INFO.`,
        );
        break;
    }

    this._healthcheckInterface = this.getConfigStr(
      CFG_HTTP_HEALTHCHECK_INTERFACE,
      { defaultVal: config.http.healthcheckInterface },
    );

    this._healthcheckPort = this.getConfigNum(CFG_HTTP_HEALTHCHECK_PORT, {
      defaultVal: config.http.healthcheckPort,
    });

    this._httpKeepAliveTimeout = this.getConfigNum(
      CFG_HTTP_KEEP_ALIVE_TIMEOUT,
      { defaultVal: config.http.keepAliveTimeout },
    );

    this._httpHeaderTimeout = this.getConfigNum(CFG_HTTP_HEADER_TIMEOUT, {
      defaultVal: config.http.headerTimeout,
    });

    this._healthCheckPath = this.getConfigStr(CFG_HTTP_HEALTHCHECK_PATH, {
      defaultVal: config.http.healthcheckPath,
    });

    this._healthCheckGoodResCode = this.getConfigNum(
      CFG_HTTP_HEALTHCHECK_GOOD_RES,
      { defaultVal: config.http.healthcheckGoodRes },
    );

    this._healthCheckBadResCode = this.getConfigNum(
      CFG_HTTP_HEALTHCHECK_BAD_RES,
      { defaultVal: config.http.healthcheckBadRes },
    );

    this.startup("Shell created!");
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

  // get cnVersion(): string {
  //   return CN_VERSION;
  // }

  get appVersion(): string {
    return this._appVersion;
  }

  get logger(): Logger {
    return this._logger;
  }

  // Setters here
  set level(level: LogLevel) {
    this._logger.level = level;
  }

  // Private methods here
  private setupHealthcheck(): void {
    if (this._healthcheckInterface.length === 0) {
      this.startup(
        "No HTTP interface specified for healthcheck endpoint - healthcheck disabled!",
      );
      return;
    }

    this.startup("Initialising healthcheck HTTP endpoint ...");

    this.startup(`Finding IP for interface (${this._healthcheckInterface})`);

    let ifaces = os.networkInterfaces();
    this.startup("Interfaces on host: %j", ifaces);

    if (ifaces[this._healthcheckInterface] === undefined) {
      throw new Error(
        `${this._healthcheckInterface} is not an interface on this server`,
      );
    }

    let ip = "";

    // Search for the first I/F with a family of type IPv4
    let found = ifaces[this._healthcheckInterface]?.find(
      (i) => i.family === "IPv4",
    );
    if (found !== undefined) {
      ip = found.address;
      this.startup(
        `Found IP (${ip}) for interface ${this._healthcheckInterface}`,
      );
      this.startup(
        `Will listen on interface ${this._healthcheckInterface} (IP: ${ip})`,
      );
    }

    if (ip.length === 0) {
      throw new Error(
        `${this._healthcheckInterface} is not an interface on this server`,
      );
    }

    this.startup(
      `Attempting to listen on (http://${ip}:${this._healthcheckPort})`,
    );

    this._healthcheckServer = http
      .createServer((req, res) => this.healthcheckCallback(req, res))
      .listen(this._healthcheckPort, ip);

    // NOTE: The default node keep alive is 5 secs. This needs to be set
    // higher then any load balancers in front of this CNA

    this._healthcheckServer.keepAliveTimeout = this._httpKeepAliveTimeout;

    // NOTE: There is a potential race condition and the recommended
    // solution is to make the header timeouts greater then the keep alive
    // timeout. See - https://github.com/nodejs/node/issues/27363

    this._healthcheckServer.headersTimeout = this._httpHeaderTimeout;

    this.startup("Now listening. Healthcheck endpoint enabled!");
  }

  private async startupError(code: number, testing: boolean) {
    this.error("Heuston, we have a problem. Shutting down now ...");

    if (testing) {
      // Do a soft stop so we don't force any testing code to exit
      await this.exit(code, false);
      return;
    }

    await this.exit(code);
  }

  // Public methods here
  async init(testing: boolean = false) {
    this.startup("Initialising ...");
    // this.startup(`CN-Shell Version (${CN_VERSION})`);
    this.startup(`App Version (${this._appVersion})`);
    this.startup(`NODE_ENV (${NODE_ENV})`);

    // NB: start the extensions first because the app may need them to start
    for (let ext of this._exts) {
      this.startup(`Attempting to start extension ${ext.name} ...`);

      await ext.start().catch(async (e) => {
        this.error(e);

        // This will exit the app
        await this.startupError(-1, testing);
      });
    }

    this.startup("Attempting to start the application ...");

    await this.start().catch(async (e) => {
      this.error(e);

      // This will exit the app
      await this.startupError(-1, testing);
    });

    // NB: We have to create the healhcheck HTTP endpoint AFTER we start the app
    await this.setupHealthcheck();

    this.startup("Setting up event handler for SIGINT and SIGTERM");
    process.on("SIGINT", async () => await this.exit(0));
    process.on("SIGTERM", async () => await this.exit(0));

    this.startup("Ready to Rock and Roll baby!");
  }

  async exit(code: number, hard: boolean = true): Promise<void> {
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

    for (let origin in this._httpReqPools) {
      this._httpReqPools[origin].destroy();
    }

    this.startup("So long and thanks for all the fish!");

    this._logger.stop();

    // Check if the exit should also exit the process (a hard stop)
    if (hard) {
      process.exit(code);
    }
  }

  getConfigStr(
    config: string,
    passedOptions: ConfigOptions = {},
    appOrExtName = LOGGER_APP_NAME,
  ): string {
    let options: ConfigOptions = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedOptions,
    };

    return <string>(
      this._configMan.get(
        config,
        ConfigTypes.String,
        options,
        appOrExtName,
        this._logger,
      )
    );
  }

  getConfigBool(
    config: string,
    passedOptions: ConfigOptions = {},
    appOrExtName = LOGGER_APP_NAME,
  ): boolean {
    let options: ConfigOptions = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedOptions,
    };

    return <boolean>(
      this._configMan.get(
        config,
        ConfigTypes.Boolean,
        options,
        appOrExtName,
        this._logger,
      )
    );
  }

  getConfigNum(
    config: string,
    passedOptions: ConfigOptions = {},
    appOrExtName = LOGGER_APP_NAME,
  ): number {
    let options: ConfigOptions = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedOptions,
    };

    return <number>(
      this._configMan.get(
        config,
        ConfigTypes.Number,
        options,
        appOrExtName,
        this._logger,
      )
    );
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

  addExt(ext: ShellExt): void {
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

  createHttpReqPool(origin: string, passedOptions?: HttpReqPoolOptions): void {
    let options = {
      ...DEFAULT_HTTP_REQ_POOL_OPTIONS,
      ...passedOptions,
    };

    this.trace(
      "Creating new HTTP pool for (%s) with options (%j)",
      origin,
      passedOptions,
    );

    if (this._httpReqPools[origin] !== undefined) {
      throw new Error(`A HTTP pool already exists for ${origin}`);
    }

    this._httpReqPools[origin] = new Pool(origin, options);
  }

  async httpReq(
    origin: string,
    path: string,
    passedOptions?: HttpReqOptions,
  ): Promise<HttpReqResponse> {
    let options = {
      ...DEFAULT_HTTP_REQ_OPTIONS,
      ...passedOptions,
    };

    this.trace("httpReq for origin (%s) path (%s)", origin, path);

    let pool = this._httpReqPools[origin];

    // If the pool doesn't exist then create one for the origin with defaults
    if (pool === undefined) {
      this.createHttpReqPool(origin);
      pool = this._httpReqPools[origin];
    }

    let headers = options.headers === undefined ? {} : options.headers;

    // If a bearer token is provided then add a Bearer auth header
    if (options.bearerToken !== undefined) {
      headers.Authorization = `Bearer ${options.bearerToken}`;
    }

    // If the basic auth creds are provided add a Basic auth header
    if (options.auth !== undefined) {
      let token = Buffer.from(
        `${options.auth.username}:${options.auth.password}`,
      ).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }

    let body: string | undefined;

    if (options.body !== undefined && options.method !== "GET") {
      // If there is no content-type specifed then we assume
      // this is a json payload, however if the body is an object
      // then we know it is a json payload even if the
      // content-type was set
      if (
        options.headers?.["content-type"] === undefined ||
        typeof options.body === "object"
      ) {
        headers["content-type"] = "application/json; charset=utf-8";
        body = JSON.stringify(options.body);
      } else {
        body = options.body;
      }
    }

    let results = await pool.request({
      origin,
      path,
      method: <undici.Dispatcher.HttpMethod>options.method,
      headers,
      query: options.searchParams,
      body,
    });

    let resData: object | string;

    // Safest way to check for a body is the content-length header exists
    // and is not "0" (no need to convert to a number)
    let contentExists = false;
    if (
      results.headers["content-length"] !== undefined &&
      results.headers["content-length"] !== "0"
    ) {
      contentExists = true;
    }

    // Only convert to json if there is content otherwise .json() will throw
    if (
      contentExists &&
      results.headers["content-type"]?.startsWith("application/json") === true
    ) {
      resData = await results.body.json();
    } else {
      resData = await results.body.text();
      // If the string has length then let's check the content-type again for
      // json data - sometimes the server isn't setting the content-length ...
      if (
        resData.length &&
        results.headers["content-type"]?.startsWith("application/json") === true
      ) {
        resData = JSON.parse(resData);
      }
    }

    let res: HttpReqResponse = {
      statusCode: results.statusCode,
      headers: results.headers,
      trailers: results.trailers,
      body: resData,
    };

    return res;
  }
}
