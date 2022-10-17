// imports here
import {
  Shell,
  ConfigOptions,
  HttpReqPoolOptions,
  HttpReqOptions,
  HttpReqResponse,
} from "./shell.js";

// Default configs here
const DEFAULT_CONFIG_OPTIONS = {
  envVarPrefix: "CNE_",
};

// Interfaces here
export interface ShellExtConfig {
  name: string;
  shell: Shell;
}

// ShellExt class here
export class ShellExt {
  // Properties here
  private _name: string;
  private _shell: Shell;

  // Constructor here
  constructor(config: ShellExtConfig) {
    this._name = config.name;
    this._shell = config.shell;

    this._shell.addExt(this);

    this.startup("Initialising ...");
  }

  // Protected methods (that should be overridden) here
  async start(): Promise<boolean> {
    this.startup("Started!");

    return true;
  }
  async stop(): Promise<void> {
    this.startup("Stopped!");

    return;
  }
  async healthCheck(): Promise<boolean> {
    this.debug("Health check called");

    return true;
  }

  // Getters here
  get name(): string {
    return this._name;
  }

  // Private methods here

  // Public methods here
  getConfigStr(passedOptions: ConfigOptions): string {
    let options: ConfigOptions = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedOptions,
    };

    return this._shell.getConfigStr(options, this._name);
  }

  getConfigBool(passedOptions: ConfigOptions): boolean {
    let options: ConfigOptions = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedOptions,
    };

    return this._shell.getConfigBool(options, this._name);
  }

  getConfigNum(passedOptions: ConfigOptions): number {
    let options: ConfigOptions = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedOptions,
    };

    return this._shell.getConfigNum(options, this._name);
  }

  fatal(...args: any): void {
    this._shell.logger.fatal(this._name, ...args);
  }

  error(...args: any): void {
    this._shell.logger.error(this._name, ...args);
  }

  warn(...args: any): void {
    this._shell.logger.warn(this._name, ...args);
  }

  info(...args: any): void {
    this._shell.logger.info(this._name, ...args);
  }

  startup(...args: any): void {
    this._shell.logger.startup(this._name, ...args);
  }

  debug(...args: any): void {
    this._shell.logger.debug(this._name, ...args);
  }

  trace(...args: any): void {
    this._shell.logger.trace(this._name, ...args);
  }

  force(...args: any): void {
    this._shell.logger.force(this._name, ...args);
  }

  createHttpReqPool(origin: string, passedOptions?: HttpReqPoolOptions): void {
    this._shell.createHttpReqPool(origin, passedOptions);
  }

  async httpReq(
    origin: string,
    path: string,
    passedOptions?: HttpReqOptions,
  ): Promise<HttpReqResponse> {
    return this._shell.httpReq(origin, path, passedOptions);
  }
}
