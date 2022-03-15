export const RequestErrorCodes: Record<string, string> = {
  INSUFFICIENT_PERMISSIONS: 'Insuficient permissions',
  INVALID_BODY: 'Invalid body',
  INVALID_LOGIN: 'Invalid login',
  INVALID_TOKEN: 'Invalid token',
  RESOURCE_ALREADY_EXISTS: 'Resource already exists',
  RESOURCE_CONFLICT: 'Resource conflict',
  RESOURCE_NOT_FOUND: 'Resource not found',
  SERVER_ERROR: 'Server error',
  TOO_MANY_REQUESTS: 'Too many requests',
  UNKNOWN_ERROR: 'Unknown error',
};

export class RequestError extends Error {
  public status: number;
  public codes: string[];

  public constructor(codes: string[], status: number) {
    super(codes.join('\n'));
    this.codes = codes;
    this.name = 'RequestError';
    this.status = status;
  }

  public override get message(): string {
    return RequestError.resolveErrors(this.codes).join('\n');
  }

  public static resolveErrors(codes: string[]): string[] {
    return codes.map(code => RequestErrorCodes[code] || code);
  }
}

export function copyProps<T extends unknown, K extends Extract<keyof T, string>>(source: T, props: K[]): Pick<T, K> {
  const target: Pick<T, K> = {} as Pick<T, K>;
  for (const key in props) {
    target[key as K] = (source as Record<K, unknown>)[key as K] as T[K];
  }
  return target;
}

export interface Response<T> {
  statusCode: number;
  headers: { [key: string]: string | string[] | undefined };
  body: T;
}

const messagesToCodes: Record<string, string> = {
  'A mod with this id already exists!': 'RESOURCE_ALREADY_EXISTS',
  'A redirect with this id already exists!': 'RESOURCE_ALREADY_EXISTS',
  'A redirect with this path already exists!': 'RESOURCE_CONFLICT',
  'A token is required for this endpoint': 'INVALID_TOKEN',
  'A user with this id already exists!': 'RESOURCE_ALREADY_EXISTS',
  'A version with this id, loader, and minecraft version combination already exists!': 'RESOURCE_ALREADY_EXISTS',
  'Insufficient permissions': 'INSUFFICIENT_PERMISSIONS',
  'Invalid dependency version': 'INVALID_BODY',
  'Invalid loader parameter': 'INVALID_BODY',
  'Invalid minecraft parameter': 'INVALID_BODY',
  'Invalid username or password': 'INVALID_LOGIN',
  'Invalid version id': 'INVALID_BODY',
  'Invalid version parameter': 'INVALID_BODY',
  'Mod not found': 'RESOURCE_NOT_FOUND',
  'Path not unique': 'RESOURCE_CONFLICT',
  'Redirect not found': 'RESOURCE_NOT_FOUND',
  "The authorization header must be of type 'Bearer'": 'INVALID_TOKEN',
  'The provided token is invalid': 'INVALID_TOKEN',
  'Token not found': 'INVALID_TOKEN',
  'Too many requests': 'TOO_MANY_REQUESTS',
  'Unknown user': 'SERVER_ERROR',
  'User not found': 'RESOURCE_NOT_FOUND',
  'Version not found': 'RESOURCE_NOT_FOUND',
  'You do not have permission to delete this token': 'INSUFFICIENT_PERMISSIONS',
  'You must define one of name, path, url': 'INVALID_BODY',
};

export function handlePossibleError(res: Response<unknown>): void | never {
  if (res.statusCode >= 400) {
    if ('errors' in (res as { body: { errors: unknown } }).body) {
      const errors: unknown[] = (res as { body: { errors: unknown[] } }).body.errors;
      const codes: string[] = [];
      for (const error of errors) {
        if (typeof error === 'object') {
          codes.push('INVALID_BODY');
        } else if (typeof error === 'string') {
          if (error in messagesToCodes) {
            codes.push(messagesToCodes[error]);
          } else {
            codes.push('UNKNOWN_ERROR');
          }
        } else {
          codes.push('UNKNOWN_ERROR');
        }
      }
      throw new RequestError(codes, res.statusCode);
    } else {
      throw new Error('Unexpected error: ' + JSON.stringify(res.body));
    }
  }
}
