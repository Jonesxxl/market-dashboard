/** metrics-core · Farbpalette — die einzige Stelle, an der Farbwerte stehen.
 *
 *  Gelesen von `tailwind.config.ts` (Klassen wie `text-lo`, `bg-panel`), von den Charts und
 *  Komponenten im Frontend (SVG-Strings und `[style.color]`-Bindings, die keine Tailwind-Klasse
 *  nutzen können) und von der Registry (Asset-Farben im Snapshot). Vorher standen dieselben
 *  Hex-Werte in über zehn Dateien; eine Farbänderung hieß Suchen und Ersetzen. */
export const PALETTE = {
  // Flächen und Linien, von dunkel nach hell
  ink: '#0B1220', panel2: '#0E1626', panel: '#101A2C', line: '#1D2A42',
  // Schrift
  fg: '#E8ECF3', muted: '#8A97AC', faint: '#5A667E',
  // Zustand: günstig · mittel · heiß. Farbe trägt auf der Seite nie allein eine Aussage.
  lo: '#22C6B8', mid: '#F2B33D', hi: '#F0533F',
  // Asset-Farben — dieselben in Karten, Generator und Tailwind-Klassen
  btc: '#E8963C', eth: '#8A7BF0', gold: '#E3C05A', silver: '#B8C4D4',
  pall: '#7FD0C9', ndx: '#5FA8F5', ai: '#F06FA8',
} as const;

/** Farbband der Rail und der Skala auf der Startseite: 0 günstig … 1 heiß. */
export const SCALE_GRADIENT =
  `linear-gradient(90deg, ${PALETTE.lo} 0%, ${PALETTE.lo} 15%, ${PALETTE.mid} 50%, ${PALETTE.hi} 88%)`;

/** Farbband für Metriken ohne Zonen (Währungen): Es gibt kein günstig oder teuer, nur
 *  „ungewöhnlich weit vom Trend" — deshalb hell an beiden Rändern, dunkel in der Mitte,
 *  ohne die Wertungsfarben. */
export const SCALE_GRADIENT_NEUTRAL =
  `linear-gradient(90deg, ${PALETTE.muted} 0%, ${PALETTE.faint} 25%, ${PALETTE.line} 50%, ${PALETTE.faint} 75%, ${PALETTE.muted} 100%)`;
