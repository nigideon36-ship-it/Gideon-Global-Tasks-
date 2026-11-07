import React, { useState, useRef, useEffect } from 'react';
import { useTasks } from '../context/TaskContext';
import { Download, Share2, ThumbsUp, DollarSign, Image as ImageIcon, Sparkles, Plus, Check } from 'lucide-react';

const PRESET_TEMPLATES = [
  {
    id: 'tpl-1',
    name: 'Drake Preference',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    defaultTop: 'WORKING 9-5 IN TRAFFIC',
    defaultBottom: 'COMPLETING GIDEON GLOBAL TASKS AT HOME'
  },
  {
    id: 'tpl-2',
    name: 'Curious Doge',
    url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=600&auto=format&fit=crop&q=80',
    defaultTop: 'MUCH REWARD, VERY FAST PAYOUT',
    defaultBottom: 'WOW SUCH ANNOTATION'
  },
  {
    id: 'tpl-3',
    name: 'Focus Workspace',
    url: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600&auto=format&fit=crop&q=80',
    defaultTop: 'WHEN THE SURVEY PAYS $3.50',
    defaultBottom: 'AND TAKES EXACTLY 4 MINUTES'
  },
  {
    id: 'tpl-4',
    name: 'Coding & AI',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    defaultTop: 'AI DOES NOT SLEEP',
    defaultBottom: 'NEITHER DO FREELANCERS WITH COFFEE'
  }
];

export const MemeStudioView: React.FC = () => {
  const { memes, addMeme, upvoteMeme, tipMeme, userStats, completeTask, tasks } = useTasks();

  const [selectedTemplate, setSelectedTemplate] = useState(PRESET_TEMPLATES[0]);
  const [topText, setTopText] = useState(PRESET_TEMPLATES[0].defaultTop);
  const [bottomText, setBottomText] = useState(PRESET_TEMPLATES[0].defaultBottom);
  const [fontSize, setFontSize] = useState<number>(36);
  const [isUppercase, setIsUppercase] = useState<boolean>(true);
  const [includeWatermark, setIncludeWatermark] = useState<boolean>(true);
  const [customImage, setCustomImage] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawMeme = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = customImage || selectedTemplate.url;

    img.onload = () => {
      canvas.width = 600;
      canvas.height = 600;

      // Draw background image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Dark subtle vignette gradient for text readability
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Text styling
      ctx.font = `900 ${fontSize}px 'Anton', Impact, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, fontSize / 9);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const renderText = (text: string, yPos: number, isBottom = false) => {
        const formatted = isUppercase ? text.toUpperCase() : text;
        const maxWidth = canvas.width - 40;
        const words = formatted.split(' ');
        let line = '';
        const lines: string[] = [];

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
          } else {
            line = testLine;
          }
        }
        lines.push(line);

        const lineHeight = fontSize * 1.15;
        let startY = yPos;
        if (isBottom) {
          startY = yPos - (lines.length - 1) * lineHeight;
        }

        lines.forEach((l, i) => {
          const y = startY + i * lineHeight;
          ctx.strokeText(l.trim(), canvas.width / 2, y);
          ctx.fillText(l.trim(), canvas.width / 2, y);
        });
      };

      if (topText.trim()) {
        renderText(topText, 24, false);
      }

      if (bottomText.trim()) {
        renderText(bottomText, canvas.height - 40 - fontSize, true);
      }

      // Watermark
      if (includeWatermark) {
        ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.textAlign = 'right';
        ctx.strokeText('Gideon Global Tasks', canvas.width - 16, canvas.height - 20);
        ctx.fillText('Gideon Global Tasks', canvas.width - 16, canvas.height - 20);
      }
    };
  };

  useEffect(() => {
    drawMeme();
  }, [selectedTemplate, topText, bottomText, fontSize, isUppercase, includeWatermark, customImage]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `gideon-meme-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handlePublishMeme = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const memeDataUrl = canvas.toDataURL('image/png');

    addMeme({
      title: `${topText.slice(0, 30)}...`,
      author: 'You (Creator)',
      authorCountry: 'Global',
      imageUrl: memeDataUrl,
      category: 'Community Original'
    });

    // Check if meme bounty task is active, award $3.00!
    const memeTask = tasks.find((t) => t.id === 'task-meme-401');
    if (memeTask && !userStats.completedTaskIds.includes('task-meme-401')) {
      completeTask(memeTask.id, memeTask.reward, memeTask.title);
    }
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleShareMeme = (memeId: string) => {
    setCopiedId(memeId);
    navigator.clipboard?.writeText(window.location.href);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Content Creation & Meme Studio</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Gideon Meme Studio & Viral Feed
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Design high-impact memes, complete content bounties, tip creators, and publish directly to the global earner feed.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>Active Meme Bounty: <strong>$3.00 / approved publish</strong></span>
        </div>
      </div>

      {/* Meme Studio Canvas + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Canvas preview (Left) */}
        <div className="lg:col-span-7 bg-slate-900 p-6 rounded-2xl flex flex-col items-center justify-center border border-slate-800 shadow-xl">
          <div className="relative max-w-full overflow-hidden rounded-xl border border-slate-700 shadow-2xl">
            <canvas
              ref={canvasRef}
              className="w-full max-w-[480px] h-auto aspect-square object-contain bg-slate-950"
            />
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </button>
            <button
              type="button"
              onClick={handlePublishMeme}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
              <span>Publish & Earn $3.00 Bounty</span>
            </button>
          </div>
        </div>

        {/* Controls form (Right) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Meme Customization
          </h3>

          {/* Template picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Choose Preset Template:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setCustomImage(null);
                    setSelectedTemplate(tpl);
                    setTopText(tpl.defaultTop);
                    setBottomText(tpl.defaultBottom);
                  }}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    !customImage && selectedTemplate.id === tpl.id
                      ? 'border-indigo-600 ring-2 ring-indigo-200'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img src={tpl.url} alt={tpl.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <div className="mt-2.5">
              <label className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer inline-flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Upload Custom Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Captions */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Top Caption:
              </label>
              <input
                type="text"
                value={topText}
                onChange={(e) => setTopText(e.target.value)}
                placeholder="TOP TEXT..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 outline-hidden font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bottom Caption:
              </label>
              <input
                type="text"
                value={bottomText}
                onChange={(e) => setBottomText(e.target.value)}
                placeholder="BOTTOM TEXT..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 outline-hidden font-bold"
              />
            </div>
          </div>

          {/* Typography Sliders & Toggles */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Font Size</span>
                <span className="font-mono">{fontSize}px</span>
              </div>
              <input
                type="range"
                min={22}
                max={54}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="text-xs text-slate-700 font-medium flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUppercase}
                  onChange={(e) => setIsUppercase(e.target.checked)}
                  className="rounded-xs text-indigo-600 accent-indigo-600"
                />
                <span>ALL CAPS (Classic Impact style)</span>
              </label>

              <label className="text-xs text-slate-700 font-medium flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeWatermark}
                  onChange={(e) => setIncludeWatermark(e.target.checked)}
                  className="rounded-xs text-indigo-600 accent-indigo-600"
                />
                <span>Watermark</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Community Meme Feed */}
      <div className="space-y-6 pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Community Meme & Viral Feed
            </h2>
            <p className="text-xs text-slate-500">
              Created by verified Gideon Global Task contributors worldwide. Upvote your favorites or tip 10¢!
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {memes.length} Community Posts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {memes.map((meme) => (
            <div
              key={meme.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="aspect-square bg-slate-100 overflow-hidden relative">
                  <img
                    src={meme.imageUrl}
                    alt={meme.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[10px] text-white font-medium">
                    {meme.category}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>{meme.author} · {meme.authorCountry}</span>
                    <span>{meme.createdAt}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 line-clamp-2">
                    {meme.title}
                  </h4>
                </div>
              </div>

              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                {/* Upvote button */}
                <button
                  type="button"
                  onClick={() => upvoteMeme(meme.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                    meme.userUpvoted
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                      : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span className="tabular-nums font-mono">{meme.upvotes}</span>
                </button>

                {/* Tip button */}
                <button
                  type="button"
                  onClick={() => tipMeme(meme.id, 0.10)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium"
                  title="Send $0.10 tip from your wallet"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Tip 10¢ (${meme.tipsEarned.toFixed(2)})</span>
                </button>

                {/* Share */}
                <button
                  type="button"
                  onClick={() => handleShareMeme(meme.id)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors"
                  title="Copy link"
                >
                  {copiedId === meme.id ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
