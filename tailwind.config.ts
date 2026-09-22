import type { Config } from 'tailwindcss';
import { PALETTE, SCALE_GRADIENT } from './metrics-core/palette';

/* Farben kommen aus metrics-core/palette.ts, damit Tailwind-Klassen, SVG-Charts und
   Snapshot-Daten nie auseinanderlaufen. Der Angular-Builder findet diese Datei selbst
   (tailwind.config.ts steht auf seiner Suchliste) — eine postcss.config braucht es nicht. */
export default {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: { ...PALETTE },
      backgroundImage: { skala: SCALE_GRADIENT },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
