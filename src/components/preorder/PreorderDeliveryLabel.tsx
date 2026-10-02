import React from "react";
import { Plane, Ship } from "lucide-react";
import type { PreorderDelivery } from "../../../shared/types";
import { STORE_COPY } from "../../config/storeCopy";

export function PreorderDeliveryLabel({
  delivery,
}: {
  delivery: PreorderDelivery;
}) {
  const Icon = delivery === "express" ? Plane : Ship;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d9ffe0] px-2.5 py-1 text-[10px] font-black text-[#014040] sm:text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {delivery === "express"
        ? STORE_COPY.preorder.delivery.express
        : STORE_COPY.preorder.delivery.twoMonths}
    </span>
  );
}
