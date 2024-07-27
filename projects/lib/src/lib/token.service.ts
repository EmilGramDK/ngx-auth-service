import { inject, Injectable } from "@angular/core";
import { AUTH_CONFIG, AuthServiceConfig } from "./config";

@Injectable({
  providedIn: "root",
})
export class TokenService {
  public token?: string;
  private decodedToken?: any;
  private config: AuthServiceConfig;

  constructor() {
    this.config = inject(AUTH_CONFIG);

    this._checkToken();
  }

  public getToken(): string | undefined {
    return this.token;
  }

  public logout() {
    localStorage.removeItem(this.config.storageKey);
    window.location.href =
      this.config.authURL + "/logout?nextCallback=" + window.location.href;
  }

  public showPopup(type: "expiry" | "user", fixedTime: number = 0) {
    this._showPopup(type, fixedTime);
  }

  public extractInfoFromToken(): {
    timeUntilExpiry: { inMinutes: number; inSeconds: number };
    user: { user_no: string; database: string };
  } {
    try {
      const decodedToken = this.decodedToken!;

      const expirationDate = decodedToken.exp;
      const currentTime = Math.floor(Date.now() / 1000);
      const secondsUntilExpiry = expirationDate - currentTime;
      const minutes = Math.floor(secondsUntilExpiry / 60);

      return {
        timeUntilExpiry: { inMinutes: minutes, inSeconds: secondsUntilExpiry },
        user: {
          user_no: decodedToken.username,
          database: decodedToken.database,
        },
      };
    } catch (error) {
      return {
        timeUntilExpiry: { inMinutes: 0, inSeconds: 0 },
        user: { user_no: "", database: "" },
      };
    }
  }

  private async _setToken(token: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      try {
        localStorage.setItem(this.config.storageKey, token);
        this.token = token;
        this._decodeToken();
        this._scheduleExpiration();
        resolve(true);
      } catch (error) {
        resolve(false);
      }
    });
  }

  private _checkToken() {
    const token = new URLSearchParams(window.location.search).get("token");

    if (token) {
      this._setToken(token);
      return;
    }

    this._getToken().then((token) => {
      if (!token || this._isTokenExpired(token)) {
        window.location.href =
          this.config.authURL + "/login?nextCallback=" + window.location.href;
      } else {
        this._scheduleExpiration();
      }
    });
  }

  private async _getToken(): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
      try {
        const token = localStorage.getItem(this.config.storageKey);
        this.token = token as string;
        resolve(this.token);
      } catch (error) {
        this.token = undefined;
        resolve(undefined);
        console.error("Error getting token:", error);
      }
    });
  }

  private _scheduleExpiration() {
    try {
      if (this.token) {
        const expirationDate = this.decodedToken!.exp;
        const currentTime = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expirationDate - currentTime;

        console.log("Token will expire in", timeUntilExpiry, "seconds");

        if (timeUntilExpiry > 0) {
          this._scheduleExpiryPopup(timeUntilExpiry);
          this._scheduleRedirect(timeUntilExpiry);
        }
      }
    } catch (error) {
      console.error("Error scheduling popup:", error);
    }
  }

  private _scheduleExpiryPopup(timeUntilExpiry: number) {
    const tenMinutes = 10 * 60;
    const fiveMinutes = 5 * 60;

    if (timeUntilExpiry > tenMinutes) {
      setTimeout(() => {
        this._showPopup("expiry", 10);
      }, (timeUntilExpiry - tenMinutes) * 1000);

      setTimeout(() => {
        this._showPopup("expiry", 5);
      }, (timeUntilExpiry - fiveMinutes) * 1000);
    } else {
      this._showPopup("expiry");
    }
  }

  private _scheduleRedirect(timeUntilExpiry: number) {
    setTimeout(() => {
      window.location.href =
        this.config.authURL + "/login?nextCallback=" + window.location.href;
    }, timeUntilExpiry * 1000);
  }

  private _decodeToken() {
    if (this.token) {
      this.decodedToken = this._decodeJWT(this.token);
    }
  }

  private _isTokenExpired(token: string): boolean {
    try {
      this._decodeToken();
      const expirationDate = this.decodedToken!.exp * 1000;
      const currentTime = Date.now();
      return expirationDate < currentTime;
    } catch (error) {
      return true;
    }
  }

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

    const closePopup = document.getElementById("tokenService_closePopup");
    const renewSession = document.getElementById("tokenService_renewSession");

    closePopup?.addEventListener("click", () => {
      document.body.removeChild(popup);
    });

    renewSession?.addEventListener("click", () => {
      window.location.href =
        this.config.authURL + "/login?nextCallback=" + window.location.href;
    });
  }

  private _getPopupHTML(type: "expiry" | "user", fixedTime: number = 0) {
    const tokenInfo = this.extractInfoFromToken();
    const minutes =
      fixedTime > 0 ? fixedTime : tokenInfo.timeUntilExpiry.inMinutes;

    const userMessage = `
    You are logged in as<br />
    <span style="text-transform: uppercase; font-weight: bold;">${tokenInfo.user.user_no}</span>
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
      <button style="background-color: #22303c; color: white; padding: 8px 16px; border-radius: 8px; font-size: 0.875rem; font-weight: bold; border: none; cursor: pointer;" id="tokenService_closePopup">
        CLOSE
      </button>
      <button style="background-color: #111827; color: white; padding: 8px 16px; border-radius: 8px; font-size: 0.875rem; font-weight: bold; border: none; cursor: pointer;" id="tokenService_renewSession">
        RENEW SESSION
      </button>
    </div>
  `;
    return popupHTML;
  }

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
}
