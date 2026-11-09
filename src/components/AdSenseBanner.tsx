import React, { useEffect, useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';

interface AdSenseBannerProps {
  slotId?: string;
  format?: 'auto' | 'horizontal' | 'rectangle';
  className?: string;
  onOpenPublisherHub?: () => void;
}

export const AdSenseBanner: React.FC<AdSenseBannerProps> = ({
  slotId = '1234567890',
  format = 'horizontal',
  className = '',
  onOpenPublisherHub
}) => {
  const [adConfig, setAdConfig] = useState<{
    adsenseClientId: string;
    isCustom: boolean;
  }>({
    adsenseClientId: 'ca-pub-XXXXXXXXXXXXXXXX',
    isCustom: false
  });

  useEffect(() => {
    fetch('/api/publisher-config')
      .then((res) => res.json())
      .then((data) => {
        if (data?.adsenseClientId && !data.adsenseClientId.includes('XXXX')) {
          setAdConfig({
            adsenseClientId: data.adsenseClientId,
            isCustom: true
          });
          try {
            // Push adsbygoogle if script loaded
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          } catch (e) {
            // Silently handle if AdSense script is blocked or awaiting review
          }
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className={`w-full overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 transition-all hover:border-slate-400 ${className}`}>
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-2.5">
        <span className="flex items-center gap-1 uppercase tracking-wider text-[10px] text-slate-500 font-bold">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Sponsored · Google AdSense
        </span>
        {onOpenPublisherHub && (
          <button
            onClick={onOpenPublisherHub}
            className="flex items-center gap-1 text-brand-600 hover:text-brand-700 hover:underline cursor-pointer transition-colors"
          >
            <span>{adConfig.isCustom ? 'Publisher Active' : 'Configure Publisher ID'}</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {adConfig.isCustom ? (
        <div className="min-h-[90px] flex items-center justify-center">
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', minHeight: '90px' }}
            data-ad-client={adConfig.adsenseClientId}
            data-ad-slot={slotId}
            data-ad-format={format}
            data-full-width-responsive="true"
          />
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white/70 rounded-lg border border-slate-200 text-center sm:text-left">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-800">
              Google AdSense Monetization Placement
            </p>
            <p className="text-[11px] text-slate-500 max-w-xl">
              Targeted contextual ads display here once your Google AdSense account (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">ca-pub-XXXXXXXXXX</code>) is approved.
            </p>
          </div>
          {onOpenPublisherHub && (
            <button
              onClick={onOpenPublisherHub}
              className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 shrink-0 transition-colors shadow-sm cursor-pointer"
            >
              Open Publishing Hub
            </button>
          )}
        </div>
      )}
    </div>
  );
};
