import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export function GuideProgressBar({ percent, label }: { percent: number; label: string }) {
  const reduceMotion = useReducedMotion();
  return <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#d8e7e4]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}><motion.div className="hk-activation-gradient h-full rounded-full" initial={false} animate={{ width: `${percent}%` }} transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeInOut' }} /></div>;
}
