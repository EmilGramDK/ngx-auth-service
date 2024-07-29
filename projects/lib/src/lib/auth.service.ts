import { Inject, Injectable } from "@angular/core";
import { AUTH_CONFIG, AuthServiceConfig } from "./config";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  public hasToken: boolean = false; // Can be used to check if the user is authenticated
  private token?: string;
  private tokenInfo?: TokenInfo;

  // Constructor to initialize AuthService with configuration settings
  constructor(@Inject(AUTH_CONFIG) private config: AuthServiceConfig) {
    try {
      if (this.config._debug) {
        console.log("DEBUG AuthService config:", this.config);
      }
      this._checkToken();
    } catch (error) {
      console.error("Error initializing AuthService:", error);
    }
  }

  /**
   * Retrieves the stored token, if available.
   * @returns The current authentication token or undefined if not set or expired.
   */
  public getToken(): string | undefined {
    try {
      if (this._isTokenExpired(this.token!)) return;
      return this.token;
    } catch (error) {
      console.error("Error retrieving token:", error);
      return;
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
   * Logs the user out by removing the token and redirecting to the logout URL.
   */
  public logout() {
    this._removeCookie();
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
    window.location.href =
      this.config.authURL + `/${type}?nextCallback=` + window.location.href;
  }

  /**
   * Checks for a token in the URL or storage and validates it.
   * If the token is invalid or not found, redirects to the login page.
   */
  private _checkToken() {
    const tokenFromURL = new URLSearchParams(window.location.search).get(
      "token"
    );

    if (this.config._debug) {
      console.log("DEBUG tokenFromURL:", tokenFromURL);
    }

    if (tokenFromURL) {
      this._setCookie(tokenFromURL);
      this._setToken(tokenFromURL);
      return;
    }

    const cookieToken = this._getTokenFromCookie();

    if (this.config._debug) {
      console.log("DEBUG cookieToken:", cookieToken);
    }

    if (cookieToken && !this._isTokenExpired(cookieToken)) {
      this._setToken(cookieToken);
      return;
    }

    if (this.config._debug) {
      console.log("DEBUG _disableAutoLogin:", this.config._disableAutoLogin);
    }

    if (!this.config._disableAutoLogin) {
      this._auth("login");
    }
  }

  /**
   * Sets the token in the internal state.
   * @param token - The new authentication token.
   * @returns True if the token was successfully set, otherwise false.
   */
  private _setToken(token: string): boolean {
    try {
      this.token = token;
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
          username: decodedToken.username,
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
  private _scheduleExpiryPopup(timeUntilExpiry: number) {
    const tenMinutes = 10 * 60;
    const fiveMinutes = 5 * 60;

    if (timeUntilExpiry > tenMinutes) {
      if (this.config.showRenewBeforeTenMin) {
        setTimeout(() => {
          this._showPopup("expiry", 10);
        }, (timeUntilExpiry - tenMinutes) * 1000);
      }

      if (this.config.showRenewBeforeFiveMin) {
        setTimeout(() => {
          this._showPopup("expiry", 5);
        }, (timeUntilExpiry - fiveMinutes) * 1000);
      }
    } else {
      this._showPopup("expiry");
    }
  }

  /**
   * Schedules a redirect to the login page after the token expires.
   * @param timeUntilExpiry - Time in seconds until the token expires.
   */
  private _scheduleRedirect(timeUntilExpiry: number) {
    setTimeout(() => {
      this._auth("login");
    }, timeUntilExpiry * 1000);
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
    padding: 24px;
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
    <span style="text-transform: uppercase; font-weight: bold;">${tokenInfo.user.username}</span>
    <br /><br />
    Aras Database<br />
    <span style="text-transform: uppercase; font-weight: bold;">${tokenInfo.user.database}</span>
    <br /><br />
    Your session will expire in<br />
    <span style="font-weight: bold;">${minutes} minutes</span>
  `;

    const expiryMessage = `
    Your session will expire in<br />
    <span style="font-weight: bold;">${minutes} minutes</span>
    <br /><br />
    Would you like to renew your session now?<br /><br />
    If you do not renew your session, you will be redirected<br />
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

  private _setCookie(token: string) {
    try {
      const date = new Date();
      date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
      const expires = "expires=" + date.toUTCString();

      const cookie = `${this.config.storageKey}=${token}; ${expires}; path=/; SameSite=Strict; Secure;`;

      if (this.config._debug) {
        console.log("DEBUG _setCookie:", cookie);
      }

      document.cookie = cookie;
    } catch (error) {
      console.error("Error setting cookie:", error);
    }
  }

  private _getTokenFromCookie(): string {
    try {
      const name = this.config.storageKey + "=";
      const decodedCookie = decodeURIComponent(document.cookie);

      if (this.config._debug) {
        console.log("DEBUG cookie name:", name);
        console.log("DEBUG decodedCookie:", decodedCookie);
      }

      const ca = decodedCookie.split(";");
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == " ") {
          c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
          const token = c.substring(name.length, c.length);

          if (this.config._debug) {
            console.log("DEBUG found token in cookie:", token);
          }

          return token;
        }
      }
      return "";
    } catch (error) {
      console.error("Error getting token from cookie:", error);
      return "";
    }
  }

  private _removeCookie() {
    try {
      document.cookie = `${this.config.storageKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    } catch (error) {
      console.error("Error removing cookie:", error);
    }
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