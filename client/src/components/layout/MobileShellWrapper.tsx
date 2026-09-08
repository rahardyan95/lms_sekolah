import React from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface MobileShellWrapperProps {
  isMobileView: boolean;
  children: React.ReactNode;
}

export const MobileShellWrapper: React.FC<MobileShellWrapperProps> = ({
  isMobileView,
  children,
}) => {
  if (!isMobileView) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center p-2 sm:p-6 bg-slate-200/60 rounded-3xl my-4">
      {/* Smartphone Device Frame Container */}
      <div className="w-full max-w-[420px] bg-white rounded-[44px] shadow-2xl border-[10px] border-slate-900 overflow-hidden relative flex flex-col min-h-[820px] ring-1 ring-slate-400">
        {/* Notch / Speaker Ear Piece */}
        <div className="w-full bg-slate-900 pt-2 pb-1 px-8 flex items-center justify-between text-[11px] text-white font-mono shrink-0">
          <span>07:45</span>
          <div className="w-24 h-4 bg-slate-950 rounded-full mx-auto flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
          </div>
          <div className="flex items-center gap-1.5">
            <Signal className="w-3 h-3 text-slate-300" />
            <Wifi className="w-3 h-3 text-slate-300" />
            <Battery className="w-3.5 h-3.5 text-slate-300" />
          </div>
        </div>

        {/* Smartphone Screen Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative">
          {children}
        </div>

        {/* Bottom Home Indicator Bar */}
        <div className="w-full bg-white py-2 flex justify-center shrink-0 border-t border-slate-100">
          <div className="w-32 h-1 bg-slate-400 rounded-full" />
        </div>
      </div>
      <p className="text-[11px] text-slate-500 font-mono mt-3">
        Simulasi Tampilan Mobile-First Smartphone (390px × 844px)
      </p>
    </div>
  );
};
