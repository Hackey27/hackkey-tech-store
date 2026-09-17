import React, { useEffect, useMemo, useState } from 'react';
import { CatalogueItemKind } from '../types';

type ProductImageSize = 'sm' | 'md' | 'lg';

interface ProductImageProps {
  name: string;
  itemId: string;
  imageUrl?: string;
  kind?: CatalogueItemKind;
  size?: ProductImageSize;
  eager?: boolean;
  className?: string;
}

const dimensions: Record<ProductImageSize, number> = { sm: 48, md: 64, lg: 96 };
const sizeClasses: Record<ProductImageSize, string> = {
  sm: 'h-12 w-12 rounded-xl text-sm',
  md: 'h-16 w-16 rounded-2xl text-lg',
  lg: 'h-24 w-24 rounded-2xl text-2xl'
};

const fallbackPalettes = [
  ['#014040', '#05ef28'],
  ['#025656', '#d9ffe0'],
  ['#0f4c3a', '#ecfdf5'],
  ['#173f5f', '#dbeafe'],
  ['#5b3a29', '#fef3c7']
];

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function productInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] || 'HK').slice(0, 2).toUpperCase();
}

/** Google Drive share links return an HTML page, not image bytes. Convert only
 *  recognised share URLs; every other URL is left untouched. */
export function renderableProductImageUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://store.hackeytech.com';
    const url = new URL(value, origin);
    if (url.hostname === 'drive.google.com') {
      const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
      const id = fileMatch?.[1] || url.searchParams.get('id');
      if (id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w512`;
    }
    return url.origin === origin ? `${url.pathname}${url.search}` : url.toString();
  } catch {
    return undefined;
  }
}

export const ProductImage: React.FC<ProductImageProps> = ({
  name,
  itemId,
  imageUrl,
  size = 'md',
  eager = false,
  className = ''
}) => {
  const src = useMemo(() => renderableProductImageUrl(imageUrl), [imageUrl]);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const palette = fallbackPalettes[stableHash(itemId || name) % fallbackPalettes.length];
  const dimension = dimensions[size];
  const frame = `${sizeClasses[size]} shrink-0 overflow-hidden border border-[#c6deda] bg-[#edf5f3] shadow-2xs ${className}`;

  if (!src || failed) {
    return (
      <span
        className={`${frame} inline-flex items-center justify-center font-black`}
        style={{ backgroundColor: palette[0], color: palette[1] }}
        role="img"
        aria-label={name}
      >
        {productInitials(name)}
      </span>
    );
  }

  return (
    <span className={`${frame} inline-flex items-center justify-center p-2`}>
      <img
        src={src}
        alt={name}
        width={dimension}
        height={dimension}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
};
