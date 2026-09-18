import React, { useEffect, useState } from 'react';

function remainingLabel(endsAt: string): string {
  const remaining = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return 'Offer ended';
  const totalMinutes = Math.floor(remaining / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return days > 0 ? `${days}d ${hours}h ${minutes}m left` : `${hours}h ${minutes}m left`;
}

export function PromotionCountdown({ endsAt, className = '' }: { endsAt?: string; className?: string }) {
  const [label, setLabel] = useState(() => endsAt ? remainingLabel(endsAt) : 'Limited time');
  useEffect(() => {
    if (!endsAt) return;
    const update = () => setLabel(remainingLabel(endsAt));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  return <span className={className} aria-label={endsAt ? `Promotion ${label}` : 'Limited-time promotion'}>{label}</span>;
}
