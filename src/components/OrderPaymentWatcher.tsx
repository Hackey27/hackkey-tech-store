import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Order } from '../types';

export function OrderPaymentWatcher({ orderId, onResolved }: { orderId?: string; onResolved: (order: Order) => void }) {
  const [checking, setChecking] = useState(false);
  const resolved = useRef(false);
  const onResolvedRef = useRef(onResolved);
  useEffect(() => { onResolvedRef.current = onResolved; }, [onResolved]);

  useEffect(() => {
    if (!orderId) return;
    resolved.current = false;
    let stopped = false;
    const check = async () => {
      if (stopped || resolved.current) return;
      setChecking(true);
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
        const data = await response.json();
        const order = data.order as Order | undefined;
        if (response.ok && order && (order.paymentStatus === 'paid' || order.paymentArrangement === 'pay-later')) {
          resolved.current = true;
          onResolvedRef.current(order);
        }
      } catch { /* the next poll retries without interrupting checkout */ }
      finally { if (!stopped) setChecking(false); }
    };
    void check();
    const timer = window.setInterval(() => void check(), 5_000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [orderId]);

  return <p className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500" aria-live="polite"><RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />This page checks automatically for payment updates.</p>;
}
