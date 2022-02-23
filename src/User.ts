import { Client } from './Client';

export class User {
  public id: string;
  public permissions: string[];
  public passwordChangeRequested: boolean;
  public client: Client;

  public constructor(user: UserSchema, client: Client) {
    this.id = user.id;
    this.permissions = user.permissions;
    this.passwordChangeRequested = user.passwordChangeRequested;
    this.client = client;
  }

  public async update(data: Partial<UserSchema> = {}): Promise<this> {
    const response = await this.client.users.update(this.id, data);
    this.permissions = response.permissions;
    this.passwordChangeRequested = response.passwordChangeRequested;
    return this;
  }

  public async delete(): Promise<void> {
    return await this.client.users.delete(this.id);
  }

  public toJSON(): UserSchema {
    return {
      id: this.id,
      permissions: this.permissions,
      passwordChangeRequested: this.passwordChangeRequested,
    };
  }
}

export interface UserSchema {
  id: string;
  permissions: string[];
  passwordChangeRequested: boolean;
}
