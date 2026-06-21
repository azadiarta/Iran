'use client';
import { motion } from 'framer-motion';

interface SymbolProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/* ─── GlowPulse ──────────────────────────────────────────────────────────── */
// Shared 2s glow-pulse wrapper used by the `animated` variant of the symbols
// below. The drop-shadow color follows `currentColor` from the parent.

function GlowPulse({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{
        filter: [
          'drop-shadow(0 0 6px currentColor)',
          'drop-shadow(0 0 18px currentColor)',
          'drop-shadow(0 0 6px currentColor)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      style={{ display: 'inline-flex' }}
    >
      {children}
    </motion.div>
  );
}

/* ─── LionAndSun ─────────────────────────────────────────────────────────── */
// Iran's official historical "Lion and Sun" emblem (شیر و خورشید), rendered
// from a Public Domain SVG (frontend/public/symbols/lion-and-sun.svg).

const LION_AND_SUN_RATIO = 270.00001 / 194.99977; // ~1.385

export function LionAndSun({ size = 100, className = '', animated = false }: SymbolProps) {
  const imgHeight = size / LION_AND_SUN_RATIO;

  const content = (
    <div
      className={className}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src="/symbols/lion-and-sun.svg"
        alt=""
        width={size}
        height={imgHeight}
        style={{ width: size, height: imgHeight, display: 'block' }}
      />
    </div>
  );

  if (animated) {
    return <GlowPulse>{content}</GlowPulse>;
  }

  return content;
}

/* ─── HandsEmblem ────────────────────────────────────────────────────────── */
// The Iranian Political Association (Birmingham) emblem — clasped hands —
// the org's real logo (frontend/public/branding/ipa-birmingham.jpg), shown
// at full opacity. The same image also renders site-wide as a faint
// background watermark (SiteBackground.tsx) — unrelated to this component.

const HANDS_EMBLEM_RATIO = 833 / 748; // ~1.114 (intrinsic JPEG dimensions)

export function HandsEmblem({ size = 100, className = '', animated = false }: SymbolProps) {
  const imgHeight = size / HANDS_EMBLEM_RATIO;

  const content = (
    <div
      className={className}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src="/branding/ipa-birmingham.jpg"
        alt=""
        width={size}
        height={imgHeight}
        style={{ width: size, height: imgHeight, display: 'block' }}
      />
    </div>
  );

  if (animated) {
    return <GlowPulse>{content}</GlowPulse>;
  }

  return content;
}

/* ─── FaravaharSimple ────────────────────────────────────────────────────── */
// The Faravahar (فروهر), rendered from a Public Domain SVG
// (frontend/public/symbols/faravahar.svg).

const FARAVAHAR_RATIO = 529.9035 / 249.62308; // ~2.123

export function FaravaharSimple({ size = 100, className = '', animated = false }: SymbolProps) {
  const height = size / FARAVAHAR_RATIO;

  const content = (
    <img
      src="/symbols/faravahar.svg"
      alt=""
      width={size}
      height={height}
      className={className}
      aria-hidden="true"
      style={{ width: size, height, display: 'block' }}
    />
  );

  if (animated) {
    return <GlowPulse>{content}</GlowPulse>;
  }

  return content;
}

/* ─── GeometricPattern ───────────────────────────────────────────────────── */

export function GeometricPattern({ size = 100, className = '', animated = false }: SymbolProps) {
  // Inner decorative lines from diamond points toward center
  const innerLines = [
    'M 50,5 L 63,32',
    'M 95,50 L 68,37',
    'M 50,95 L 37,68',
    'M 5,50 L 32,63',
    'M 50,5 L 37,32',
    'M 95,50 L 68,63',
    'M 50,95 L 63,68',
    'M 5,50 L 32,37',
  ];

  const svgContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer border */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Square 1 — diamond orientation */}
      <polygon
        points="50,5 95,50 50,95 5,50"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />

      {/* Square 2 — axis-aligned, inscribed in the diamond */}
      <rect
        x="18.2"
        y="18.2"
        width="63.6"
        height="63.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />

      {/* Inner decorative lines */}
      {innerLines.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.6"
        />
      ))}

      {/* Center small circle */}
      <circle cx="50" cy="50" r="6" fill="none" stroke="currentColor" strokeWidth="1" />

      {/* Corner decorative dots */}
      <circle cx="50" cy="14" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="86" cy="50" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="50" cy="86" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="14" cy="50" r="2" fill="currentColor" opacity="0.5" />
    </svg>
  );

  if (animated) {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'inline-flex', transformOrigin: 'center' }}
      >
        {svgContent}
      </motion.div>
    );
  }

  return svgContent;
}

/* ─── Heritage landmark icons ────────────────────────────────────────────── */
// Flat, line-art `currentColor` icons representing five icons of Iranian
// cultural heritage. Designed as tasteful background/decorative elements —
// small or large, low-opacity — rather than page focal points.

/* ─── PersepolisIcon ─────────────────────────────────────────────────────── */
// Twin bull-headed ("Lamassu") columns from the Gate of All Nations.

export function PersepolisIcon({ size = 100, className = '', animated = false }: SymbolProps) {
  const svgContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Mountain backdrop */}
      <path
        d="M 4,58 L 22,38 L 38,50 L 56,30 L 74,46 L 96,40 L 96,62 L 4,62 Z"
        fill="currentColor"
        opacity="0.08"
      />

      {/* Platform */}
      <rect x="6" y="86" width="88" height="4" fill="currentColor" opacity="0.5" />

      {/* Left column shaft */}
      <rect x="25" y="34" width="7" height="52" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="28.5" y1="37" x2="28.5" y2="83" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />

      {/* Right column shaft */}
      <rect x="68" y="34" width="7" height="52" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="71.5" y1="37" x2="71.5" y2="83" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />

      {/* Lintel beam */}
      <rect x="20" y="24" width="60" height="3" fill="currentColor" opacity="0.45" />

      {/* Left bull-head capital (volute facing outward) */}
      <circle cx="22" cy="29" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M 22,24.5 C 25,21.5 30,23 32,27" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="20" y="29" width="18" height="3.5" fill="currentColor" opacity="0.6" />

      {/* Right bull-head capital (mirrored) */}
      <circle cx="78" cy="29" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M 78,24.5 C 75,21.5 70,23 68,27" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="62" y="29" width="18" height="3.5" fill="currentColor" opacity="0.6" />
    </svg>
  );

  if (animated) {
    return <GlowPulse>{svgContent}</GlowPulse>;
  }

  return svgContent;
}

/* ─── PasargadaeIcon ─────────────────────────────────────────────────────── */
// The Tomb of Cyrus the Great — a gabled stone chamber on a stepped plinth.

export function PasargadaeIcon({ size = 100, className = '', animated = false }: SymbolProps) {
  const svgContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Stepped plinth — six tiers, widest at the base */}
      <rect x="15" y="80" width="70" height="6" fill="currentColor" opacity="0.3" />
      <rect x="20" y="74" width="60" height="6" fill="currentColor" opacity="0.35" />
      <rect x="25" y="68" width="50" height="6" fill="currentColor" opacity="0.4" />
      <rect x="30" y="62" width="40" height="6" fill="currentColor" opacity="0.45" />
      <rect x="35" y="56" width="30" height="6" fill="currentColor" opacity="0.5" />
      <rect x="38" y="50" width="24" height="6" fill="currentColor" opacity="0.55" />

      {/* Gabled chamber */}
      <rect x="40" y="34" width="20" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M 37,34 L 50,21 L 63,34 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="46" y="40" width="8" height="10" fill="currentColor" opacity="0.55" />
    </svg>
  );

  if (animated) {
    return <GlowPulse>{svgContent}</GlowPulse>;
  }

  return svgContent;
}

/* ─── NaqsheRostamIcon ───────────────────────────────────────────────────── */
// Cross-shaped Achaemenid rock-cut tomb facade carved into a cliff face.

export function NaqsheRostamIcon({ size = 100, className = '', animated = false }: SymbolProps) {
  const svgContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Cliff backdrop */}
      <path
        d="M 2,95 L 2,38 L 16,22 L 32,34 L 48,12 L 64,30 L 80,10 L 96,28 L 98,38 L 98,95 Z"
        fill="currentColor"
        opacity="0.07"
      />

      {/* Cross shape — vertical bar */}
      <rect x="38" y="18" width="24" height="68" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Cross shape — horizontal bar with engaged columns */}
      <rect x="14" y="42" width="72" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="22" y1="45" x2="22" y2="61" stroke="currentColor" strokeWidth="1.5" />
      <line x1="32" y1="45" x2="32" y2="61" stroke="currentColor" strokeWidth="1.5" />
      <line x1="68" y1="45" x2="68" y2="61" stroke="currentColor" strokeWidth="1.5" />
      <line x1="78" y1="45" x2="78" y2="61" stroke="currentColor" strokeWidth="1.5" />

      {/* False door */}
      <rect x="44" y="68" width="12" height="18" fill="currentColor" opacity="0.5" />

      {/* Relief disc above the door */}
      <circle cx="50" cy="26" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
    </svg>
  );

  if (animated) {
    return <GlowPulse>{svgContent}</GlowPulse>;
  }

  return svgContent;
}

/* ─── HafezIcon ──────────────────────────────────────────────────────────── */
// An open book topped by a singing nightingale — a recurring motif in
// Hafez's ghazals (the nightingale and the rose).

export function HafezIcon({ size = 100, className = '', animated = false }: SymbolProps) {
  const svgContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Open book */}
      <path d="M 50,30 L 50,75 L 15,82 L 15,38 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 50,30 L 50,75 L 85,82 L 85,38 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Page lines */}
      <line x1="22" y1="48" x2="43" y2="44" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="22" y1="56" x2="43" y2="52" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="22" y1="64" x2="43" y2="60" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="78" y1="48" x2="57" y2="44" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="78" y1="56" x2="57" y2="52" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="78" y1="64" x2="57" y2="60" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />

      {/* Nightingale perched on the spine */}
      <g transform="translate(50,18)">
        <ellipse cx="0" cy="4" rx="8" ry="5" fill="currentColor" opacity="0.6" />
        <circle cx="-7" cy="-1" r="3.5" fill="currentColor" opacity="0.6" />
        <path d="M -10,-1 L -14,0 L -10,1.5 Z" fill="currentColor" opacity="0.6" />
        <path d="M 7,5 L 16,1 L 16,8 Z" fill="currentColor" opacity="0.6" />
        <path d="M -2,1 C 2,0 6,2 5,6 C 0,7 -3,5 -2,1 Z" fill="currentColor" opacity="0.3" />
      </g>

      {/* Song notes */}
      <circle cx="34" cy="9" r="1.5" fill="currentColor" opacity="0.4" />
      <circle cx="41" cy="4" r="1.2" fill="currentColor" opacity="0.35" />
    </svg>
  );

  if (animated) {
    return <GlowPulse>{svgContent}</GlowPulse>;
  }

  return svgContent;
}

/* ─── SaadiIcon ──────────────────────────────────────────────────────────── */
// An open book topped by a rose blossom — referencing Saadi's "Golestān"
// ("The Rose Garden").

export function SaadiIcon({ size = 100, className = '', animated = false }: SymbolProps) {
  const svgContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Open book */}
      <path d="M 50,30 L 50,75 L 15,82 L 15,38 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 50,30 L 50,75 L 85,82 L 85,38 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Page lines */}
      <line x1="22" y1="48" x2="43" y2="44" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="22" y1="56" x2="43" y2="52" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="22" y1="64" x2="43" y2="60" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="78" y1="48" x2="57" y2="44" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="78" y1="56" x2="57" y2="52" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      <line x1="78" y1="64" x2="57" y2="60" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />

      {/* Rose blossom above the spine */}
      <g transform="translate(50,15)">
        <circle cx="0" cy="0" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="-4" cy="-2" r="3" fill="currentColor" opacity="0.5" />
        <circle cx="4" cy="-2" r="3" fill="currentColor" opacity="0.5" />
        <circle cx="-3" cy="3" r="3" fill="currentColor" opacity="0.5" />
        <circle cx="3" cy="3" r="3" fill="currentColor" opacity="0.5" />
        {/* Stem and leaf */}
        <line x1="0" y1="3" x2="0" y2="14" stroke="currentColor" strokeWidth="1" />
        <path d="M 0,9 C 4,8 6,10 5,13 C 2,13 0,11 0,9 Z" fill="currentColor" opacity="0.4" />
      </g>
    </svg>
  );

  if (animated) {
    return <GlowPulse>{svgContent}</GlowPulse>;
  }

  return svgContent;
}
