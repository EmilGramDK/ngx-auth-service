import { InjectionToken } from "@angular/core";

// Defines the shape of the configuration object for the AuthService.
export interface AuthServiceConfig {
  authURL: string; // The URL to authenticate users.
  storageKey: string; // Key to store the authentication token in local storage.
  showRenewBeforeTenMin: boolean; // Flag to show renew warning ten minutes before expiration.
  showRenewBeforeFiveMin: boolean; // Flag to show renew warning five minutes before expiration.
}

// Default configuration for the AuthService.
const defaultAuthServiceConfig: AuthServiceConfig = {
  authURL: "https://example.com/auth",
  storageKey: "authToken",
  showRenewBeforeTenMin: true,
  showRenewBeforeFiveMin: true,
};

/**
 * Merges the provided configuration with the default configuration.
 * @param config - Partial configuration provided by the user.
 * @returns A complete AuthServiceConfig object.
 */
export function mergeAuthServiceConfig(
  config: Partial<AuthServiceConfig>
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
