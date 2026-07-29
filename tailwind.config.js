/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        ink: '#0B1220', panel: '#101A2C', panel2: '#0E1626', line: '#1D2A42',
        fg: '#E8ECF3', muted: '#8A97AC', faint: '#5A667E',
        lo: '#22C6B8', mid: '#F2B33D', hi: '#F0533F',
        btc: '#E8963C', eth: '#8A7BF0', gold: '#E3C05A',
        silver: '#B8C4D4', pall: '#7FD0C9', ndx: '#5FA8F5', ai: '#F06FA8',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
