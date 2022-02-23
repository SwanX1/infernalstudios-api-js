import { Client } from './Client';
import { Mod } from './Mod';

export class Version {
  public id: string;
  public name: string;
  public url: string;
  public minecraft: string;
  public recommended: boolean;
  public changelog: string;
  public loader: string;
  public dependencies: VersionDependency[];
  public client: Client;
  private mod: string;

  constructor(version: VersionSchema, mod: string, database: Client) {
    this.id = version.id;
    this.name = version.name;
    this.url = version.url;
    this.minecraft = version.minecraft;
    this.recommended = version.recommended;
    this.changelog = version.changelog;
    this.loader = version.loader;
    this.dependencies = version.dependencies;
    this.client = database;
    this.mod = mod;
  }

  public async getMod(): Promise<Mod> {
    return this.client.mods.get(this.mod);
  }

  public async delete(): Promise<void> {
    await this.client.mods.deleteVersion(this.mod, this.id, this.loader, this.minecraft);
  }

  public toJSON(): VersionSchema {
    return {
      id: this.id,
      name: this.name,
      url: this.url,
      minecraft: this.minecraft,
      recommended: this.recommended,
      changelog: this.changelog,
      loader: this.loader,
      dependencies: this.dependencies,
    };
  }
}

export interface VersionSchema {
  id: string;
  name: string;
  url: string;
  minecraft: string;
  recommended: boolean;
  changelog: string;
  loader: string;
  dependencies: VersionDependency[];
}

export interface VersionDependency {
  id: string;
  url: string;
  required: boolean;
  side: string;
  version: string;
}
