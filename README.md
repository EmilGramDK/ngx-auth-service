# Auth Service Library for Angular

## Overview

The **Auth Service Library for Angular** is a streamlined and reusable authentication solution for Angular applications. Developed for internal use at our workplace, this library simplifies the process of integrating authentication into our Angular projects. By importing this library, developers can easily implement authentication features, ensuring consistency and reducing development time across multiple applications.

## Features

- **Seamless Integration**: Easily integrate authentication into Angular applications by importing this library.
- **Standardized Authentication**: Provides a consistent authentication flow across all projects.
- **Configurable**: Allows customization for different authentication needs and use cases.

## Installation

To install the library, use the following npm command:

```bash
npm install @emilgramdk/ngx-auth-service
```

## Usage

1. **Setup / Configuration**: Configure the library with your authentication settings.

   ```typescript
   import { ApplicationConfig } from "@angular/core";
   import {
     AuthServiceConfig,
     provideAuthService,
   } from "@emilgramdk/ngx-auth-service";
   import { provideHttpClient } from "@angular/common/http";

   const authServiceConfig: AuthServiceConfig = {
     authURL: "https://auth.example.com", // URL to authenticate users
     baseURL: "https://example.com/app", // Base URL for the application
     storageKey: "authToken", // Token cookie name
     application: "default", // Application name sent to auth app
   };

   export const appConfig: ApplicationConfig = {
     providers: [
       provideHttpClient(), // This is needed to send api request.
       provideAuthService(authServiceConfig),
     ],
   };
   ```

2. **Using the Service in a Component**: Inject the AuthService into your components.

   ```typescript
   import { AuthService } from "@emilgramdk/ngx-auth-service";

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
   import { RequestService } from "@emilgramdk/ngx-auth-service";

   @Injectable({
     providedIn: "root",
   })
   export class APIService {
     private apiURL = config.apiURL;

     constructor(private requestService: RequestService) {
       this.requestService.setSettings("https://api.example.com/");
     }

     public async getAllUsers() {
       const route = "users";
       return this.requestService
         .makeRequest<any>("GET", route)
         .then((response) => response.value);
     }
   }
   ```

## License

This project is licensed under the MIT License.
