import { NgModule, type ModuleWithProviders } from '@angular/core';
import { AUTH_CONFIG, AuthServiceConfiguration } from './config';

/**
 * This module is only here for backward compatibility, **do not add it by yourself**
 *
 * @ignore
 */
@NgModule()
export class TokenModule {
  /**
   * Only useful to provide options, otherwise it does nothing.
   *
   * **Must be used at initialization, ie. in `AppModule`, and must not be loaded again in another module.**
   */
  static forRoot(
    config: AuthServiceConfiguration
  ): ModuleWithProviders<TokenModule> {
    return {
      ngModule: TokenModule,
      providers: [
        config.config !== undefined
          ? { provide: AUTH_CONFIG, useValue: config.config }
          : [],
      ],
    };
  }
}
