// imports here
import { CNShellExt, CNShellExtConfig } from "cn-shell";

// Jira config consts here
const CFG_JIRA_SERVER = "JIRA_SERVER";
const CFG_JIRA_USER = "JIRA_USER";
const CFG_JIRA_PASSWORD = "JIRA_PASSWORD";
const CFG_SESSION_REFRESH_PERIOD = "SESSION_REFRESH_PERIOD";

const DEFAULT_SESSION_REFRESH_PERIOD = "60"; // In mins

// Misc consts here
const JiraResources = {
  session: "/rest/auth/1/session",
  field: "/rest/api/2/field",
  project: "/rest/api/2/project",
  issue: "/rest/api/2/issue",
  createmeta: "/rest/api/2/issue/createmeta",
  components: "/rest/api/2/project",
  search: "/rest/api/2/search",
};

// Interfaces here
export interface AuthDetails {
  username: string;
  password: string;
}

export interface FieldDict {
  byName: { [key: string]: { id: string; type: string; itemType: string } };
  byId: { [key: string]: { name: string; type: string; itemType: string } };
}

// CNEJira class here
export class CNEJira extends CNShellExt {
  // Properties here
  private _server: string;
  private _user: string;
  private _password: string;
  private _jiraSessionId: string | undefined;

  private _refreshPeriod: number;
  private _timeout: NodeJS.Timeout;

  private _fieldDict: FieldDict;

  // Constructor here
  constructor(config: CNShellExtConfig) {
    super(config);

    this._server = this.getConfigStr({ config: CFG_JIRA_SERVER }).replace(
      /(\/+$)/, // Strip any trailing slashes
      "",
    );

    this._user = this.getConfigStr({ config: CFG_JIRA_USER });
    this._password = this.getConfigStr({
      config: CFG_JIRA_PASSWORD,
      redact: true,
    });

    let period = this.getConfigNum({
      config: CFG_SESSION_REFRESH_PERIOD,
      defaultVal: DEFAULT_SESSION_REFRESH_PERIOD,
    });
    this._refreshPeriod = period * 60 * 1000; // Convert to ms

    // TODO: Do we need to create a httpReqPool??
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

  // Private methods here

  // Public methods here
  public async login(auth?: AuthDetails): Promise<void> {
    let url = this._resourceUrls.session;

    let res = await this.httpReq(this._server, JiraResources.session, {
      method: "POST",
      auth: {
        username: auth !== undefined ? auth.username : this._user,
        password: auth !== undefined ? auth.password : this._password,
      },
    });

    this._jiraSessionId = res.data.session.value;

    // Start a timer to sutomatically renew the session ID
    this._timeout = setTimeout(() => {
      this.info("Refreshing session ID!");
      this.login();
    }, this._refreshPeriod);
  }

  public async logout(): Promise<void> {
    if (this._jiraSessionId === undefined) {
      return;
    }

    // Stop the timer first!
    clearInterval(this._timeout);

    let url = this._resourceUrls.session;

    await this.httpReq({
      method: "delete",
      url,
      headers: {
        cookie: `JSESSIONID=${this._jiraSessionId}`,
      },
    });

    this._jiraSessionId = undefined;
  }

  public async getFieldDict(update: boolean = false): Promise<FieldDict> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    // Check to see if the field dict is populated AND the user hasn't requested it to be updated
    if (this._fieldDict !== undefined && update === false) {
      return this._fieldDict;
    }

    let url = this._resourceUrls.field;

    let res = await this.httpReq({
      method: "get",
      url,
      headers,
    });

    this._fieldDict = { byId: {}, byName: {} };

    if (Array.isArray(res.data)) {
      for (let field of res.data) {
        this._fieldDict.byName[field.name] = {
          id: field.id,
          type: field.schema !== undefined ? field.schema.type : "Unknown",
          itemType: field.schema !== undefined ? field.schema.items : "Unknown",
        };
        this._fieldDict.byId[field.id] = {
          name: field.name,
          type: field.schema !== undefined ? field.schema.type : "Unknown",
          itemType: field.schema !== undefined ? field.schema.items : "Unknown",
        };
      }
    }

    return this._fieldDict;
  }

  public async getAllowedFieldValues(
    projectKey: string,
    issueType: string,
    fieldName: string,
  ): Promise<string[]> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let url = this._resourceUrls.createmeta;

    let params = new URLSearchParams();
    params.append("expand", "projects.issuetypes.fields");
    params.append("projectKeys", projectKey);
    params.append("issuetypeNames", issueType);

    let res = await this.httpReq({
      method: "get",
      url,
      params,
      headers,
    });

    // Convert field name to field ID
    let dict = await this.getFieldDict();
    let fieldInfo = dict.byName[fieldName];

    if (fieldInfo === undefined) {
      throw Error(`Unknown field ${fieldName}`);
    }

    let field = res.data.projects[0].issuetypes[0].fields[fieldInfo.id];

    if (field === undefined || field.allowedValues === undefined) {
      return [];
    }

    let allowed: string[] = [];

    for (let info of field.allowedValues) {
      allowed.push(info.value);
    }

    return allowed;
  }

  public async getComponents(
    projectKey: string,
  ): Promise<{ [key: string]: string }> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let url = `${this._resourceUrls.components}/${projectKey}/components`;

    let res = await this.httpReq({
      method: "get",
      url,
      headers,
    });

    let components: { [key: string]: string } = {};

    for (let component of res.data) {
      components[component.name] = component.id;
    }

    return components;
  }

  public async getProjects(component?: string): Promise<any[]> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let url = this._resourceUrls.project;

    let res = await this.httpReq({
      method: "get",
      url,
      headers,
    });

    // This is not the full interface but all we need to here
    interface Project {
      projectCategory: { name: string };
    }

    let projects = <Project[]>res.data;

    if (component !== undefined) {
      return projects.filter((el) => el.projectCategory.name === component);
    }

    return projects;
  }

  public async createIssue(
    projectKey: string,
    issueType: string,
    component: string,
    fields: { [key: string]: any },
  ): Promise<string> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let components = await this.getComponents(projectKey);

    let issue: { [key: string]: any } = {
      fields: {
        project: { key: projectKey },
        issuetype: { name: issueType },
        components: [{ id: components[component] }],
      },
    };

    // Convert any field names to field IDs
    await this.getFieldDict();

    for (let fname in fields) {
      let fid = this._fieldDict.byName[fname]?.id;

      if (fid !== undefined) {
        issue.fields[fid] = fields[fname];
      } else {
        issue.fields[fname] = fields[fname];
      }
    }

    let url = this._resourceUrls.issue;

    this.debug("createIssue: issue (%j)", issue);

    let res = await this.httpReq({
      method: "post",
      url,
      data: issue,
      headers,
    });

    return res.data.key;
  }

  public async updateIssue(
    key: string,
    fields: { [key: string]: any },
  ): Promise<string> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let issue: { [key: string]: any } = {
      fields: {},
    };

    // Convert any field names to field IDs
    await this.getFieldDict();

    for (let fname in fields) {
      let fid = this._fieldDict.byName[fname]?.id;

      if (fid !== undefined) {
        issue.fields[fid] = fields[fname];
      } else {
        issue.fields[fname] = fields[fname];
      }
    }

    let url = `${this._resourceUrls.issue}/${key}`;

    let res = await this.httpReq({
      method: "put",
      url,
      data: issue,
      headers,
    });

    return res.data.key;
  }

  public async getIssue(idOrKey: string): Promise<any> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let url = `${this._resourceUrls.issue}/${idOrKey}`;

    let res = await this.httpReq({
      method: "get",
      url,
      headers,
    });

    let issue: { [key: string]: any } = {};

    // Convert any field IDs to field name
    await this.getFieldDict();

    for (let fid in res.data.fields) {
      let fname = this._fieldDict.byId[fid]?.name;

      if (fname !== undefined) {
        issue[fname] = res.data.fields[fid];
      } else {
        issue[fid] = res.data.fields[fid];
      }
    }

    // Add id to list of fields
    issue["id"] = res.data.id;

    return issue;
  }

  public async assignIssue(idOrKey: string, assignee: string): Promise<void> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let url = `${this._resourceUrls.issue}/${idOrKey}/assignee`;

    await this.httpReq({
      method: "put",
      url,
      data: {
        name: assignee,
      },
      headers,
    });
  }

  public async updateLabels(
    key: string,
    action: "add" | "remove",
    labels: string[],
  ): Promise<string> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let issue: { update: { labels: any[] } } = {
      update: {
        labels: [],
      },
    };

    issue.update.labels = [];

    // Convert any field names to field IDs
    await this.getFieldDict();
    for (let label of labels) {
      issue.update.labels.push({ [action]: label });
    }

    let url = `${this._resourceUrls.issue}/${key}`;

    let res = await this.httpReq({
      method: "put",
      url,
      data: issue,
      headers,
    });

    return res.data.key;
  }

  public async addComment(idOrKey: string, comment: string): Promise<void> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let url = `${this._resourceUrls.issue}/${idOrKey}/comment`;

    await this.httpReq({
      method: "post",
      url,
      data: {
        body: comment,
      },
      headers,
    });
  }

  public async addWatcher(idOrKey: string, watcher: string): Promise<void> {
    let headers: { [key: string]: string } = {
      "Content-Type": "application/json;charset=UTF-8",
    };

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let url = `${this._resourceUrls.issue}/${idOrKey}/watchers`;

    await this.httpReq({
      method: "post",
      url,
      data: JSON.stringify(watcher),
      headers,
    });
  }

  public async getTransitions(
    idOrKey: string,
  ): Promise<{ [key: string]: string }> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let url = `${this._resourceUrls.issue}/${idOrKey}/transitions`;

    let res = await this.httpReq({
      method: "get",
      url,
      headers,
    });

    let transitions: { [key: string]: string } = {};

    for (let transition of res.data.transitions) {
      transitions[transition.name] = transition.id;
    }

    return transitions;
  }

  public async doTransition(
    idOrKey: string,
    transitionIdOrName: string,
    fields?: string[],
    comment?: string,
  ): Promise<void> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    // transition may be the Transition ID or name so check
    let availableTransitions = await this.getTransitions(idOrKey);
    let transitionId = availableTransitions[transitionIdOrName];

    if (transitionId === undefined) {
      transitionId = transitionIdOrName;
    }

    let dfields: { [key: string]: { [key: string]: string } } = {};

    if (fields !== undefined) {
      // Convert any field names to field IDs
      await this.getFieldDict();

      for (let fname in fields) {
        let fid = this._fieldDict.byName[fname]?.id;

        if (fid !== undefined) {
          dfields[fid] = { name: fields[fname] };
        } else {
          dfields[fname] = { name: fields[fname] };
        }
      }
    }

    let dcomment = { comment: [{ add: { body: comment } }] };

    let data = {
      update: comment === undefined ? undefined : dcomment,
      fields: fields === undefined || fields.length === 0 ? undefined : dfields,
      transition: { id: transitionId },
    };

    let url = `${this._resourceUrls.issue}/${idOrKey}/transitions`;

    await this.httpReq({
      method: "post",
      url,
      data,
      headers,
    });
  }

  public async runJql(jql: string): Promise<any[]> {
    let headers: { [key: string]: string } = {};

    if (this._jiraSessionId !== undefined) {
      headers.cookie = `JSESSIONID=${this._jiraSessionId}`;
    } else {
      let token = Buffer.from(`${this._user}:${this._password}`).toString(
        "base64",
      );
      headers.Authorization = `Basic ${token}`;
    }

    let url = `${this._resourceUrls.search}?jql=${encodeURI(jql)}`;

    let res = await this.httpReq({
      method: "get",
      url,
      headers,
    });

    if (res === undefined) {
      return [];
    }

    return res.data;
  }
}
