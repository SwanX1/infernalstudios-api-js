import { Client } from './Client';

export class Redirect {
  private id: string;
  private name: string;
  private url: string;
  private path: string;
  private database: Client;

  constructor(redirect: RedirectSchema, database: Client) {
    this.id = redirect.id;
    this.name = redirect.name;
    this.url = redirect.url;
    this.path = redirect.path;
    this.database = database;
  }

  public async update(data: Partial<Omit<RedirectSchema, 'id'>>): Promise<this> {
    const response = await this.database.redirects.update(this.id, data);
    this.name = response.name;
    this.url = response.url;
    this.path = response.path;
    return this;
  }

  public async delete(): Promise<void> {
    return await this.database.redirects.delete(this.id);
  }

  public toJSON(): RedirectSchema {
    return {
      id: this.id,
      name: this.name,
      url: this.url,
      path: this.path,
    };
  }
}

export interface RedirectSchema {
  id: string;
  name: string;
  url: string;
  path: string;
}
