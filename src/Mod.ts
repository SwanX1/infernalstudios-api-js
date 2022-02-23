import { Client } from './Client';
import { Version, VersionSchema } from './Version';

export class Mod {
  public id: string;
  public name: string;
  public url: string;
  public client: Client;

  constructor(mod: ModSchema, client: Client) {
    this.id = mod.id;
    this.name = mod.name;
    this.url = mod.url;
    this.client = client;
  }

  public async update(data: Partial<Omit<ModSchema, 'id'>>): Promise<this> {
    const response = await this.client.mods.update(this.id, data);
    this.name = response.name;
    this.url = response.url;
    return this;
  }

  public async delete(): Promise<void> {
    return await this.client.mods.delete(this.id);
  }

  public async getVersions(): Promise<Version[]> {
    return await this.client.mods.getVersions(this.id);
  }

  public async addVersion(version: VersionSchema): Promise<Version> {
    return await this.client.mods.createVersion(this.id, version);
  }

  public toJSON(): ModSchema {
    return {
      id: this.id,
      name: this.name,
      url: this.url,
    };
  }
}

export interface ModSchema {
  id: string;
  name: string;
  url: string;
}
