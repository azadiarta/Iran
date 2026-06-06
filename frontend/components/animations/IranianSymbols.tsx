'use client';
import { motion } from 'framer-motion';

interface SymbolProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/* ─── LionAndSun ─────────────────────────────────────────────────────────── */

export function LionAndSun({ size = 100, className = '', animated = false }: SymbolProps) {
  // 8 sun rays at 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
  const rayAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  const rays = rayAngles.map((angle) => {
    const rad = (angle * Math.PI) / 180;
    const x1 = 100 + Math.cos(rad) * 42;
    const y1 = 100 + Math.sin(rad) * 42;
    const x2 = 100 + Math.cos(rad) * 58;
    const y2 = 100 + Math.sin(rad) * 58;
    return { x1, y1, x2, y2, angle };
  });

  // 8 mane triangles around the head circle at (140, 95) r=18
  const maneTriangles = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180;
    const cx = 140;
    const cy = 95;
    const r = 18;
    const tipX = cx + Math.cos(a) * (r + 8);
    const tipY = cy + Math.sin(a) * (r + 8);
    const base1X = cx + Math.cos(a - 0.35) * r;
    const base1Y = cy + Math.sin(a - 0.35) * r;
    const base2X = cx + Math.cos(a + 0.35) * r;
    const base2Y = cy + Math.sin(a + 0.35) * r;
    return `${base1X},${base1Y} ${tipX},${tipY} ${base2X},${base2Y}`;
  });

  const svgContent = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Sun circle */}
      <circle cx="100" cy="100" r="38" stroke="currentColor" strokeWidth="2" />

      {/* Sun rays */}
      {rays.map((r, i) => (
        <line
          key={i}
          x1={r.x1}
          y1={r.y1}
          x2={r.x2}
          y2={r.y2}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}

      {/* Lion body */}
      <ellipse
        cx="105"
        cy="115"
        rx="45"
        ry="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />

      {/* Mane triangles */}
      {maneTriangles.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="currentColor"
          opacity="0.6"
        />
      ))}

      {/* Lion head */}
      <circle
        cx="140"
        cy="95"
        r="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />

      {/* Lion face — simple dot eyes and nose */}
      <circle cx="135" cy="91" r="1.5" fill="currentColor" />
      <circle cx="143" cy="91" r="1.5" fill="currentColor" />
      <circle cx="139" cy="95" r="1" fill="currentColor" />

      {/* Lion tail: cubic bezier curving up from left body */}
      <path
        d="M 62,110 C 40,100 35,75 50,65 C 55,62 60,68 55,72"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Tail tuft */}
      <path
        d="M 55,72 C 50,68 45,65 48,60 M 55,72 C 52,66 50,60 54,57 M 55,72 C 57,66 58,61 62,60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Sword blade */}
      <rect
        x="95"
        y="70"
        width="5"
        height="60"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Sword crossguard */}
      <rect
        x="88"
        y="85"
        width="24"
        height="5"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Sword handle */}
      <rect
        x="96"
        y="130"
        width="3"
        height="10"
        fill="currentColor"
        opacity="0.7"
      />

      {/* Front legs */}
      <line
        x1="115"
        y1="135"
        x2="112"
        y2="155"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="128"
        y1="136"
        x2="126"
        y2="156"
        stroke="currentColor"
        strokeWidth="2"
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
