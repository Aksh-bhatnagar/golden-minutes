import { useId } from "react";

export default function LogoMark({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, "");

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      aria-hidden="true" 
      className="shrink-0 drop-shadow-md"
    >
      <defs>
        {/* Clip path keeps everything inside the perfect circle */}
        <clipPath id={`${id}-orb-clip`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
        
        {/* Blur to create the fluid mesh gradient */}
        <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>

        {/* Glossy 3D reflection gradient */}
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Base Canvas */}
      <circle cx="32" cy="32" r="32" fill="#fffaf0" />
      
      {/* Animated Fluid Gradients */}
      <g clipPath={`url(#${id}-orb-clip)`}>
        <g filter={`url(#${id}-blur)`}>
          
          {/* Luminous Blue */}
          <circle cx="16" cy="16" r="28" fill="#2a8af6" opacity="0.95">
            <animate attributeName="cx" values="12; 52; 12" dur="6s" ease="ease-in-out" repeatCount="indefinite" />
            <animate attributeName="cy" values="12; 40; 12" dur="8s" ease="ease-in-out" repeatCount="indefinite" />
          </circle>

          {/* Electric Purple */}
          <circle cx="12" cy="48" r="26" fill="#e85dff" opacity="0.9">
            <animate attributeName="cx" values="8; 48; 8" dur="9s" ease="ease-in-out" repeatCount="indefinite" />
            <animate attributeName="cy" values="52; 16; 52" dur="7s" ease="ease-in-out" repeatCount="indefinite" />
          </circle>

          {/* Vivid Orange */}
          <circle cx="48" cy="48" r="30" fill="#ff7a2d" opacity="0.95">
            <animate attributeName="cx" values="56; 16; 56" dur="8s" ease="ease-in-out" repeatCount="indefinite" />
            <animate attributeName="cy" values="56; 20; 56" dur="6s" ease="ease-in-out" repeatCount="indefinite" />
          </circle>

          {/* Vibrant Teal */}
          <circle cx="52" cy="16" r="26" fill="#1ee3b5" opacity="0.9">
            <animate attributeName="cx" values="56; 20; 56" dur="7s" ease="ease-in-out" repeatCount="indefinite" />
            <animate attributeName="cy" values="12; 52; 12" dur="9s" ease="ease-in-out" repeatCount="indefinite" />
          </circle>

          {/* Golden Center Pulse (FIXED: Reduced max radius and opacity) */}
          <circle cx="32" cy="32" r="24" fill="#ffe873" opacity="0.6">
            {/* Radius only goes up to 26 instead of 34, so it never swallows the whole shape */}
            <animate attributeName="r" values="16; 26; 16" dur="5s" ease="ease-in-out" repeatCount="indefinite" />
            {/* Opacity peaks at 0.75 instead of 1.0, keeping it translucent */}
            <animate attributeName="opacity" values="0.4; 0.75; 0.4" dur="5s" ease="ease-in-out" repeatCount="indefinite" />
          </circle>

        </g>

        {/* 3D Gloss Top Reflection */}
        <ellipse 
          cx="32" 
          cy="14" 
          rx="22" 
          ry="11" 
          fill={`url(#${id}-gloss)`} 
          className="mix-blend-overlay"
        />
      </g>

      {/* Glassy rim for structure */}
      <circle 
        cx="32" 
        cy="32" 
        r="31.5" 
        fill="none" 
        stroke="#ffffff" 
        strokeWidth="2" 
        opacity="0.9" 
      />
      
      {/* Subtle outer dark border */}
      <circle 
        cx="32" 
        cy="32" 
        r="31.5" 
        fill="none" 
        stroke="#000000" 
        strokeWidth="1" 
        opacity="0.06" 
      />
    </svg>
  );
}