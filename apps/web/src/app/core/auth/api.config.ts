import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Raiz das chamadas à API.
 *
 * É um token e não uma constante para que o teste possa apontar para outro
 * lugar sem tocar em código de produção, e para que o build de cada ambiente
 * resolva o seu endereço sem `if (production)` espalhado pelos serviços.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});
