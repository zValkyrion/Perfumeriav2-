import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Lo compilado o generado del radar: sin esto, `npm run lint` en la raíz
    // se ahoga en los chunks de radar/out y no sirve como puerta.
    "radar/.next/**",
    "radar/out/**",
    "radar/salida-sitio/**",
    "radar/.sst/**",
    "radar/sst-env.d.ts",
    "radar/next-env.d.ts",
    "radar/pruebas-locales/.generado/**",
    "radar/.prueba/**",
  ]),
]);

export default eslintConfig;
