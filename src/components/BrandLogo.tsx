import React from 'react';

interface BrandLogoProps {
  className?: string;
  variant?: 'full' | 'glyph';
  height?: number | string;
  /** Override the wordmark colour (e.g. white when placed on a dark surface). */
  textColor?: string;
  /** Override the angled "H" glyph colour. */
  glyphColor?: string;
}

/** Primary brand colour: the deep green used across the storefront chrome. */
const BRAND_DARK_GREEN = '#014040';

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  variant = 'full',
  height = 36,
  textColor,
  glyphColor,
}) => {
  const glyphFill = glyphColor || BRAND_DARK_GREEN;
  const wordmarkFill = textColor || BRAND_DARK_GREEN;

  if (variant === 'glyph') {
    return (
      <svg
        viewBox="0 0 195 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 ${className}`}
        style={{ height, width: 'auto' }}
        aria-label="Hack-Key Tech"
      >
        <g fill={glyphFill}>
          {/* Left Angled Stem */}
          <polygon points="45,0 95,0 55,120 5,120" />
          {/* Right Angled Stem */}
          <polygon points="140,0 190,0 150,120 100,120" />
          {/* Connecting Horizontal Bar */}
          <polygon points="45,45 155,45 145,75 35,75" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 680 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ height, width: 'auto' }}
      aria-label="Hack-Key Tech Support"
    >
      {/* Stylized Angled H Glyph */}
      <g fill={glyphFill}>
        {/* Left Angled Stem */}
        <polygon points="45,0 95,0 55,120 5,120" />
        {/* Right Angled Stem */}
        <polygon points="140,0 190,0 150,120 100,120" />
        {/* Connecting Horizontal Bar */}
        <polygon points="45,45 155,45 145,75 35,75" />
      </g>

      {/* Wordmark Text - Positioned with ample viewBox breathing room to prevent clipping */}
      {/* Top: HACK_KEY */}
      <text
        x="220"
        y="65"
        fontFamily="'Archivo', -apple-system, BlinkMacSystemFont, sans-serif"
        fontWeight="900"
        fontSize="62"
        fill={wordmarkFill}
        letterSpacing="1"
      >
        HACK_KEY
      </text>
      {/* Bottom: TECH SUPPORT */}
      <text
        x="222"
        y="104"
        fontFamily="'Archivo', -apple-system, BlinkMacSystemFont, sans-serif"
        fontWeight="600"
        fontSize="27"
        fill={wordmarkFill}
        letterSpacing="9"
      >
        TECH SUPPORT
      </text>
    </svg>
  );
};
