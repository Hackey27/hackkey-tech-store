import React, { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Plus, Trash2 } from 'lucide-react';
import type { InstallationGuideImageConfig } from '../../shared/types';
import { adminRequest } from './api';
import { resizeProductImage } from './imageUpload';
import { guideMarkerPosition, guideScreenshotUrl } from '../utils/guideImages';
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#014040] focus:ring-2 focus:ring-[#014040]/10';
const labelClass = 'space-y-1 text-xs font-bold text-slate-700';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#014040] hover:bg-slate-50 disabled:opacity-50';
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Could not upload the image.';

function GuideScreenshotMarkerEditor({ image, onChange, onRemove }: { image: InstallationGuideImageConfig; onChange: (image: InstallationGuideImageConfig) => void; onRemove: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const markers = image.markers || [];
  const position = (clientX: number, clientY: number) => {
    const bounds = imageRef.current?.getBoundingClientRect();
    return bounds ? guideMarkerPosition(clientX, clientY, bounds) : null;
  };
  const updateMarker = (index: number, patch: Partial<(typeof markers)[number]>) => onChange({
    ...image,
    markers: markers.map((marker, markerIndex) => markerIndex === index ? { ...marker, ...patch } : marker)
  });
  return <div className="space-y-3 rounded-xl border border-[#cbdcd9] bg-[#f8fbfa] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-xs text-[#014040]">Step screenshot</b><button type="button" className={secondaryButton} onClick={onRemove}><Trash2 className="h-3.5 w-3.5" />Remove screenshot</button></div>
    <label className={labelClass}>Image description for accessibility<input className={inputClass} maxLength={200} value={image.alt} onChange={(event) => onChange({ ...image, alt: event.target.value })} /></label>
    <p className="text-xs text-slate-600">Tap or click the screenshot to place an amber marker. Drag a marker to move it, or focus it and use the arrow keys for precise placement.</p>
    <button type="button" className={secondaryButton} disabled={markers.length >= 20} onClick={() => onChange({ ...image, markers: [...markers, { x: 50, y: 50, label: 'Click here' }] })}><Plus className="h-3.5 w-3.5" />Add amber marker at centre</button>
    <div className="relative mx-auto w-fit max-w-full touch-none cursor-crosshair select-none" aria-label="Click the screenshot to add an amber marker">
      <img ref={imageRef} src={guideScreenshotUrl(image.src)} alt={image.alt} draggable={false} className="block h-auto max-h-80 max-w-full rounded-lg border object-contain" onPointerDown={(event) => {
        const point = position(event.clientX, event.clientY);
        if (point && markers.length < 20) onChange({ ...image, markers: [...markers, { ...point, label: 'Click here' }] });
      }} />
      {markers.map((marker, index) => <button key={index} type="button" aria-label={`Move amber marker ${index + 1}: ${marker.label}`} title={marker.label} className="absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[10px] font-black text-[#3b2905] shadow-lg focus:outline-none focus:ring-2 focus:ring-[#014040]" style={{ left: `${marker.x}%`, top: `${marker.y}%` }} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const point = position(event.clientX, event.clientY); if (point) updateMarker(index, point); }} onKeyDown={(event) => { const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key] as [number, number] | undefined; if (!direction) return; event.preventDefault(); const delta = event.shiftKey ? 5 : 1; updateMarker(index, { x: Math.max(0, Math.min(100, marker.x + direction[0] * delta)), y: Math.max(0, Math.min(100, marker.y + direction[1] * delta)) }); }}>{index + 1}</button>)}
    </div>
    {markers.length > 0 && <div className="space-y-2">{markers.map((marker, index) => <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2"><span className="min-w-7 text-center text-xs font-black text-amber-800">{index + 1}</span><input className={`${inputClass} min-w-40 flex-1`} aria-label={`Amber marker ${index + 1} label`} maxLength={80} value={marker.label} onChange={(event) => updateMarker(index, { label: event.target.value })} /><span className="text-[11px] text-slate-500">{marker.x}%, {marker.y}%</span><button type="button" className={secondaryButton} onClick={() => onChange({ ...image, markers: markers.filter((_, markerIndex) => markerIndex !== index) })}><Trash2 className="h-3.5 w-3.5" />Remove</button></div>)}</div>}
  </div>;
}

export function GuideStepScreenshotsEditor({ productId, user, images, onChange, uploadsEnabled = true, uploadPath }: { uploadPath?: string; productId: string; user: User; images: InstallationGuideImageConfig[]; onChange: (images: InstallationGuideImageConfig[]) => void; uploadsEnabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setMessage('');
    try {
      const blob = await resizeProductImage(file, 'gallery');
      const result = await adminRequest<{ objectPath: string }>(user, uploadPath || `/products/${encodeURIComponent(productId)}/guide-images`, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
      onChange([...images, { src: result.objectPath, alt: file.name.slice(0, 200) || 'Installation screenshot' }]);
      setMessage('Screenshot uploaded. Place any amber markers, then save your changes to publish it.');
    } catch (error) { setMessage(messageOf(error)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 rounded-xl border border-dashed border-[#bdd1cc] p-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><b className="text-xs text-[#014040]">Screenshots and amber markers</b><p className="text-[11px] text-slate-500">Up to 6 per step. A clear 1400 × 1050 px screenshot works well; its proportions are preserved.</p><p className="text-[11px] text-amber-800">Customers can see these images. Remove personal details and licence keys before uploading.</p></div><label className={secondaryButton}>{busy ? 'Uploading…' : 'Add screenshot'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy || !uploadsEnabled || images.length >= 6} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></div>
    <div className={busy ? 'space-y-3 pointer-events-none opacity-60' : 'space-y-3'}>{images.map((image, index) => <GuideScreenshotMarkerEditor key={`${image.src}-${index}`} image={image} onChange={(updated) => onChange(images.map((entry, entryIndex) => entryIndex === index ? updated : entry))} onRemove={() => onChange(images.filter((_, entryIndex) => entryIndex !== index))} />)}</div>
    {images.length === 0 && <p className="text-xs text-slate-500">No screenshot for this step yet.</p>}
    {message && <p role="status" className="rounded-lg bg-slate-100 p-2 text-xs font-bold text-[#014040]">{message}</p>}
  </div>;
}
