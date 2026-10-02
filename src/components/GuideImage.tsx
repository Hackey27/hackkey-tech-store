import React from 'react';
import type { InstallationGuideImageConfig } from '../../shared/types';
import { guideScreenshotUrl } from '../utils/guideImages';

export function GuideImage({ picture }: { picture: InstallationGuideImageConfig }) {
  return <figure className="overflow-hidden rounded-xl border border-[#d8e7e4] bg-slate-50 p-2">
    <div className="relative mx-auto w-fit max-w-full">
      <img src={guideScreenshotUrl(picture.src)} alt={picture.alt} className="block h-auto max-h-[55dvh] max-w-full object-contain" />
      {picture.markers?.map((marker, index) => <button type="button" key={`${marker.label}-${index}`} aria-label={marker.label} title={marker.label} className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus:ring-2 focus:ring-[#014040]" style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>
        <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/70 motion-reduce:animate-none" />
        <span className="relative block h-5 w-5 rounded-full border-2 border-white bg-amber-500 shadow-lg" />
        <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#3b2905] px-2 py-1 text-xs font-bold text-white shadow-lg group-hover:block group-focus:block">{marker.label}</span>
      </button>)}
    </div>
    <figcaption className="mt-2 text-center text-xs text-slate-500">{picture.alt}{picture.markers?.length ? ' · Amber markers show where to act' : ''}</figcaption>
  </figure>;
}
