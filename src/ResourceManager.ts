import axios, { AxiosRequestConfig } from 'axios';
import { Client } from './Client';
import { Mod, ModSchema } from './Mod';
import { Redirect, RedirectSchema } from './Redirect';
import { Token, TokenSchema } from './Token';
import { User, UserSchema } from './User';
import { Version, VersionSchema } from './Version';

export class BaseManager {
  public client: Client;
  protected baseUrl: string;
  private tokenGetter: () => string | undefined;

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

  protected get config(): AxiosRequestConfig {
    return {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    };
  }
}

export class ModManager extends BaseManager {
  public async get(id: string): Promise<Mod> {
    const response = await axios.get<ModSchema>(`${this.baseUrl}/${id}`, this.config);
    return new Mod(response.data, this.client);
  }

  public async create(id: string, name: string, url: string): Promise<Mod> {
    const response = await axios.post<ModSchema>(
      this.baseUrl,
      {
        id,
        name,
        url,
      },
      this.config
    );
    return new Mod(response.data, this.client);
  }

  public async update(id: string, data: Partial<Omit<ModSchema, 'id'>> = {}): Promise<Mod> {
    const response = await axios.put<ModSchema>(
      `${this.baseUrl}/${id}`,
      {
        name: data.name,
        url: data.url,
      },
      this.config
    );
    return new Mod(response.data, this.client);
  }

  public async delete(id: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/${id}`, this.config);
  }

  public async getVersions(mod: string): Promise<Version[]> {
    const response = await axios.get<VersionSchema[]>(`${this.baseUrl}/${mod}/versions`, this.config);
    return response.data.map(version => new Version(version, mod, this.client));
  }

  public async createVersion(mod: string, data: VersionSchema): Promise<Version> {
    const response = await axios.post<VersionSchema>(
      `${this.baseUrl}/${mod}/versions`,
      {
        id: data.id,
        name: data.name,
        url: data.url,
        minecraft: data.minecraft,
        recommended: data.recommended,
        changelog: data.changelog,
        loader: data.loader,
        dependencies: data.dependencies,
      },
      this.config
    );
    return new Version(response.data, mod, this.client);
  }

  public async deleteVersion(mod: string, version: string, loader: string, minecraft: string): Promise<void> {
    await axios.delete(
      `${this.baseUrl}/${mod}/versions?version=${version}&loader=${loader}&minecraft=${minecraft}`,
      this.config
    );
  }
}

export class RedirectManager extends BaseManager {
  public async getAll(): Promise<Redirect[]> {
    const response = await axios.get<RedirectSchema[]>(this.baseUrl, this.config);

    return response.data.map((redirect: RedirectSchema) => new Redirect(redirect, this.client));
  }

  public async create(id: string, name: string, url: string, path: string): Promise<Redirect> {
    const response = await axios.post<RedirectSchema>(
      this.baseUrl,
      {
        id,
        name,
        url,
        path,
      },
      this.config
    );

    return new Redirect(response.data, this.client);
  }

  public async update(id: string, data: Partial<Omit<RedirectSchema, 'id'>>): Promise<Redirect> {
    const response = await axios.put<RedirectSchema>(
      `${this.baseUrl}/${id}`,
      {
        name: data.name,
        url: data.url,
        path: data.path,
      },
      this.config
    );

    return new Redirect(response.data, this.client);
  }

  public async delete(id: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/${id}`, this.config);
  }
}

export class TokenManager extends BaseManager {
  public async createLoginToken(username: string, password: string): Promise<Token> {
    const response = await axios.post<TokenSchema>(`${this.baseUrl}/login`, { username, password });
    return new Token(response.data, this.client);
  }

  public async check(token: string | Token): Promise<boolean> {
    if (token instanceof Token) {
      token = token.id;
    }
    const response = await axios.get<{ valid: boolean }>(`${this.baseUrl}/token`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.valid;
  }

  public async createToken(expiry: number, reason: string, permissions: string[] = []): Promise<Token> {
    const response = await axios.post<TokenSchema>(
      `${this.baseUrl}/token`,
      { expiry, reason, permissions },
      this.config
    );
    return new Token(response.data, this.client);
  }

  public async delete(token: string | Token): Promise<void> {
    if (token instanceof Token) {
      token = token.id;
    }
    await axios.delete(`${this.baseUrl}/token`, this.config);
  }
}

export class UserManager extends BaseManager {
  public async getAll(): Promise<User[]> {
    const response = await axios.get<UserSchema[]>(this.baseUrl, this.config);
    return response.data.map(user => new User(user, this.client));
  }

  public async get(username: string): Promise<User> {
    const response = await axios.get<UserSchema>(`${this.baseUrl}/${username}`, this.config);
    return new User(response.data, this.client);
  }

  public async create(username: string, password: string): Promise<User> {
    const response = await axios.post<UserSchema>(this.baseUrl, { id: username, password }, this.config);
    return new User(response.data, this.client);
  }

  public async update(
    username: string,
    data: Partial<{
      password: string;
      permissions: string[];
    }> = {}
  ): Promise<User> {
    const response = await axios.put<UserSchema>(
      `${this.baseUrl}/${username}`,
      {
        password: data.password,
        permissions: data.permissions,
      },
      this.config
    );
    return new User(response.data, this.client);
  }

  public async delete(username: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/${username}`, this.config);
  }

  public async getSelf(): Promise<User> {
    const response = await axios.get<UserSchema>(`${this.baseUrl}/self`, this.config);
    return new User(response.data, this.client);
  }

  public async updateSelf(
    data: Partial<{
      password: string;
      passwordChangeRequested: boolean;
    }> = {}
  ): Promise<User> {
    const response = await axios.put<UserSchema>(
      `${this.baseUrl}/self`,
      {
        password: data.password,
        passwordChangeRequested: data.passwordChangeRequested,
      },
      this.config
    );
    return new User(response.data, this.client);
  }
}
