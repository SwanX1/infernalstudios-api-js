import { Client } from './Client';
import { User } from './User';

export class Token {
  public id: string;
  public user: string;
  public expiry: number;
  public permissions: string[];
  public reason: string;
  public client: Client;

  public constructor(token: TokenSchema, client: Client) {
    this.id = token.id;
    this.user = token.user;
    this.expiry = token.expiry;
    this.permissions = token.permissions;
    this.reason = token.reason;
    this.client = client;
  }

  public async delete(): Promise<void> {
    return await this.client.tokens.delete(this);
  }

  public async check(): Promise<boolean> {
    return await this.client.tokens.check(this);
  }

  public async getUser(): Promise<User> {
    return await this.client.users.get(this.user);
  }

  public toJSON(): TokenSchema {
    return {
      id: this.id,
      user: this.user,
      expiry: this.expiry,
      permissions: this.permissions,
      reason: this.reason,
    };
  }
}

export interface TokenSchema {
  id: string;
  user: string;
  expiry: number;
  permissions: string[];
  reason: string;
}
