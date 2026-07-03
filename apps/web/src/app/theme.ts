import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const MyCustomPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{purple.50}',
      100: '{purple.100}',
      200: '{purple.200}',
      300: '{purple.300}',
      400: '{purple.400}',
      500: '{purple.500}',
      600: '{purple.600}',
      700: '{purple.700}',
      800: '{purple.800}',
      900: '{purple.900}',
      950: '{purple.950}'
    },
    // Configuração global de border radius da aplicação em REM
    borderRadius: {
      none: '0',
      xs: '0.125rem',   // 2px
      sm: '0.25rem',    // 4px
      md: '0.375rem',   // 6px
      lg: '0.5rem',     // 8px (Padrão usado pela maioria dos componentes médios do PrimeNG)
      xl: '0.75rem'     // 12px
    }
  },
  components: {
    button: {
      root: {
        paddingX: '0.75rem',
        paddingY: '0.375rem',
      }
    }
  }
});
