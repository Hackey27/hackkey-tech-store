import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Announcement } from '../types';
import { STORE_COPY } from '../config/storeCopy';

interface AnnouncementModalProps {
  announcement: Announcement;
  preview?: boolean;
  onClose: () => void;
}

export function announcementStorageKey(announcementId: string): string {
  return `hackkey-announcement-seen:${announcementId}`;
}

export function shouldShowAnnouncement(announcement: Announcement): boolean {
  if (!announcement.showOnce) return true;
  try {
    return localStorage.getItem(announcementStorageKey(announcement.announcementId)) !== '1';
  } catch {
    return true;
  }
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ announcement, preview = false, onClose }) => {
  const dismiss = () => {
    if (!preview && announcement.showOnce) {
      try {
        localStorage.setItem(announcementStorageKey(announcement.announcementId), '1');
      } catch {
        // Storage may be blocked; closing the current modal should still work.
      }
    }
    onClose();
  };

  useEffect(() => {
    if (!preview && announcement.showOnce) {
      try {
        localStorage.setItem(announcementStorageKey(announcement.announcementId), '1');
      } catch {
        // Storage may be unavailable; the current modal remains usable.
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [announcement.announcementId, announcement.showOnce, preview]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#002b2b]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
      <button className="absolute inset-0 cursor-default" aria-label={STORE_COPY.announcement.dismiss} onClick={dismiss} />
      <section className="hk-modal-enter relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
        <div className="h-2 bg-[#05ef28]" />
        <div className="p-6 sm:p-8">
          <button onClick={dismiss} className="absolute right-4 top-5 rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label={STORE_COPY.announcement.close}>
            <X className="h-5 w-5" />
          </button>
          <h2 id="announcement-title" className="pr-10 text-2xl font-black text-[#014040]">{announcement.title}</h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{announcement.message}</p>
          {announcement.buttonText && announcement.buttonUrl && (
            <a href={announcement.buttonUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-xl bg-[#014040] px-5 py-3 text-sm font-black text-white hover:bg-[#025656]">
              {announcement.buttonText}
            </a>
          )}
        </div>
      </section>
    </div>
  );
};
