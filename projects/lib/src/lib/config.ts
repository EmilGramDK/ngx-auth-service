import { InjectionToken } from "@angular/core";

// Defines the shape of the configuration object for the AuthService.
export interface AuthServiceConfig {
  authURL: string; // The URL to authenticate users.
  baseURL: string; // The base url for the application.
  apiSettings: ApiSettings; // API settings.
  database?: string; // The database to authenticate users.
  storageKey?: string; // Key to store the authentication token in local storage.
  application?: string; // Sent to the auth server to identify the application.
  forbiddenPage?: string; // The page to redirect to when the user is not authorized.
  refreshBeforeExpireInMinutes?: number; // Time in minutes to renew the token before expiration.
  showRenewBeforeTenMin?: boolean; // Flag to show renew warning ten minutes before expiration.
  _disable?: boolean; // Flag to disable auto-login. Used for testing.
}

export interface ApiSettings {
  apiURL: string;
  transformKeys: boolean;
  retryCount: number;
}

// Default configuration for the AuthService.
const defaultAuthServiceConfig: AuthServiceConfig = {
  authURL: "https://auth.example.com",
  baseURL: "https://example.com/app",
  apiSettings: {
    apiURL: "https://api.example.com",
    transformKeys: false,
    retryCount: 0,
  },
  storageKey: "authToken",
  application: "default",
  forbiddenPage: "auth_unauthorized",
  refreshBeforeExpireInMinutes: 30,
  showRenewBeforeTenMin: true,
  _disable: false,
};

/**
 * Merges the provided configuration with the default configuration.
 * @param config - Partial configuration provided by the user.
 * @returns A complete AuthServiceConfig object.
 */
export function mergeAuthServiceConfig(
  config: Partial<AuthServiceConfig> = {}
): AuthServiceConfig {
  // remove the last slash from the apiURL and baseURL
  if (config.apiSettings?.apiURL) {
    config.apiSettings.apiURL = _removeTrailingSlash(config.apiSettings.apiURL);
  }
  if (config.baseURL) {
    config.baseURL = _removeTrailingSlash(config.baseURL);
  }

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

const _removeTrailingSlash = (url: string) => {
  return url.endsWith("/") ? url.slice(0, -1) : url;
};
