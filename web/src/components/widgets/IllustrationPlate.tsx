"use client";

import { useState, type ReactNode } from "react";

export type Pin = {
  x: number;
  y: number;
  label: string;
  description?: string;
};

export type IllustrationPlateProps = {
  children: ReactNode;
  pins?: Pin[];
  caption?: string;
  viewBox?: string;
  className?: string;
};

export function SketchFilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="sketch" x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

export default function IllustrationPlate({
  children,
  pins = [],
  caption,
  viewBox = "0 0 600 320",
  className = "",
}: IllustrationPlateProps) {
  const [openPin, setOpenPin] = useState<number | null>(null);

  return (
    <figure className={`widget-container bg-card border border-border rounded-xl p-6 my-8 overflow-hidden ${className}`}>
      <svg viewBox={viewBox} className="w-full" role="img" aria-label={caption ?? "Illustration"}>
        <g filter="url(#sketch)">{children}</g>
        {pins.map((pin, i) => (
          <g
            key={i}
            tabIndex={0}
            onMouseEnter={() => setOpenPin(i)}
            onMouseLeave={() => setOpenPin((p) => (p === i ? null : p))}
            onFocus={() => setOpenPin(i)}
            onBlur={() => setOpenPin((p) => (p === i ? null : p))}
            onClick={() => setOpenPin((p) => (p === i ? null : i))}
            style={{ cursor: "pointer", outline: "none" }}
          >
            <circle cx={pin.x} cy={pin.y} r={10} fill="rgba(249,115,22,0.2)" stroke="#f97316" strokeWidth={1.5} />
            <text x={pin.x} y={pin.y + 4} textAnchor="middle" fill="#f97316" fontSize="11" fontFamily="monospace" pointerEvents="none">
              {i + 1}
            </text>
            {openPin === i && (
              <g pointerEvents="none">
                <rect
                  x={pin.x + 14}
                  y={pin.y - 22}
                  width={Math.max(80, pin.label.length * 7 + 14)}
                  height={pin.description ? 40 : 22}
                  fill="rgba(13,13,15,0.95)"
                  stroke="rgba(255,255,255,0.15)"
                  rx={4}
                />
                <text x={pin.x + 21} y={pin.y - 7} fill="#e4e4e7" fontSize="11" fontFamily="monospace">
                  {pin.label}
                </text>
                {pin.description && (
                  <text x={pin.x + 21} y={pin.y + 8} fill="rgba(228,228,231,0.7)" fontSize="10" fontFamily="monospace">
                    {pin.description}
                  </text>
                )}
              </g>
            )}
          </g>
        ))}
      </svg>
      {caption && (
        <figcaption className="text-xs text-muted-foreground text-center mt-3 font-mono">{caption}</figcaption>
      )}
    </figure>
  );
}

export function HeroPlate() {
  return (
    <IllustrationPlate viewBox="0 0 600 240" caption="Open the handbook">
      {/* book spine */}
      <line x1="300" y1="40" x2="300" y2="200" stroke="#f5ecd9" strokeWidth="2" />
      {/* left page */}
      <path d="M 110 60 Q 110 50 120 50 L 295 50 L 295 195 L 120 195 Q 110 195 110 185 Z"
        fill="#18181b" stroke="#f5ecd9" strokeWidth="1.5" />
      {/* right page */}
      <path d="M 305 50 L 480 50 Q 490 50 490 60 L 490 185 Q 490 195 480 195 L 305 195 Z"
        fill="#18181b" stroke="#f5ecd9" strokeWidth="1.5" />
      {/* lines of text */}
      {[80, 100, 120, 140, 160].map((y, i) => (
        <line key={`l${i}`} x1="125" y1={y} x2="285" y2={y} stroke="#f5ecd9" strokeWidth="0.8" opacity="0.6" />
      ))}
      {[80, 100, 120, 140].map((y, i) => (
        <line key={`r${i}`} x1="315" y1={y} x2="475" y2={y} stroke="#f5ecd9" strokeWidth="0.8" opacity="0.6" />
      ))}
      {/* drifting tokens */}
      <circle cx="80" cy="80" r="4" fill="#22d3ee" opacity="0.7" />
      <circle cx="60" cy="140" r="3" fill="#a78bfa" opacity="0.6" />
      <circle cx="520" cy="100" r="5" fill="#f472b6" opacity="0.7" />
      <circle cx="540" cy="170" r="3" fill="#4ade80" opacity="0.6" />
    </IllustrationPlate>
  );
}

export function DividerPlate() {
  return (
    <IllustrationPlate viewBox="0 0 600 80" className="!p-3 !my-4">
      <line x1="40" y1="40" x2="270" y2="40" stroke="#f5ecd9" strokeWidth="1" opacity="0.5" />
      <line x1="330" y1="40" x2="560" y2="40" stroke="#f5ecd9" strokeWidth="1" opacity="0.5" />
      <circle cx="300" cy="40" r="6" fill="none" stroke="#f5ecd9" strokeWidth="1.5" />
      <circle cx="300" cy="40" r="2" fill="#f5ecd9" />
    </IllustrationPlate>
  );
}

export function FooterMascot() {
  return (
    <IllustrationPlate viewBox="0 0 200 200" className="!p-3 !my-4 max-w-[160px] mx-auto">
      {/* head */}
      <circle cx="100" cy="80" r="40" fill="none" stroke="#f5ecd9" strokeWidth="2" />
      {/* eyes */}
      <circle cx="86" cy="76" r="3" fill="#f5ecd9" />
      <circle cx="114" cy="76" r="3" fill="#f5ecd9" />
      {/* smile */}
      <path d="M 84 92 Q 100 102 116 92" fill="none" stroke="#f5ecd9" strokeWidth="2" strokeLinecap="round" />
      {/* body */}
      <path d="M 70 120 L 70 165 Q 70 175 80 175 L 120 175 Q 130 175 130 165 L 130 120 Z"
        fill="none" stroke="#f5ecd9" strokeWidth="2" />
      {/* arm holding a book */}
      <rect x="105" y="135" width="28" height="20" fill="none" stroke="#f5ecd9" strokeWidth="1.5" />
      <line x1="119" y1="135" x2="119" y2="155" stroke="#f5ecd9" strokeWidth="1" />
    </IllustrationPlate>
  );
}
