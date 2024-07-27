# Auth Service Library for Angular

## Overview

The **Auth Service Library for Angular** is a streamlined and reusable authentication solution for Angular applications. Developed for internal use at our workplace, this library simplifies the process of integrating authentication into our Angular projects. By importing this library, developers can easily implement authentication features, ensuring consistency and reducing development time across multiple applications.

## Features

- **Seamless Integration**: Easily integrate authentication into Angular applications by importing this library.
- **Standardized Authentication**: Provides a consistent authentication flow across all projects.
- **Configurable**: Allows customization for different authentication needs and use cases.
- **Secure**: Implements best practices for secure authentication and user management.

## Installation

To install the library, use the following npm command:

```bash
npm install @emilgramdk/auth-service
```

## Usage

1. **Setup / Configuration**: Configure the library with your authentication settings.

   ```typescript
   import { ApplicationConfig } from "@angular/core";
   import { AUTH_CONFIG, AuthServiceConfig } from "@emilgramdk/auth-service";

   const authServiceConfig: AuthServiceConfig = {
     authURL: "https://example.com/auth",
     storageKey: "authToken",
   };

   export const appConfig: ApplicationConfig = {
     providers: [{ provide: AUTH_CONFIG, useValue: authServiceConfig }],
   };
   ```

2. **Using the Service in a Component**: Inject the AuthService into your components.

   ```typescript
   import { AuthService } from "@emilgramdk/auth-service";

   @Component({
     selector: "app-root",
     templateUrl: "./app.component.html",
   })
   export class AppComponent {
     constructor(public authService: AuthService) {}

     showUserInfo() {
       this.authService.showPopup("user");
     }
   }
   ```

3. **Using the Service in API Service**: Inject the AuthService into your service.

   ```typescript
   import { AuthService } from "@emilgramdk/auth-service";

   @Injectable({
     providedIn: "root",
   })
   export class APIService {
     private apiURL = config.apiURL;

     constructor(
       private http: HttpClient,
       private tokenService: TokenService
     ) {}

     private getURL(route: string): string {
       return `${this.apiURL}${route}`;
     }

     private async getHeaders(
       contentType: string = "application/json"
     ): Promise<HttpHeaders> {
       const token = this.tokenService.token; // get the token from the authService

       return new HttpHeaders({
         Authorization: `Bearer ${token}`,
         "Content-Type": contentType,
       });
     }
   }
   ```

## License

This project is licensed under the MIT License.
