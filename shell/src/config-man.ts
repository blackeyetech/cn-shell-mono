// imports here
import { Logger } from "./logger.js";

import dotenv from "dotenv";
import minimist from "minimist";

// Config consts here
const CFG_DOTENV_PATH = "DOTENV_PATH";

// Default configs here
const DEFAULT_CONFIG_OPTIONS = {
  silent: false,
  redact: false,
  envVarPrefix: "",
};

// enums here
export enum ConfigTypes {
  String,
  Boolean,
  Number,
}

// Interfaces here
export interface ConfigOptions {
  config: string;
  defaultVal?: string | boolean | number;
  silent?: boolean;
  redact?: boolean;
  envVarPrefix?: string;
}

// ConfigMan class here
export class ConfigMan {
  // Properties here
  private _minimist: minimist.ParsedArgs;

  // Constructor here
  constructor() {
    // minimist parses the command line parameters - ignore first 2
    this._minimist = minimist(process.argv.slice(2));

    // Check if the user has specified a .env path
    let dotenvPath = <string>this.get(ConfigTypes.String, {
      config: CFG_DOTENV_PATH,
      defaultVal: "",
    });

    // If there is a .env path ...
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
        return parseInt(value);
      case ConfigTypes.Boolean:
        // Only accept y/Y to mean true
        if (value.toUpperCase() === "Y") {
          return true;
        }
        return false;
      default:
        // All that is left is String and this is already a string!
        return value;
    }
  }

  // Public methods here
  get(
    type: ConfigTypes,
    passedOptions: ConfigOptions,
    appOrExtName: string = "",
    logger?: Logger,
  ): string | number | boolean {
    // Setup the defaults
    let options: ConfigOptions = {
      ...DEFAULT_CONFIG_OPTIONS,
      ...passedOptions,
    };

    // Check the CLI first, i.e. CLI has higher precedence then env vars
    // NOTE: Always convert to lower case for the CLI
    let cliParams = options.config.toLowerCase();
    let value = this._minimist[cliParams];

    if (value !== undefined) {
      // We found it, not lets check if we can or should log that we found it
      // NOTE: If we log it we want to indicate is was found on the CLI
      if (logger !== undefined && logger.started && options.silent === false) {
        logger.startup(
          appOrExtName,
          "CLI parameter (%s) = (%j)",
          cliParams,
          options.redact ? "redacted" : value,
        );
      }

      // NOTE: Minimist does type conversions so no need to do it here, HOWEVER:
      // it could confuse a numeric string to be a number so check for that
      if (type === ConfigTypes.String && typeof value === "number") {
        return value.toString();
      }

      // NOTE: We need to check if the value we got is NOT a string but we
      // are expecting one. In this scenario we need to throw an error
      if (type === ConfigTypes.String && typeof value !== "string") {
        throw Error(`Config parameter (${options.config}) should be a string!`);
      }

      // NOTE: We need to check if the value we got is NOT a number but we
      // are expecting one. In this scenario we need to throw an error
      if (type === ConfigTypes.Number && typeof value !== "number") {
        throw Error(`Config parameter (${options.config}) should be a number!`);
      }

      // NOTE: We need to check if the value we got is NOT a boolean but we
      // are expecting one. In this scenario we need to throw an error
      if (type === ConfigTypes.Boolean && typeof value !== "boolean") {
        throw Error(
          `Config parameter (${options.config}) should be a boolean!`,
        );
      }

      return value;
    }

    // OK it's not in the CLI so lets check the env vars
    // NOTE: Always convert to upper case for env vars and prepend the prefix
    let evar = `${options.envVarPrefix}${options.config.toUpperCase()}`;
    value = process.env[evar];

    // If we found it then do a conversion here - env vars are always strings
    if (value !== undefined) {
      value = this.convertConfigValue(value, type);

      // We found it, now lets check if we can or should log that we found it
      // NOTE: If we log it we want to indicate is was found in an env var
      if (logger !== undefined && logger.started && options.silent === false) {
        logger.startup(
          appOrExtName,
          "Env var (%s) = (%j)",
          evar,
          options.redact ? "redacted" : value,
        );
      }
    }

    // If the value was not found in the env vars then use default provided
    // NOTE: The default SHOULd have the correct type so do not do a conversion
    if (value === undefined) {
      // If the default was not provided then the config WAS required
      if (options.defaultVal === undefined) {
        // In this scenario we need to throw an error
        throw Error(
          `Config parameter (${options.config}) not set on the CLI or as an env var!`,
        );
      }

      // Otherwise use the default value
      value = options.defaultVal;

      // We found it, now lets check if we can or should log that we found it
      // NOTE: If we log it we want to indicate is the default value
      if (logger !== undefined && logger.started && options.silent === false) {
        logger.startup(
          appOrExtName,
          "Default value used for (%s) = (%j)",
          options.config,
          options.redact ? "redacted" : value,
        );
      }
    }

    return value;
  }
}
