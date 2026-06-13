'use client';
import { motion } from 'framer-motion';

interface SymbolProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/* ─── CulturalEmblem ─────────────────────────────────────────────────────── */
// Generic "medallion" badge: a circular glow-ring frame around a large emoji
// glyph. Emoji are professionally designed full-color icons (Apple/Google/
// Microsoft type foundries) — used here instead of hand-drawn SVG art for
// LionAndSun and the Iranian Cultural Heritage symbols below.

interface CulturalEmblemProps {
  emoji: string;
  size?: number;
  color?: string;
  animated?: boolean;
  className?: string;
}

export function CulturalEmblem({
  emoji,
  size = 64,
  color = '#fbbf24',
  animated = false,
  className = '',
}: CulturalEmblemProps) {
  const content = (
    <div
      className={className}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle, ${color}33 0%, ${color}0d 70%)`,
        border: `2px solid ${color}`,
        fontSize: size * 0.55,
        lineHeight: 1,
      }}
    >
      <span>{emoji}</span>
    </div>
  );

  if (animated) {
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
        style={{ display: 'inline-flex', color }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

/* ─── LionAndSun ─────────────────────────────────────────────────────────── */
// Iran's "Lion and Sun" emblem (شیر و خورشید): a gold medallion with the lion
// face emoji and a small sun badge.

export function LionAndSun({ size = 100, className = '', animated = false }: SymbolProps) {
  const content = (
    <div
      className={className}
      aria-hidden="true"
      style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}
    >
      <CulturalEmblem emoji="🦁" color="#fbbf24" size={size} />
      <span
        style={{
          position: 'absolute',
          top: '-6%',
          insetInlineEnd: '-6%',
          fontSize: size * 0.32,
          lineHeight: 1,
        }}
      >
        ☀️
      </span>
    </div>
  );

  if (animated) {
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
        {content}
      </motion.div>
    );
  }

  return content;
}

/* ─── FaravaharSimple ────────────────────────────────────────────────────── */

export function FaravaharSimple({ size = 100, className = '', animated = false }: SymbolProps) {
  // Aspect: viewBox 200x80, so height = size * 80/200
  const height = (size * 80) / 200;

  const svgContent = (
    <svg
      width={size}
      height={height}
      viewBox="0 0 200 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Central disc */}
      <circle cx="100" cy="40" r="15" stroke="currentColor" strokeWidth="2" />

      {/* Simple human figure in disc center */}
      {/* Head */}
      <circle cx="100" cy="31" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {/* Body */}
      <line x1="100" y1="35" x2="100" y2="47" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Right arm reaching up */}
      <line x1="100" y1="38" x2="108" y2="34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Left arm */}
      <line x1="100" y1="38" x2="92" y2="36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

      {/* Right wing — arcing right with 3 feather lines */}
      <path
        d="M 115,40 C 130,32 155,28 185,30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 115,40 C 128,38 150,36 178,38"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M 115,40 C 128,44 148,45 172,46"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Right wing fill */}
      <path
        d="M 115,40 C 140,20 170,22 185,30 C 170,34 140,38 115,40"
        fill="currentColor"
        opacity="0.15"
      />

      {/* Left wing — mirror of right wing */}
      <path
        d="M 85,40 C 70,32 45,28 15,30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 85,40 C 72,38 50,36 22,38"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M 85,40 C 72,44 52,45 28,46"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Left wing fill */}
      <path
        d="M 85,40 C 60,20 30,22 15,30 C 30,34 60,38 85,40"
        fill="currentColor"
        opacity="0.15"
      />

      {/* Tail — two downward curved lines */}
      <path
        d="M 96,54 C 93,62 90,68 88,75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M 104,54 C 107,62 110,68 112,75"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );

  if (animated) {
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
        {svgContent}
      </motion.div>
    );
  }

  return svgContent;
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
