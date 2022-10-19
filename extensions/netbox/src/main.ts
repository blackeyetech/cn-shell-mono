// Imports here
import { ShellExt, ShellExtConfig } from "cn-shell";

import { NetboxApi } from "./netbox-api";

import fsPromise from "node:fs/promises";

// Netbox config consts here
const CFG_NETBOX_SERVER = "NETBOX_SERVER";
const CFG_NETBOX_API_KEY = "NETBOX_API_KEY";

const CFG_DUMP_NETBOX_DATA = "DUMP_NETBOX_DATA";
const CFG_LOAD_NETBOX_DATA = "LOAD_NETBOX_DATA";
const CFG_NETBOX_DATA_DIR = "NETBOX_DATA_DIR";

// Default configs here
const DEFAULT_NETBOX_CONFIG = {
  dumpData: false,
  loadData: false,
  dataDir: "/tmp",
};

// Interfaces here
export interface NetboxConfig {
  server?: string;
  apiKey?: string;

  dumpData?: boolean;
  loadData?: boolean;
  dataDir?: string;
}

// Netbox class here
export class Netbox extends ShellExt {
  // Properties here
  private _server: string;
  private _apiKey: string;

  private _dumpData: boolean;
  private _loadData: boolean;
  private _dataDir: string;

  // Constructor here
  constructor(shellConfig: ShellExtConfig, passedConfig: NetboxConfig) {
    super(shellConfig);

    let config: NetboxConfig = {
      ...DEFAULT_NETBOX_CONFIG,
      ...passedConfig,
    };

    this._server = this.getConfigStr(CFG_NETBOX_SERVER, {
      defaultVal: config.server,
    });
    this._apiKey = this.getConfigStr(CFG_NETBOX_API_KEY, {
      defaultVal: config.apiKey,
      redact: true,
    });

    this._dumpData = this.getConfigBool(CFG_DUMP_NETBOX_DATA, {
      defaultVal: config.dataDir,
    });

    this._loadData = this.getConfigBool(CFG_LOAD_NETBOX_DATA, {
      defaultVal: config.loadData,
    });

    this._dataDir = this.getConfigStr(CFG_NETBOX_DATA_DIR, {
      defaultVal: config.dataDir,
    });
  }

  // Abstract method implementations here
  async start(): Promise<boolean> {
    return true;
  }

  async stop(): Promise<void> {
    return;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  // Public methods here
  public async get(
    group: string,
    resource: string,
    params?: { [key: string]: any },
    id?: string,
  ): Promise<{ [key: string]: any }[]> {
    if (NetboxApi[group] === undefined) {
      throw this.error(`'${group}' is not a valid group`);
    }
    if (NetboxApi[group][resource] === undefined) {
      throw this.error(
        `'${resource}' is not a valid resource in group '${group}'`,
      );
    }

    let results: { [key: string]: any }[] = [];

    if (this._loadData) {
      let filePath = `${this._dataDir}/netbox-${group}-${resource}.json`;

      this.debug("Loading netbox data from (%s)", filePath);

      try {
        results = JSON.parse(
          await fsPromise.readFile(filePath, { encoding: "utf8" }),
        );
      } catch (e) {
        this.error("Path (%s) does not exist!", filePath);
      }

      return results;
    }

    let path = `${NetboxApi[group][resource]}`;

    if (id !== undefined) {
      path = `${path}/${id}`;
    }

    // Loop until there are no more pages of results
    while (true) {
      let res = await this.httpReq(this._server, path, {
        method: "GET",
        headers: {
          Authorization: `Token ${this._apiKey}`,
        },
        searchParams: params,
      });

      // This is not the full interface but all we need from it
      interface Results {
        results: any;
        next: string;
      }

      let body = <Results>res.body;
      results = results.concat(body.results);

      // Check if there are more pages of results
      if (body.next !== null) {
        // The next field is a URL but the it is http:// instead of https:// so fix this
        let parts = body.next.split("/api/");
        path = `${this._server}/api/${parts[1]}`;

        // The next field also contains the query paramters so lets clear params
        params = undefined;

        // Make sure to continue so we don't break out of the loop
        continue;
      }

      // No more data so break out of loop
      break;
    }

    if (this._dumpData) {
      this.debug("Dumping netbox data to (%s)", path);
      await fsPromise.writeFile(path, JSON.stringify(results));
    }

    return results;
  }
}
