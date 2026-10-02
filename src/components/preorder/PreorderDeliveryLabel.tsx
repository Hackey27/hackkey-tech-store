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
    <span className="inline-flex w-full flex-col items-center justify-center gap-1 rounded-xl bg-[#014040] px-1 py-1.5 text-[9px] font-black text-[#05ef28] sm:w-auto sm:flex-row sm:gap-1.5 sm:px-2.5 sm:text-xs">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">{delivery === "express"
        ? STORE_COPY.preorder.delivery.express
        : STORE_COPY.preorder.delivery.twoMonths}</span>
    </span>
  );
}
