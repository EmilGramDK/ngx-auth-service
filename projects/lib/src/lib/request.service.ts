import { Inject, Injectable } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from "@angular/common/http";
import { firstValueFrom, throwError } from "rxjs";
import { catchError, retry, map } from "rxjs/operators";
import { AuthService } from "./auth.service";
import { ApiSettings, AUTH_CONFIG, AuthServiceConfig } from "./config";

@Injectable({
  providedIn: "root",
})
export class RequestService {
  constructor(
    @Inject(AUTH_CONFIG) private config: AuthServiceConfig,
    private authService: AuthService,
    private http: HttpClient
  ) {
    this._handleError = this._handleError.bind(this);
  }

  /**
   * Makes a request to the API.
   * @param method The HTTP method to use.
   * @param route The API route to call.
   * @param data The data to send with the request.
   * @param customApiSettings Custom API settings to use for this request.
   * @param replacements An array of word replacements where the key is the word to replace and the value is the replacement word.
   * @param disableCache Whether to disable the cache for this request.
   * @returns An observable with the response data.
   * @throws If the the user is not logged in.
   */
  public async makeRequest<T>(
    method: string,
    route: string,
    data?: any,
    customApiSettings?: Partial<ApiSettings>,
    keyReplacements?: { [key: string]: string },
    disableCache?: boolean
  ) {
    const tokens = this.authService.getTokens();
    const apiToken = tokens?.token;

    if (!apiToken) {
      throw new Error("No token available. Please log in first.");
    }

    const apiSettings = { ...this.config.apiSettings, ...customApiSettings };

    const url = `${apiSettings.apiURL}/${route}`;
    let request;

    const options = { headers: this._getHeaders(apiToken, disableCache) };

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
      case "DELETE":
        request = this.http.delete<T>(url, options);
        break;
      default:
        throw new Error(`Unsupported request method: ${method}`);
    }

    return firstValueFrom(
      request.pipe(
        map((response) => this._transformKeys(response)),
        map((response) => this._replaceKeys(response, keyReplacements)),
        retry(apiSettings.retryCount || 0),
        catchError((error) => {
          this._handleError(error);
          return throwError(() => error); // Re-emit the error
        })
      )
    );
  }

  /**
   * Gets the headers to send with the request.
   * @returns The headers to send with the request.
   */
  private _getHeaders(
    token: string,
    disableCache: boolean = false
  ): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Cache-Control": disableCache
        ? "no-cache, no-store, must-revalidate"
        : "",
    });
  }

  /**
   * Handles an HTTP error.
   * @param error The error to handle.
   * @returns An observable with the error message.
   */
  private async _handleError(error: HttpErrorResponse) {
    console.error("An error occurred:", error);

    throw error;

    /* not throwing error back to application
    return throwError(
      () => new Error(`Something went wrong; ${error.message}`)
    );
    */
  }

  /**
   * Recursively traverses and replaces keys in the response object.
   * @param obj The response object.
   * @param replacements An array of word replacements where the key is the word to replace and the value is the replacement word.
   * @returns The modified object.
   */
  private _replaceKeys(
    obj: any,
    replacements?: { [key: string]: string }
  ): any {
    if (!replacements) return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this._replaceKeys(item, replacements));
    } else if (obj !== null && typeof obj === "object") {
      const newObj: { [key: string]: any } = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const newKey = replacements[key] || key; // Replace key if it exists in replacements, otherwise use original key
          newObj[newKey] = this._replaceKeys(obj[key], replacements);
        }
      }
      return newObj;
    } else {
      return obj;
    }
  }

  /**
   * Transforms the keys of an object.
   * @param obj The object to transform.
   * @returns The object with the keys transformed.
   */
  private _transformKeys(obj: any): any {
    try {
      if (!this.config.apiSettings?.transformKeys) {
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
