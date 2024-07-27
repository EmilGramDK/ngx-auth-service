import { InjectionToken } from '@angular/core';

export interface AuthServiceConfig {
  authURL: string;
  storageKey: string;
}

/**
 * Token to provide configuration for the `AuthService`.
 */
export const AUTH_CONFIG = new InjectionToken<AuthServiceConfig>('authConfig', {
  providedIn: 'root',
  factory: (): AuthServiceConfig => {
    return {
      authURL: 'https://eldx.md-man.biz/auth',
      storageKey: 'authToken',
    };
  },
});

/**
 * This interface is only here for backward compatibility, **do not add it by yourself**
 *
 * @ignore
 */
export interface AuthServiceConfiguration {
  /**
   * @deprecated Use `provideAuthService()` method instead
   */
  config?: AuthServiceConfig;
}
