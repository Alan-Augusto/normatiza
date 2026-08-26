import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { firstValueFrom } from 'rxjs';

import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { MyCustomPreset } from './theme';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authInterceptor])),

    /**
     * O access token vive em memória, e recarregar a página zera a memória. Sem
     * esta tentativa antes do primeiro roteamento, o `authGuard` rodaria contra
     * uma sessão ainda vazia e mandaria para o login quem tem o cookie de
     * refresh válido — ou seja, F5 deslogaria.
     *
     * Falhar aqui é o caminho normal de quem ainda não entrou: `restoreSession`
     * engole o erro de propósito.
     */
    provideAppInitializer(() => firstValueFrom(inject(AuthService).restoreSession())),

    providePrimeNG({
      theme: {
        preset: MyCustomPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: {
            name: 'primeng',
            order: 'theme, base, primeng'
          }
        }
      }
    })
  ]
};
