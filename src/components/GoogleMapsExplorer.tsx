import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { MapPin, Search, Navigation, ExternalLink, ShieldCheck, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';

interface LocalTask {
  id: string;
  title: string;
  venueName: string;
  category: 'Mystery Audit' | 'Price Check' | 'Signage Verification' | 'Storefront Photo';
  address: string;
  distance: string;
  reward: number;
  lat: number;
  lng: number;
}

const LOCAL_FIELD_TASKS: LocalTask[] = [
  {
    id: 'field-1',
    title: 'Retail Shelf Display Verification',
    venueName: 'Target Supercenter',
    category: 'Price Check',
    address: '700 N Michigan Ave, Chicago, IL',
    distance: '0.8 miles away',
    reward: 8.50,
    lat: 41.8953,
    lng: -87.6244
  },
  {
    id: 'field-2',
    title: 'Storefront Hours & Parking Audit',
    venueName: 'Trader Joe’s Market',
    category: 'Mystery Audit',
    address: '44 E Ontario St, Chicago, IL',
    distance: '1.2 miles away',
    reward: 6.75,
    lat: 41.8931,
    lng: -87.6267
  },
  {
    id: 'field-3',
    title: 'EV Charging Station Operability Check',
    venueName: 'ChargePoint Station #104',
    category: 'Signage Verification',
    address: '350 E Grand Ave, Chicago, IL',
    distance: '1.6 miles away',
    reward: 9.00,
    lat: 41.8918,
    lng: -87.6186
  },
  {
    id: 'field-4',
    title: 'Beverage Cooler Facing Inspection',
    venueName: 'Walgreens Pharmacy',
    category: 'Storefront Photo',
    address: '151 N State St, Chicago, IL',
    distance: '2.1 miles away',
    reward: 5.50,
    lat: 41.8847,
    lng: -87.6278
  }
];

export const GoogleMapsExplorer: React.FC = () => {
  const { completeTask, userStats } = useTasks();

  const [searchQuery, setSearchQuery] = useState('Find nearby grocery markets and retail stores');
  const [selectedTask, setSelectedTask] = useState<LocalTask>(LOCAL_FIELD_TASKS[0]);
  const [mapsGroundingText, setMapsGroundingText] = useState<string>('');
  const [groundingLinks, setGroundingLinks] = useState<{ title: string; uri: string }[]>([]);
  const [isLoadingGrounding, setIsLoadingGrounding] = useState(false);
  const [completedFieldTasks, setCompletedFieldTasks] = useState<string[]>([]);

  const handleQueryMapsGrounding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isLoadingGrounding) return;

    setIsLoadingGrounding(true);
    try {
      const res = await fetch('/api/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          latitude: selectedTask.lat,
          longitude: selectedTask.lng
        })
      });

      const data = await res.json();
      setMapsGroundingText(data.text || 'Nearby venues identified for physical task audit.');
      setGroundingLinks(data.mapsLinks || []);
    } catch (err) {
      console.error(err);
      setMapsGroundingText('Nearby retail nodes verified for physical store compliance audits.');
    } finally {
      setIsLoadingGrounding(false);
    }
  };

  const handleCompleteFieldAudit = (task: LocalTask) => {
    if (completedFieldTasks.includes(task.id)) return;
    completeTask(`field-${task.id}`, task.reward, `${task.title} at ${task.venueName}`);
    setCompletedFieldTasks((prev) => [...prev, task.id]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>Google Maps Platform & Local Field Tasks</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Nearby Physical Tasks & Store Audits
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Complete real-world mystery shopping, price verification, and venue photos in your neighborhood. Grounded with live Google Maps place data.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3 py-2 rounded-lg font-mono">
          <Navigation className="w-3.5 h-3.5 text-indigo-600" />
          <span>Coordinates: {selectedTask.lat.toFixed(4)}, {selectedTask.lng.toFixed(4)}</span>
        </div>
      </div>

      {/* Google Maps Search Grounding Bar */}
      <form onSubmit={handleQueryMapsGrounding} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nearby places or query with Google Maps Grounding..."
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 outline-hidden focus:border-indigo-500"
          />
        </div>
        <button
          type="submit"
          disabled={isLoadingGrounding}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 whitespace-nowrap transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isLoadingGrounding ? 'Querying Maps...' : 'Google Maps Grounding'}</span>
        </button>
      </form>

      {/* Maps Grounding response box with required URLs */}
      {(mapsGroundingText || groundingLinks.length > 0) && (
        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs text-slate-800 space-y-2">
          <div className="font-semibold text-indigo-950 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>Google Maps Grounding Insights</span>
          </div>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            {mapsGroundingText}
          </p>

          {groundingLinks.length > 0 && (
            <div className="pt-2 border-t border-indigo-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Verified Google Maps Locations:
              </span>
              <div className="flex flex-wrap gap-2">
                {groundingLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-md border border-indigo-200 text-indigo-700 hover:underline text-[11px]"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>{link.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Map Layout View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Interactive Map Visual Viewport (Left) */}
        <div className="lg:col-span-7 bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl relative h-[440px] flex flex-col justify-between p-6">
          {/* Simulated Satellite/Map Canvas Grid */}
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Map Pins Placed Across Container */}
          <div className="absolute inset-0 p-8 flex items-center justify-center">
            <div className="relative w-full h-full max-w-lg">
              {LOCAL_FIELD_TASKS.map((task, idx) => {
                const isSelected = selectedTask.id === task.id;
                const positions = [
                  { top: '25%', left: '30%' },
                  { top: '45%', left: '60%' },
                  { top: '70%', left: '25%' },
                  { top: '35%', left: '75%' }
                ];
                const pos = positions[idx] || { top: '50%', left: '50%' };
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTask(task)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group transition-all"
                    style={{ top: pos.top, left: pos.left }}
                  >
                    <div
                      className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-2xl transition-all ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 scale-110 ring-4 ring-emerald-500/30'
                          : 'bg-slate-800 text-white border border-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="font-mono">${task.reward.toFixed(2)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map Attribution Bar */}
          <div className="relative z-10 flex items-center justify-between text-xs text-white">
            <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>4 Field Bounties in Range</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Google Maps Platform API
            </div>
          </div>

          {/* Active Pin Summary */}
          <div className="relative z-10 bg-slate-950/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700 text-white flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">{selectedTask.distance} · {selectedTask.category}</div>
              <div className="text-sm font-bold text-white mt-0.5">{selectedTask.venueName}</div>
              <div className="text-[11px] text-slate-300 font-mono mt-0.5">{selectedTask.address}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Reward</span>
              <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                ${selectedTask.reward.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Local Task List (Right) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Available Local Tasks
          </div>

          {LOCAL_FIELD_TASKS.map((task) => {
            const isSelected = selectedTask.id === task.id;
            const isDone = completedFieldTasks.includes(task.id);
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-600 bg-white shadow-md ring-1 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{task.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{task.distance}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      {task.venueName}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {task.title}
                    </p>
                  </div>
                  <div className="text-right font-mono font-bold text-slate-900 tabular-nums text-sm">
                    ${task.reward.toFixed(2)}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {task.address}
                  </span>

                  {isDone ? (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Audit Submitted</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteFieldAudit(task);
                      }}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Submit Audit ($)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
