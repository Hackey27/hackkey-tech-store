import React from 'react';
import { MachineCodeType } from '../types';
import { Check } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';

interface OrderProgressBarProps {
  machineCodeType?: MachineCodeType;
  currentStep?: number; // 1-indexed
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export interface StepDefinition {
  id: string;
  label: string;
}

export function getStepsForMachineCodeType(type?: MachineCodeType): StepDefinition[] {
  let labels: readonly string[];

  switch (type) {
    case 'lock-code':
      labels = STORE_COPY.orderProgress.amosSpss;
      break;
    case 'hardware-id':
      labels = STORE_COPY.orderProgress.maxqdaMplusEviews;
      break;
    case 'service':
      labels = STORE_COPY.orderProgress.nonLicence;
      break;
    case 'none':
    default:
      labels = STORE_COPY.orderProgress.standardSoftware;
      break;
  }

  return labels.map((label, idx) => ({ id: `step-${idx}`, label }));
}

export const OrderProgressBar: React.FC<OrderProgressBarProps> = ({
  machineCodeType = 'none',
  currentStep = 1,
  onStepClick,
  className = ''
}) => {
  const steps = getStepsForMachineCodeType(machineCodeType);
  const totalSteps = steps.length;
  // Calculate percentage along the persistent progress line
  const progressPercent = totalSteps > 1
    ? Math.min(100, Math.max(0, ((currentStep - 1) / (totalSteps - 1)) * 100))
    : 100;

  return (
    <div className={`w-full py-4 px-2 sm:px-4 ${className}`}>
      {/* Container with persistent progress line */}
      <div className="relative">
        {/* Background persistent line */}
        <div className="absolute top-4 left-4 right-4 h-1 bg-slate-200 -translate-y-1/2 rounded-full" />

        {/* Active filled line (Bright Green #05ef28) */}
        <div
          className="absolute top-4 left-4 h-1 bg-[#05ef28] -translate-y-1/2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `calc(${progressPercent}% * (1 - 32px / 100%))` }}
        />

        {/* Steps Nodes */}
        <div className="relative flex justify-between items-start">
          {steps.map((step, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <div
                key={step.id}
                onClick={() => onStepClick && onStepClick(stepNum)}
                className={`flex flex-col items-center cursor-pointer group select-none transition-transform ${
                  isCurrent ? 'scale-105' : ''
                }`}
                style={{ width: `${100 / totalSteps}%` }}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Step Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 border-2 ${
                    isCompleted
                      ? 'bg-[#014040] border-[#014040] text-[#05ef28] shadow-xs'
                      : isCurrent
                      ? 'bg-[#05ef28] border-[#014040] text-[#014040] shadow-md ring-4 ring-[#05ef28]/30 font-black'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <span>{stepNum}</span>
                  )}
                </div>

                {/* Step Label */}
                <div className="mt-2 hidden text-center px-1 sm:block">
                  <span
                    className={`block text-[11px] sm:text-xs font-semibold leading-tight transition-colors ${
                      isCurrent
                        ? 'text-[#014040] font-bold'
                        : isCompleted
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs font-bold text-[#014040] sm:hidden" aria-live="polite">
          {STORE_COPY.orderProgress.mobileSummary(
            Math.min(Math.max(currentStep, 1), totalSteps),
            totalSteps,
            steps[Math.min(Math.max(currentStep, 1), totalSteps) - 1]!.label,
          )}
        </p>
      </div>
    </div>
  );
};
