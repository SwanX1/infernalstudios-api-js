import http from 'http';
import https from 'https';
import Cache from 'node-cache';
import { Client } from './Client';
import { Mod, ModSchema } from './Mod';
import { Redirect, RedirectSchema } from './Redirect';
import { Token, TokenSchema } from './Token';
import { User, UserSchema } from './User';
import { copyProps, handlePossibleError, PACKAGE_NAME, PACKAGE_VERSION, RequestError, Response } from './Util';
import { Version, VersionSchema } from './Version';

interface RequestConfig<Method extends 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET' | 'POST' | 'PUT' | 'DELETE'> {
  method: Method;
  path: string;
  body?: Method extends 'POST' | 'PUT' ? unknown : undefined;
  usesToken?: boolean;
  throwError?: boolean;
  headers?: Record<string, string | string[] | number>;
}

export class BaseManager {
  public client: Client;
  protected baseUrl: string;
  private tokenGetter: () => string | undefined;
  protected cache: Cache = new Cache({
    stdTTL: 360,
    useClones: false,
    deleteOnExpire: false,
    forceString: false,
  });

  public constructor(client: Client, baseUrl: string, tokenGetter: () => string | undefined) {
    this.client = client;
    this.baseUrl = baseUrl;
    this.tokenGetter = tokenGetter;
  }

  protected get token(): string {
    const token = this.tokenGetter();
    if (!token) {
      throw new Error('No token');
    }
    return token;
  }

  private get requestMethod(): (
    options: http.RequestOptions,
    callback: (res: http.IncomingMessage) => void
  ) => http.ClientRequest {
    return this.baseUrl.startsWith('https') ? https.request : http.request;
  }

  private _agent?: http.Agent;
  private get agent(): http.Agent {
    if (typeof this._agent === 'undefined') {
      this._agent = new http.Agent({
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: Infinity,
        maxFreeSockets: 256,
      });
    }
    return this._agent;
  }

  protected request<T>(options: RequestConfig): Promise<Response<T>> {
    return new Promise((resolve, reject) => {
      options.usesToken = options.usesToken ?? true;
      const requestOptions: http.RequestOptions = {};
      const url = new URL(`${this.baseUrl}/${options.path}`);
      requestOptions.agent = this.agent;
      requestOptions.path = url.pathname + url.search;
      requestOptions.hostname = url.hostname;
      if (url.port) {
        requestOptions.port = Number(url.port);
      }
      requestOptions.method = options.method;
      if (options.headers) {
        requestOptions.headers = options.headers;
      }
      if (!requestOptions.headers) {
        requestOptions.headers = {};
      }
      if (options.usesToken) {
        requestOptions.headers['Authorization'] = `Bearer ${this.token}`;
      }
      if (typeof options.body !== 'undefined') {
        const content = JSON.stringify(options.body);
        requestOptions.headers['Content-Type'] = 'application/json';
        requestOptions.headers['Content-Length'] = Buffer.byteLength(content);
      }
      requestOptions.headers['Accept'] = 'application/json';
      requestOptions.headers['Accept-Encoding'] = 'gzip';
      requestOptions.headers['User-Agent'] = `NodeJS ${process.version} (${JSON.stringify(
        PACKAGE_NAME
      )} ${PACKAGE_VERSION})`;
      const request = this.requestMethod(requestOptions, res => {
        const data: Buffer[] = [];
        res.on('data', chunk => {
          data.push(chunk);
        });

        res.on('end', () => {
          if (typeof res.statusCode === 'undefined') {
            reject(new Error('No status code from server'));
            return;
          }

          const endFunction = res.statusCode >= 400 ? reject : resolve;

          let parsed: T | undefined;
          if (data.length === 0) {
            parsed = undefined;
          } else {
            parsed = JSON.parse(data.toString());
          }

          endFunction({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed as T,
          });
        });
      });

      if (typeof options.body !== 'undefined') {
        request.write(JSON.stringify(options.body));
      }
      request.end();
    });
  }
}

export class ModManager extends BaseManager {
  public async get(id: string): Promise<Mod | void> {
    if (!this.cache.has('mod/' + id)) {
      const response = await this.request<ModSchema>({
        method: 'GET',
        path: id,
        usesToken: false,
      });

      switch (response.statusCode) {
        case 200:
          this.cache.set('mod/' + id, new Mod(response.body, this.client));
          break;
        case 404:
          return;
        default:
          handlePossibleError(response);
      }
    }
    return this.cache.get('mod/' + id) as Mod;
  }

  public async getAll(): Promise<Mod[]> {
    if (!this.cache.has('mods')) {
      const response = await this.request<ModSchema[]>({
        method: 'GET',
        path: '',
        usesToken: false,
      });

      handlePossibleError(response);

      const mods = response.body.map(mod => new Mod(mod, this.client));
      this.cache.mset(mods.map(mod => ({ key: 'mod/' + mod.id, val: mod })));
      this.cache.set('mods', mods);
    }
    return this.cache.get('mods') as Mod[];
  }

  public async create(id: string, name: string, url: string): Promise<Mod> {
    if (this.cache.has('mod/' + id)) {
      throw new RequestError(['Mod already exists'], 400);
    }

    const response = await this.request<ModSchema>({
      method: 'POST',
      path: '',
      body: {
        id,
        name,
        url,
      },
      usesToken: true,
    });

    handlePossibleError(response);

    const mod = new Mod(response.body, this.client);
    this.cache.set('mod/' + id, mod);
    return this.cache.get('mod/' + id) as Mod;
  }

  public async update(id: string, data: Partial<Omit<ModSchema, 'id'>> = {}): Promise<Mod> {
    const response = await this.request<ModSchema>({
      method: 'PUT',
      path: id,
      body: copyProps(data, ['name', 'url']),
      usesToken: true,
    });

    handlePossibleError(response);

    const mod: Mod = this.cache.has('mod/' + id)
      ? (this.cache.get('mod/' + id) as Mod)
      : new Mod(response.body, this.client);
    mod.name = response.body.name;
    mod.url = response.body.url;
    this.cache.set('mod/' + id, mod);
    return this.cache.get('mod/' + id) as Mod;
  }

  public async delete(id: string): Promise<void> {
    const response = await this.request<ModSchema>({
      method: 'DELETE',
      path: id,
      usesToken: true,
    });

    handlePossibleError(response);

    this.cache.del('mod/' + id);
    if (this.cache.has('mods')) {
      const mods = this.cache.get('mods') as Mod[];
      this.cache.set(
        'mods',
        mods.filter(mod => mod.id !== id)
      );
    }

    if (this.cache.has('versions/' + id)) {
      this.cache.del('versions/' + id);
    }

    for (const vKey of this.cache.keys().filter(key => key.startsWith('version/'))) {
      const version = this.cache.get(vKey) as Version;
      if (version.mod === id) {
        this.cache.del(vKey);
      }
    }
  }

  public async getVersions(mod: string): Promise<Version[]> {
    if (!this.cache.has('version/' + mod)) {
      const response = await this.request<VersionSchema[]>({
        method: 'GET',
        path: `${mod}/versions`,
        usesToken: false,
      });

      handlePossibleError(response);

      const versions = response.body.map(version => new Version(version, mod, this.client));
      this.cache.mset(
        versions.map(version => ({
          key: `version/${mod}/${version.id}/${version.minecraft}/${version.loader}`,
          val: version,
        }))
      );
      this.cache.set('versions/' + mod, versions);
    }
    return this.cache.get('versions/' + mod) as Version[];
  }

  public async createVersion(mod: string, data: VersionSchema): Promise<Version> {
    if (this.cache.has(`version/${mod}/${data.id}/${data.minecraft}/${data.loader}`)) {
      throw new RequestError(['Version already exists'], 400);
    }

    const response = await this.request<VersionSchema>({
      method: 'POST',
      path: `${mod}/versions`,
      body: copyProps(data, ['id', 'name', 'url', 'minecraft', 'recommended', 'changelog', 'loader', 'dependencies']),
      usesToken: true,
    });

    handlePossibleError(response);

    const version = new Version(response.body, mod, this.client);
    this.cache.set(`version/${mod}/${version.id}/${version.minecraft}/${version.loader}`, version);
    if (this.cache.has('versions/' + mod)) {
      (this.cache.get(`versions/${mod}`) as Version[]).push(version);
    }
    return this.cache.get(`version/${mod}/${version.id}/${version.minecraft}/${version.loader}`) as Version;
  }

  public async deleteVersion(mod: string, version: string, loader: string, minecraft: string): Promise<void> {
    // `${this.baseUrl}/${mod}/versions?version=${version}&loader=${loader}&minecraft=${minecraft}`,
    const response = await this.request<VersionSchema>({
      method: 'DELETE',
      path: `${mod}/versions?version=${encodeURI(version)}/${encodeURI(minecraft)}/${encodeURI(loader)}`,
      usesToken: true,
    });

    handlePossibleError(response);

    this.cache.del(`version/${mod}/${version}/${minecraft}/${loader}`);
    if (this.cache.has('versions/' + mod)) {
      const versions = this.cache.get('versions/' + mod) as Version[];
      this.cache.set(
        'versions/' + mod,
        versions.filter(v => v.id !== version)
      );
    }
  }
}

export class RedirectManager extends BaseManager {
  public async getAll(): Promise<Redirect[]> {
    if (!this.cache.has('redirects')) {
      const response = await this.request<RedirectSchema[]>({
        method: 'GET',
        path: '',
        usesToken: false,
      });

      handlePossibleError(response);

      const redirects = response.body.map(redirect => new Redirect(redirect, this.client));
      this.cache.mset(redirects.map(redirect => ({ key: 'redirect/' + redirect.id, val: redirect })));
      this.cache.set('redirects', redirects);
    }
    return this.cache.get('redirects') as Redirect[];
  }

  public async create(id: string, name: string, url: string, path: string): Promise<Redirect> {
    if (this.cache.has('redirect/' + id)) {
      throw new RequestError(['Redirect already exists'], 400);
    }

    const response = await this.request<RedirectSchema>({
      method: 'POST',
      path: '',
      body: {
        id,
        name,
        url,
        path,
      },
      usesToken: true,
    });

    handlePossibleError(response);

    const redirect = new Redirect(response.body, this.client);
    this.cache.set('redirect/' + id, redirect);
    return this.cache.get('redirect/' + id) as Redirect;
  }

  public async update(id: string, data: Partial<Omit<RedirectSchema, 'id'>>): Promise<Redirect> {
    const response = await this.request<RedirectSchema>({
      method: 'PUT',
      path: id,
      body: copyProps(data, ['name', 'path', 'url']),
      usesToken: true,
    });

    handlePossibleError(response);

    const newRedirect = new Redirect(response.body, this.client);
    if (this.cache.has('redirect/' + id)) {
      const redirect = this.cache.get('redirect/' + id) as Redirect;
      redirect.name = newRedirect.name;
      redirect.path = newRedirect.path;
      redirect.url = newRedirect.url;
    }

    return this.cache.get('redirect/' + id) as Redirect;
  }

  public async delete(id: string): Promise<void> {
    const response = await this.request<RedirectSchema>({
      method: 'DELETE',
      path: id,
      usesToken: true,
    });

    handlePossibleError(response);

    this.cache.del('redirect/' + id);
    if (this.cache.has('redirects')) {
      const redirects = this.cache.get('redirects') as Redirect[];
      this.cache.set(
        'redirects',
        redirects.filter(r => r.id !== id)
      );
    }
  }
}

export class TokenManager extends BaseManager {
  public async createLoginToken(username: string, password: string): Promise<Token> {
    const response = await this.request<TokenSchema>({
      method: 'POST',
      path: 'login',
      body: {
        username,
        password,
      },
      usesToken: false,
    });

    handlePossibleError(response);

    const token = new Token(response.body, this.client);
    return token;
  }

  public async check(token: string | Token): Promise<boolean> {
    if (token instanceof Token) {
      token = token.id;
    }
    const response = await this.request<{ valid: boolean }>({
      method: 'GET',
      path: 'login',
      usesToken: false,
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.body.valid;
  }

  public async createToken(expiry: number, reason: string, permissions: string[] = []): Promise<Token> {
    const response = await this.request<TokenSchema>({
      method: 'POST',
      path: 'token',
      body: { expiry, reason, permissions },
      usesToken: true,
    });

    handlePossibleError(response);

    const token = new Token(response.body, this.client);
    return token;
  }

  public async delete(token: string | Token): Promise<void> {
    if (token instanceof Token) {
      token = token.id;
    }
    const response = await this.request<TokenSchema>({
      method: 'DELETE',
      path: 'token/' + token,
      usesToken: true,
    });

    handlePossibleError(response);
  }
}

export class UserManager extends BaseManager {
  public async getAll(): Promise<User[]> {
    if (!this.cache.has('users')) {
      const response = await this.request<UserSchema[]>({
        method: 'GET',
        path: '',
        usesToken: true,
      });

      handlePossibleError(response);

      const users = response.body.map(user => new User(user, this.client));
      this.cache.mset(users.map(user => ({ key: 'user/' + user.id, val: user })));
      this.cache.set('users', users);
    }

    return this.cache.get('users') as User[];
  }

  public async get(username: string): Promise<User> {
    if (!this.cache.has('user/' + username)) {
      const response = await this.request<UserSchema>({
        method: 'GET',
        path: username,
        usesToken: true,
      });

      handlePossibleError(response);

      const user = new User(response.body, this.client);
      username = user.id;
      this.cache.set('user/' + username, user);
    }

    return this.cache.get('user/' + username) as User;
  }

  public async create(username: string, password: string): Promise<User> {
    if (this.cache.has('user/' + username)) {
      throw new RequestError(['User already exists'], 400);
    }

    const response = await this.request<UserSchema>({
      method: 'POST',
      path: '',
      body: {
        id: username,
        password,
      },
      usesToken: true,
    });

    handlePossibleError(response);

    const user = new User(response.body, this.client);
    username = user.id;
    this.cache.set('user/' + username, user);
    return this.cache.get('user/' + username) as User;
  }

  public async update(
    username: string,
    data: Partial<{
      password: string;
      permissions: string[];
    }> = {}
  ): Promise<User> {
    const response = await this.request<UserSchema>({
      method: 'PUT',
      path: username,
      body: copyProps(data, ['password', 'permissions']),
      usesToken: true,
    });

    handlePossibleError(response);

    const newUser = new User(response.body, this.client);
    if (this.cache.has('user/' + username)) {
      const user = this.cache.get('user/' + username) as User;
      user.permissions = newUser.permissions;
    }

    return this.cache.get('user/' + username) as User;
  }

  public async delete(username: string): Promise<void> {
    const response = await this.request<UserSchema>({
      method: 'DELETE',
      path: username,
      usesToken: true,
    });

    handlePossibleError(response);

    this.cache.del('user/' + username);
    if (this.cache.has('users')) {
      const users = this.cache.get('users') as User[];
      this.cache.set(
        'users',
        users.filter(u => u.id !== username)
      );
    }
  }

  public async getSelf(): Promise<User> {
    if (!this.cache.has('self')) {
      const response = await this.request<UserSchema>({
        method: 'GET',
        path: 'self',
        usesToken: true,
      });

      handlePossibleError(response);

      const user = new User(response.body, this.client);
      this.cache.set('user/self', user);
      this.cache.set('user/' + user.id, user);
    }

    return this.cache.get('user/self') as User;
  }

  public async updateSelf(
    data: Partial<{
      password: string;
      passwordChangeRequested: boolean;
    }> = {}
  ): Promise<User> {
    const response = await this.request<UserSchema>({
      method: 'PUT',
      path: 'self',
      body: copyProps(data, ['password', 'passwordChangeRequested']),
      usesToken: true,
    });

    handlePossibleError(response);

    const newUser = new User(response.body, this.client);
    if (this.cache.has('user/self')) {
      const user = this.cache.get('user/self') as User;
      user.passwordChangeRequested = newUser.passwordChangeRequested;
    } else if (this.cache.has('user/' + newUser.id)) {
      const user = this.cache.get('user/' + newUser.id) as User;
      user.passwordChangeRequested = newUser.passwordChangeRequested;
      this.cache.set('user/self', user);
    } else {
      this.cache.set('user/self', newUser);
      this.cache.set('user/' + newUser.id, newUser);
    }

    return this.cache.get('user/self') as User;
  }
}
