import { Injectable } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from "@angular/common/http";
import { firstValueFrom, throwError } from "rxjs";
import { catchError, retry, map } from "rxjs/operators";
import { AuthService } from "./auth.service";

@Injectable({
  providedIn: "root",
})
export class RequestService {
  private apiSettings?: ApiSettings;
  private token?: string;

  constructor(private authService: AuthService, private http: HttpClient) {
    const tokens = this.authService.getTokens();
    this.token = tokens?.token;
  }

  /**
   * Sets the API settings.
   * @param apiURL The base URL of the API.
   * @param transformKeys Whether to remove the first underscore from object keys. Default is `false`.
   * @param retryCount The number of times to retry the request. Default is `0`.
   */
  public setSettings(
    apiURL: string,
    transformKeys: boolean = false,
    retryCount: number = 0
  ): void {
    this.apiSettings = {
      apiURL: apiURL.replace(/\/$/, ""), // Remove trailing slash
      transformKeys,
      retryCount,
    };
  }

  /**
   * Makes a request to the API.
   * @param method The HTTP method to use.
   * @param route The API route to call.
   * @param data The data to send with the request.
   * @param customApiSettings Custom API settings to use for this request.
   * @returns An observable with the response data.
   * @throws If the API settings are not set or the user is not logged in.
   */
  public async makeRequest<T>(
    method: string,
    route: string,
    data?: any,
    customApiSettings?: Partial<ApiSettings>
  ) {
    if (!this.apiSettings && !customApiSettings) {
      throw new Error(
        "API settings not set. Call requestService.setSettings() first."
      );
    }

    if (!this.token) {
      throw new Error("No token available. Please log in first.");
    }

    const apiSettings = { ...this.apiSettings, ...customApiSettings };

    const url = `${apiSettings.apiURL}/${route}`;
    let request;

    const options = { headers: this._getHeaders() };

    switch (method) {
      case "GET":
        request = this.http.get<T>(url, options);
        break;
      case "POST":
        request = this.http.post<T>(url, data, options);
        break;
      case "PUT":
        request = this.http.put<T>(url, data, options);
        break;
      case "PATCH":
        request = this.http.patch<T>(url, data, options);
        break;
      default:
        throw new Error(`Unsupported request method: ${method}`);
    }

    return firstValueFrom(
      request.pipe(
        map((response) => this._transformKeys(response)),
        retry(apiSettings.retryCount || 0),
        catchError(this._handleError)
      )
    );
  }

  /**
   * Gets the headers to send with the request.
   * @returns The headers to send with the request.
   */
  private _getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    });
  }

  /**
   * Handles an HTTP error.
   * @param error The error to handle.
   * @returns An observable with the error message.
   */
  private async _handleError(error: HttpErrorResponse) {
    console.error("An error occurred:", error);
    return throwError(
      () => new Error("Something went wrong; please try again later.")
    );
  }

  /**
   * Transforms the keys of an object.
   * @param obj The object to transform.
   * @returns The object with the keys transformed.
   */
  private _transformKeys(obj: any): any {
    try {
      if (!this.apiSettings!.transformKeys) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map((item) => this._transformKeys(item));
      } else if (obj !== null && typeof obj === "object") {
        return Object.keys(obj).reduce((acc, key) => {
          const newKey = key.startsWith("_") ? key.slice(1) : key;
          acc[newKey] = this._transformKeys(obj[key]);
          return acc;
        }, {} as any);
      }
      return obj;
    } catch (error) {
      console.error(error);
      return obj;
    }
  }
}

export interface ApiSettings {
  apiURL: string;
  transformKeys: boolean;
  retryCount: number;
}
