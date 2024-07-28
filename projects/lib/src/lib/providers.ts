import {
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from "@angular/core";
import {
  AUTH_CONFIG,
  AuthServiceConfig,
  mergeAuthServiceConfig,
} from "./config";

/**
 * Allows to provide the `AuthService` configuration.
 *
 * @example
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideAuthService({ authURL: 'https://example.com/auth', storageKey: 'myApp' })],
 * };
 */
export function provideAuthService(
  config: Partial<AuthServiceConfig>
): EnvironmentProviders {
  const mergedConfig = mergeAuthServiceConfig(config);
  return makeEnvironmentProviders([
    { provide: AUTH_CONFIG, useValue: mergedConfig },
  ]);
}
