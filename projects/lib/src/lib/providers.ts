import {
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { AUTH_CONFIG, AuthServiceConfig } from './config';

/**
 * Allows to provide the `AuthService` configuration.
 *
 * @example
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideAuthService({ authURL: 'https://example.com/auth', storageKey: 'myApp' })],
 * };
 */
export function provideAuthService(
  config: AuthServiceConfig
): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: AUTH_CONFIG, useValue: config }]);
}
