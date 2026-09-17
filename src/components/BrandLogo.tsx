import React from 'react';
import { BRAND_GLYPH_PATH, BRAND_WORDMARK_PATH } from './brandLogoPaths';

interface BrandLogoProps {
  className?: string;
  variant?: 'full' | 'glyph';
  height?: number | string;
  /** Override the wordmark colour when placed on a different surface. */
  textColor?: string;
  /** Override the angled "H" glyph colour. */
  glyphColor?: string;
}

const BRAND_BRIGHT_GREEN = '#05ef28';

/** Faithful vector trace of the supplied Hack-Key Tech logo artwork. */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  variant = 'full',
  height = 36,
  textColor,
  glyphColor,
}) => {
  const glyphFill = glyphColor || BRAND_BRIGHT_GREEN;
  const wordmarkFill = textColor || BRAND_BRIGHT_GREEN;
  const isGlyph = variant === 'glyph';

  return (
    <svg
      viewBox={isGlyph ? '0 0 153 108' : '0 0 428 108'}
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      style={{ height, width: 'auto' }}
      role="img"
      aria-label={isGlyph ? 'Hack-Key Tech' : 'Hack-Key Tech Support'}
    >
      <path d={BRAND_GLYPH_PATH} fill={glyphFill} fillRule="evenodd" />
      {!isGlyph && <path d={BRAND_WORDMARK_PATH} fill={wordmarkFill} fillRule="evenodd" />}
    </svg>
  );
};
