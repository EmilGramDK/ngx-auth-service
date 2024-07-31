import { InjectionToken } from "@angular/core";

// Defines the shape of the configuration object for the AuthService.
export interface AuthServiceConfig {
  authURL: string; // The URL to authenticate users.
  database?: string; // The database to authenticate users.
  storageKey?: string; // Key to store the authentication token in local storage.
  refreshBeforeExpireInMinutes?: number; // Time in minutes to renew the token before expiration.
  showRenewBeforeTenMin?: boolean; // Flag to show renew warning ten minutes before expiration.
  _disable?: boolean; // Flag to disable auto-login. Used for testing.
  _debug?: boolean; // Flag to enable debug mode.
}

// Default configuration for the AuthService.
const defaultAuthServiceConfig: AuthServiceConfig = {
  authURL: "https://example.com/auth",
  storageKey: "authToken",
  refreshBeforeExpireInMinutes: 30,
  showRenewBeforeTenMin: true,
  _disable: false,
  _debug: false,
};

/**
 * Merges the provided configuration with the default configuration.
 * @param config - Partial configuration provided by the user.
 * @returns A complete AuthServiceConfig object.
 */
export function mergeAuthServiceConfig(
  config: Partial<AuthServiceConfig> = {}
): AuthServiceConfig {
  return { ...defaultAuthServiceConfig, ...config };
}

/**
 * Token to provide configuration for the `AuthService`.
 * This token is used to inject the configuration object into the service.
 */
export const AUTH_CONFIG = new InjectionToken<AuthServiceConfig>("authConfig", {
  providedIn: "root",
  factory: (): AuthServiceConfig => {
    return {
      ...defaultAuthServiceConfig,
    };
  },
});

/**
 * This interface is only here for backward compatibility, **do not add it by yourself**
 * @ignore
 */
export interface AuthServiceConfiguration {
  /**
   * @deprecated Use `provideAuthService()` method instead
   */
  config?: AuthServiceConfig;
}
