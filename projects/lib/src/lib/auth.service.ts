import { Inject, Injectable } from "@angular/core";
import { AUTH_CONFIG, AuthServiceConfig } from "./config";
import { HttpClient, HttpParams } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  public hasToken: boolean = false; // Can be used to check if the user is authenticated
  private token?: string;
  private refreshToken?: string;
  private tokenInfo?: TokenInfo;
  private refreshTimeoutId: any;
  private tenMinuteTimeoutId: any;
  private redirectTimeoutId: any;

  // Constructor to initialize AuthService with configuration settings
  constructor(
    @Inject(AUTH_CONFIG) private config: AuthServiceConfig,
    private http: HttpClient
  ) {
    try {
      if (this.config._disable) return; // Disable auto-login for testing

      this._checkToken();
    } catch (error) {
      console.error("Error initializing AuthService:", error);
    }
  }

  /**
   * Retrieves the stored token, if available.
   * @returns The current authentication token or undefined if not set or expired.
   */
  public getTokens(): { token?: string; refreshToken?: string } {
    try {
      if (this._isTokenExpired(this.token!)) return {};
      return { token: this.token, refreshToken: this.refreshToken };
    } catch (error) {
      console.error("Error retrieving token:", error);
      return {};
    }
  }

  /**
   * Retrieves the token information, if available.
   * @returns An object containing time until token expiry and user information.
   */
  public getTokenInfo(): TokenInfo | undefined {
    this._extractInfoFromToken();
    return this.tokenInfo;
  }

  /**
   * Attempts to refresh the authentication token using the refresh token.
   * @returns A promise that resolves to true if the token was refreshed successfully, otherwise false.
   */
  public async tryToRefreshToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.error("No refresh token available.");
      return false;
    }

    let data = new HttpParams().set("refresh_token", this.refreshToken);

    if (this.config?.database) {
      data = data.set("database", this.config.database);
    }

    try {
      const authURL = this._removeTrailingSlash(this.config.authURL);

      const response: any = await firstValueFrom(
        this.http.post(`${authURL}/refresh`, data.toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );
      if (response && response.access_token) {
        this._setCookies(response.access_token, response.refresh_token);
        this._setTokens(response.access_token, response.refresh_token);
        console.log("Token refreshed successfully.");
        return true;
      } else {
        console.error("Failed to refresh token.");
        this._disableRefresh();
        return false;
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      this._disableRefresh();
      return false;
    }
  }

  /**
   * Logs the user out by removing the token and redirecting to the logout URL.
   */
  public logout() {
    this._removeCookies();
    this._auth("logout");
  }

  /**
   * Logs the user in by redirecting to the login URL.
   */
  public login() {
    this._auth("login");
  }

  /**
   * Displays a popup to the user for different purposes like token expiry or user info.
   * @param type - The type of popup, either 'expiry' or 'user'.
   * @param fixedTime - Optional time in minutes for token expiry warning.
   */
  public showPopup(type: "expiry" | "user") {
    this._extractInfoFromToken();
    this._showPopup(type);
  }

  /**
   * Redirects the user to the login or logout page based on the type.
   */
  private _auth(type: "login" | "logout") {
    const dbParam = this.config.database
      ? `&database=${this.config.database}`
      : "";

    const applicationParam = `&appName=${this.config.application}`;
    const authURL = this._removeTrailingSlash(this.config.authURL);

    window.location.href =
      authURL +
      `/${type}?next=` +
      window.location.href +
      dbParam +
      applicationParam;
  }

  /**
   * Checks for a token in the URL or storage and validates it.
   * If the token is invalid or not found, redirects to the login page.
   */
  private _checkToken() {
    const params = new URLSearchParams(window.location.search);
    const tokenFromURL = params.get("token");
    const refreshTokenFromURL = params.get("refresh_token") || "";

    if (tokenFromURL) {
      this._setCookies(tokenFromURL, refreshTokenFromURL);
      this._setTokens(tokenFromURL, refreshTokenFromURL);

      // Remove the token and refresh_token from the URL
      window.history.replaceState({}, document.title, window.location.pathname);

      return;
    }

    const cookieTokens = this._getTokensFromCookie();
    const cookieToken = cookieTokens.token;
    const cookieRefreshToken = cookieTokens.refreshToken;

    if (!this.checkForbiddenPage(cookieToken)) return;

    if (cookieToken && !this._isTokenExpired(cookieToken)) {
      this._setTokens(cookieToken, cookieRefreshToken);
      return;
    }

    if (!this.config._disable) {
      this._auth("login");
    }
  }

  /**
   * Checks if the current page is a forbidden page and logs the user out if it is.
   * @returns True if the page is not forbidden, otherwise false.
   */
  private checkForbiddenPage(cookieToken: string): boolean {
    if (!this.isForbiddenPage()) return true;

    if (this._isTokenExpired(cookieToken)) {
      const baseURL = this._removeTrailingSlash(this.config.baseURL);
      window.location.href = baseURL;
      return false;
    }

    return false;
  }

  public isForbiddenPage(): boolean {
    const location = window.location.href;
    return location.includes("auth_unauthorized");
  }

  /**
   * Redirects the user to the forbidden page with the current route.
   * @param route - The current route to redirect to after login.
   **/
  public goToForbidden(route: string) {
    if (this.isForbiddenPage()) return;
    const baseURL = this._removeTrailingSlash(this.config.baseURL);
    window.location.href = `${baseURL}/auth_unauthorized?route=${encodeURIComponent(
      route
    )}`;
  }

  /**
   * Sets the token in the internal state.
   * @param token - The new authentication token.
   * @returns True if the token was successfully set, otherwise false.
   */
  private _setTokens(token: string, refreshToken?: string): boolean {
    try {
      this.token = token;

      if (refreshToken) {
        this.refreshToken = refreshToken;
      }

      this.hasToken = true;
      this._extractInfoFromToken();
      this._scheduleExpiration();
      return true;
    } catch (error) {
      console.error("Error setting token:", error);
      return false;
    }
  }

  /**
   * Extracts user information and token expiration details from the decoded token.
   * @returns An object containing time until token expiry and user information.
   */
  private _extractInfoFromToken(token: string = "") {
    try {
      const decodedToken = this._decodeJWT(token || this.token!);

      const expirationDate = decodedToken.exp;
      const currentTime = Math.floor(Date.now() / 1000);
      const secondsUntilExpiry = expirationDate - currentTime;
      const minutes = Math.floor(secondsUntilExpiry / 60);

      const tokenInfo = {
        timeUntilExpiry: { inMinutes: minutes, inSeconds: secondsUntilExpiry },
        user: {
          username: decodedToken.username.toLowerCase(),
          database: decodedToken.database,
        },
      };

      this.tokenInfo = tokenInfo;
    } catch (error) {
      console.error("Error extracting token info:", error);
      throw new Error("Error extracting token info");
    }
  }

  /**
   * Schedules actions based on the token's expiration time, such as displaying popups or redirecting.
   */
  private _scheduleExpiration() {
    this._clearTimers();

    try {
      if (this.tokenInfo) {
        console.log(
          "Token will expire in",
          this.tokenInfo.timeUntilExpiry.inMinutes,
          "minutes."
        );

        if (this.tokenInfo.timeUntilExpiry.inSeconds > 0) {
          this._scheduleExpiryPopup(this.tokenInfo.timeUntilExpiry.inSeconds);
          this._scheduleRedirect(this.tokenInfo.timeUntilExpiry.inSeconds);
        }
      }
    } catch (error) {
      console.error("Error scheduling popup:", error);
    }
  }

  /**
   * Schedules a popup to notify the user before the token expires.
   * @param timeUntilExpiry - Time in seconds until the token expires.
   */
  private async _scheduleExpiryPopup(timeUntilExpiryInSeconds: number) {
    let refreshBefore = this.config.refreshBeforeExpireInMinutes || 30;
    refreshBefore = refreshBefore < 11 ? 11 : refreshBefore;
    refreshBefore = refreshBefore > 59 ? 59 : refreshBefore;

    const refreshBeforeInSeconds = refreshBefore * 60;
    const tenMinutesInSeconds = 10 * 60;

    try {
      if (timeUntilExpiryInSeconds > refreshBeforeInSeconds) {
        this.refreshTimeoutId = setTimeout(() => {
          this.tryToRefreshToken();
        }, (timeUntilExpiryInSeconds - refreshBeforeInSeconds) * 1000);

        if (this.config.showRenewBeforeTenMin) {
          this.tenMinuteTimeoutId = setTimeout(() => {
            this._showPopup("expiry", 10);
          }, (timeUntilExpiryInSeconds - tenMinutesInSeconds) * 1000);
        }

        return;
      }

      const response = await this.tryToRefreshToken();

      if (!response) {
        this._showPopup("expiry");
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      this._showPopup("expiry");
    }
  }

  /**
   * Schedules a redirect to the login page after the token expires.
   * @param timeUntilExpiry - Time in seconds until the token expires.
   */
  private _scheduleRedirect(timeUntilExpiry: number) {
    this.redirectTimeoutId = setTimeout(() => {
      this._auth("login");
    }, timeUntilExpiry * 1000);
  }

  private _clearTimers() {
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }
    if (this.tenMinuteTimeoutId) {
      clearTimeout(this.tenMinuteTimeoutId);
      this.tenMinuteTimeoutId = null;
    }
    if (this.redirectTimeoutId) {
      clearTimeout(this.redirectTimeoutId);
      this.redirectTimeoutId = null;
    }
  }

  /**
   * Checks if the token has expired.
   * @param token - The JWT token to check.
   * @returns True if the token is expired, otherwise false.
   */
  private _isTokenExpired(token: string): boolean {
    try {
      this._extractInfoFromToken(token);
      if (this.tokenInfo!.timeUntilExpiry.inSeconds <= 0) {
        return true;
      }
      return false;
    } catch (error) {
      return true;
    }
  }

  /**
   * Displays a popup message with specified information.
   * @param type - The type of popup, either 'expiry' or 'user'.
   * @param fixedTime - Optional fixed time for display.
   */
  private _showPopup(type: "expiry" | "user", fixedTime: number = 0) {
    const currentPopup = document.getElementById("popupService_overlay");
    if (currentPopup) {
      document.body.removeChild(currentPopup);
    }

    const popup = document.createElement("div");
    popup.id = "popupService_overlay";
    popup.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 50;
  `;

    const modal = document.createElement("div");
    modal.style.cssText = `
    background-color: #15202b;
    color: white;
    padding: 2rem 4rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  `;
    modal.innerHTML = this._getPopupHTML(type, fixedTime);

    popup.appendChild(modal);
    document.body.appendChild(popup);

    const closePopup = document.getElementById("authService_closePopup");
    const renewSession = document.getElementById("authService_renewSession");

    closePopup?.addEventListener("click", () => {
      document.body.removeChild(popup);
    });

    renewSession?.addEventListener("click", () => {
      this._auth("login");
    });
  }

  /**
   * Generates the HTML content for the popup based on the type and timing.
   * @param type - The type of popup, either 'expiry' or 'user'.
   * @param fixedTime - Optional fixed time for display.
   * @returns The HTML string for the popup content.
   */
  private _getPopupHTML(type: "expiry" | "user", fixedTime: number = 0) {
    const tokenInfo = this.tokenInfo!;
    const minutes =
      fixedTime > 0 ? fixedTime : tokenInfo.timeUntilExpiry.inMinutes;

    const userMessage = `
    You are logged in as<br />
    <span style="text-transform: uppercase; font-weight: bold;">${
      tokenInfo.user.username
    }</span>
    <br /><br />
    Aras Database<br />
    <span style="text-transform: uppercase; font-weight: bold;">${
      tokenInfo.user.database
    }</span>
    <br /><br />
    Auto Renew<br />
    <span style="font-weight: bold;">${this.refreshToken ? "ON" : "OFF"}</span>
    <br /><br />
    Your session will expire in<br />
    <span style="font-weight: bold;">${minutes} minutes</span>
  `;

    const expiryMessage = `
    Your session will expire in<br />
    <span style="font-weight: bold;">${minutes} minutes</span>
    <br /><br />
    Would you like to renew it now?<br /><br />
    If you choose not to renew, you will be redirected<br />
    to the login page in ${minutes} minutes, so please save your work.
  `;

    const popupHTML = `
    <div style="font-size: 1.125rem; color: #cbd5e0;">
      ${type === "expiry" ? expiryMessage : userMessage}
    </div>

    <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: center;">
      <button style="background-color: #22303c; color: white; padding: 8px 16px; border-radius: 8px; font-size: 0.875rem; font-weight: bold; border: none; cursor: pointer;" id="authService_closePopup">
        CLOSE
      </button>
      <button style="background-color: #111827; color: white; padding: 8px 16px; border-radius: 8px; font-size: 0.875rem; font-weight: bold; border: none; cursor: pointer;" id="authService_renewSession">
        RENEW SESSION
      </button>
    </div>
  `;
    return popupHTML;
  }

  /**
   * Decodes a JWT token string to extract its payload.
   * @param token - The JWT token string.
   * @returns The decoded payload as an object.
   */
  private _decodeJWT(token: string): any {
    try {
      // Split the JWT into its three parts
      const [header, payload, signature] = token.split(".");

      // Decode the payload
      const decodedPayload = this._base64UrlDecode(payload);

      // Parse the JSON string
      return JSON.parse(decodedPayload);
    } catch (error) {
      console.error("Error decoding JWT", error);
      return null;
    }
  }

  /**
   * Decodes a base64 URL encoded string.
   * @param base64Url - The base64 URL encoded string.
   * @returns The decoded string.
   */
  private _base64UrlDecode(base64Url: string): string {
    // Replace non-url-safe chars with base64 standard chars
    base64Url = base64Url.replace(/-/g, "+").replace(/_/g, "/");

    // Pad out with standard base64 required padding characters
    const pad =
      base64Url.length % 4 === 0 ? "" : "=".repeat(4 - (base64Url.length % 4));
    const base64 = base64Url + pad;

    // Decode base64 string
    return atob(base64);
  }

  private _setCookies(token: string, refreshToken?: string) {
    try {
      this._setCookie(token, this.config.storageKey!);

      if (refreshToken) {
        this._setCookie(refreshToken, this.config.storageKey + "_refresh");
      }
    } catch (error) {
      console.error("Error setting cookies:", error);
    }
  }

  private _setCookie(token: string, name: string) {
    try {
      const date = new Date();
      date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
      const expires = "expires=" + date.toUTCString();

      const cookie = `${name}=${token}; ${expires}; path=/; SameSite=Strict; Secure;`;

      document.cookie = cookie;
    } catch (error) {
      console.error("Error setting cookie:", error);
    }
  }

  private _getTokensFromCookie(): { token: string; refreshToken?: string } {
    try {
      const token = this._getCookie(this.config.storageKey!);

      const refreshToken = this._getCookie(this.config.storageKey + "_refresh");

      if (refreshToken) {
        return { token, refreshToken };
      }

      return { token };
    } catch (error) {
      console.error("Error getting token from cookie:", error);
      return { token: "" };
    }
  }

  private _getCookie(name: string) {
    try {
      const cookieName = name + "=";
      const decodedCookie = decodeURIComponent(document.cookie);

      const ca = decodedCookie.split(";");
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == " ") {
          c = c.substring(1);
        }
        if (c.indexOf(cookieName) == 0) {
          return c.substring(cookieName.length, c.length);
        }
      }
      return "";
    } catch (error) {
      console.error("Error getting cookie:", error);
      return "";
    }
  }

  private _disableRefresh() {
    this.refreshToken = undefined;
    this._removeCookie(this.config.storageKey + "_refresh");
  }

  private _removeCookies() {
    try {
      this._removeCookie(this.config.storageKey!);
      this._removeCookie(this.config.storageKey + "_refresh");
    } catch (error) {
      console.error("Error removing cookie:", error);
    }
  }

  private _removeCookie(name: string) {
    try {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    } catch (error) {
      console.error("Error removing cookie:", error);
    }
  }

  private _removeTrailingSlash(url: string) {
    return url.endsWith("/") ? url.slice(0, -1) : url;
  }
}

/**
 * Defines the shape of the token information object.
 * @param timeUntilExpiry - The time until the token expires.
 * @param user - The user information.
 */
export interface TokenInfo {
  timeUntilExpiry: { inMinutes: number; inSeconds: number };
  user: { username: string; database: string };
}
