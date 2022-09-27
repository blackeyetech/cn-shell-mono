// imports here
import { Logger } from "./logger.js";

import dotenv from "dotenv";
import minimist from "minimist";

// Config consts here
const CFG_DOTENV_PATH = "DOTENV_PATH";

// enums here
export enum ConfigTypes {
  String,
  Boolean,
  Number,
}

// Interfaces here
export interface ConfigOptions {
  config: string;
  defaultVal?: string;
  silent?: boolean;
  redact?: boolean;
  required?: boolean;
  envVarPrefix?: string;
}

const DEFAULT_CONFIG_OPTIONS = {
  defaultVal: "",
  silent: false,
  redact: false,
  required: false,
  envVarPrefix: "",
};

// ConfigMan class here
export class ConfigMan {
  // Properties here
  private _minimist: minimist.ParsedArgs;

  // Constructor here
  constructor() {
    this._minimist = minimist(process.argv.slice(2));

    let dotenvPath = <string>this.get(ConfigTypes.String, {
      config: CFG_DOTENV_PATH,
    });

    // If there is a CFG_DOTENV_PATH ...
    if (dotenvPath.length) {
      // .. then pass it to dotenv
      dotenv.config({ path: dotenvPath });
    }
  }

  // Private methods here
  private convertConfigValue(
    value: string,
    type: ConfigTypes,
  ): number | string | boolean {
    switch (type) {
      case ConfigTypes.Number:
        return parseInt(value, 10);
      case ConfigTypes.Boolean:
        // Only accept y/Y to mean true
        if (value.toUpperCase() === "Y") {
          return true;
        }
        return false;
      default:
        // All that is left is String and this is already a string
        return value;
    }
  }

  // Public methods here
  get(
    type: ConfigTypes,
    passedParams: ConfigOptions,
    appOrExtName: string = "",
    logger?: Logger,
  ): string | number | boolean {
    // Setup the defaults
    let params = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedParams,
    };

    // Check the CLI first, i.e. CLI has higher precedence then env vars
    // NOTE: Always convert to lower case for the CLI
    let cliParam = params.config.toLowerCase();
    let value = this._minimist[cliParam];

    if (value !== undefined) {
      if (logger !== undefined && logger.started && params.silent === false) {
        logger.startup(
          appOrExtName,
          "CLI parameter (%s) = (%s)",
          cliParam,
          params.redact ? "redacted" : value,
        );
      }

      // NOTE: Minimist does type conversions so no need to do it here, HOWEVER:
      // it could confusion a numeric string to be a number so check for that
      if (type === ConfigTypes.String && typeof value === "number") {
        return value.toString();
      }

      return value;
    }

    // OK it's not in the CLI so lets try the env vars
    // NOTE: Alawys convert to upper case for env vars and prepend CNA_
    let evar = `${params.envVarPrefix}${params.config.toUpperCase()}`;
    value = process.env[evar];

    // If env var doesn't exist then check what to do next
    if (value === undefined) {
      // Spit the dummy if it's required
      if (params.required) {
        throw Error(
          `Config parameter (${params.config}) not set on the CLI or as an env var!`,
        );
      }

      // Alls good, just use the default value
      value = params.defaultVal;
    }

    if (logger !== undefined && logger.started && params.silent === false) {
      logger.startup(
        appOrExtName,
        "Env var (%s) = (%s)",
        evar,
        params.redact ? "redacted" : value,
      );
    }

    return this.convertConfigValue(value, type);
  }
}
