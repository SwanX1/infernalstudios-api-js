import { Client } from './Client';

export class Redirect {
  public id: string;
  public name: string;
  public url: string;
  public path: string;
  private client: Client;

  constructor(redirect: RedirectSchema, client: Client) {
    this.id = redirect.id;
    this.name = redirect.name;
    this.url = redirect.url;
    this.path = redirect.path;
    this.client = client;
  }

  public async update(data: Partial<Omit<RedirectSchema, 'id'>>): Promise<this> {
    const response = await this.client.redirects.update(this.id, data);
    this.name = response.name;
    this.url = response.url;
    this.path = response.path;
    return this;
  }

  public async delete(): Promise<void> {
    return await this.client.redirects.delete(this.id);
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
