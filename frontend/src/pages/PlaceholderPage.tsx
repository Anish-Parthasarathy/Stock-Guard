import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  phase: string;
  description: string;
  endpoints: string[];
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  phase,
  description,
  endpoints,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-3xl shadow-2xs">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-mono font-medium">
          {phase}
        </span>
      </div>
      <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{description}</p>

      <div className="mt-6 pt-5 border-t border-slate-100">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Associated Backend Endpoints
        </h3>
        <div className="space-y-1.5 font-mono text-[11px]">
          {endpoints.map((ep, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded border border-slate-200/60 text-slate-700"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>{ep}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlaceholderPage;

