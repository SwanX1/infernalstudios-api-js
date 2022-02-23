import { ModManager, RedirectManager, TokenManager, UserManager } from './ResourceManager';
import { Token } from './Token';

export class Client {
  private static readonly BASE_URL = 'http://[::]:8080/api';

  public mods: ModManager = new ModManager(this, Client.BASE_URL + '/mods', () => this.token);
  public redirects: RedirectManager = new RedirectManager(this, Client.BASE_URL + '/redirects', () => this.token);
  public tokens: TokenManager = new TokenManager(this, Client.BASE_URL + '/auth', () => this.token);
  public users: UserManager = new UserManager(this, Client.BASE_URL + '/users', () => this.token);

  private token?: string;

  public async login(token: string | Token): Promise<void> {
    if (token instanceof Token) {
      token = token.id;
    }

    if (await this.tokens.check(token)) {
      this.token = token;
    } else {
      throw new Error('Invalid token');
    }
  }
}
