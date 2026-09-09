import React from 'react';

interface BrandLogoProps {
  className?: string;
  variant?: 'full' | 'glyph';
  height?: number | string;
  textColor?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  variant = 'full',
  height = 36,
  textColor,
}) => {
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
        <g fill="#05ef28">
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
      viewBox="0 0 540 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ height, width: 'auto' }}
      aria-label="Hack-Key Tech Support"
    >
      {/* Stylized Angled H Glyph */}
      <g fill="#05ef28">
        {/* Left Angled Stem */}
        <polygon points="45,0 95,0 55,120 5,120" />
        {/* Right Angled Stem */}
        <polygon points="140,0 190,0 150,120 100,120" />
        {/* Connecting Horizontal Bar */}
        <polygon points="45,45 155,45 145,75 35,75" />
      </g>

      {/* Wordmark Text */}
      {/* Top: HACK_KEY */}
      <text
        x="240"
        y="65"
        fontFamily="'Archivo', sans-serif"
        fontWeight="900"
        fontSize="64"
        fill={textColor || '#05ef28'}
        letterSpacing="1"
      >
        HACK_KEY
      </text>
      {/* Bottom: TECH SUPPORT */}
      <text
        x="242"
        y="104"
        fontFamily="'Archivo', sans-serif"
        fontWeight="600"
        fontSize="28"
        fill={textColor || '#05ef28'}
        letterSpacing="11"
      >
        TECH SUPPORT
      </text>
    </svg>
  );
};
