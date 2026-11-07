import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { Image as ImageIcon, Video, Music, Sparkles, Download, Play, Pause, RefreshCw, Upload, AlertCircle } from 'lucide-react';

export const AIMediaStudio: React.FC = () => {
  const { setActiveTab } = useTasks();

  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'video' | 'music'>('image');

  // Image Generation State
  const [imagePrompt, setImagePrompt] = useState('Minimalist 3D isometric badge for a global AI data annotator');
  const [imageAspectRatio, setImageAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Video Generation State
  const [videoPrompt, setVideoPrompt] = useState('Smooth aerial camera push into a futuristic digital co-working greenhouse, sunset lighting');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoSourceImage, setVideoSourceImage] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Music Generation State
  const [musicPrompt, setMusicPrompt] = useState('30-second energetic tropical house beat for mobile app celebration');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedLyrics, setGeneratedLyrics] = useState<string | null>(null);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);

  // Handlers
  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    setImageError(null);

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: imageAspectRatio,
          imageBase64: sourceImage ? sourceImage.split(',')[1] : undefined
        })
      });

      const data = await res.json();
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
      } else {
        setImageError(data.error || 'Failed to generate image.');
      }
    } catch (err: any) {
      console.error(err);
      setImageError('Network request failed.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateVideo = async () => {
    setIsGeneratingVideo(true);
    setVideoError(null);

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoAspectRatio,
          imageBase64: videoSourceImage ? videoSourceImage.split(',')[1] : undefined
        })
      });

      const data = await res.json();
      if (data.videoUrl) {
        setGeneratedVideoUrl(data.videoUrl);
      } else {
        setGeneratedVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
      }
    } catch (err: any) {
      console.error(err);
      setVideoError('Video generation request failed.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleGenerateMusic = async () => {
    setIsGeneratingMusic(true);
    setMusicError(null);

    try {
      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: musicPrompt })
      });

      const data = await res.json();
      if (data.audioDataUrl) {
        setGeneratedAudioUrl(data.audioDataUrl);
        setGeneratedLyrics(data.lyrics || '');
      } else {
        setMusicError(data.error || 'Music generation failed.');
      }
    } catch (err: any) {
      console.error(err);
      setMusicError('Music request failed.');
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          if (target === 'image') setSourceImage(event.target.result as string);
          if (target === 'video') setVideoSourceImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multimodal Creator Suite</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            AI Content & Generative Media Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Create and edit visual assets, render AI video clips with <strong className="text-indigo-600 font-mono">gemini-omni-1.2-flash</strong>, generate 1K–4K images via <strong className="text-indigo-600 font-mono">gemini-nano-banana-2.1</strong>, and compose 30s audio tracks with <strong className="text-indigo-600 font-mono">lyria-3-clip-preview</strong>.
          </p>
        </div>

        {/* Media Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveMediaTab('image')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeMediaTab === 'image'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Image Studio (Nano Banana)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMediaTab('video')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeMediaTab === 'video'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video & Animation (Omni Flash)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMediaTab('music')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeMediaTab === 'music'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Music (Lyria Clip)</span>
          </button>
        </div>
      </div>

      {/* 1. IMAGE STUDIO */}
      {activeMediaTab === 'image' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Create & Edit Images (gemini-nano-banana-2.1)
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prompt Description:
              </label>
              <textarea
                rows={3}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe what you want to create or edit..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-hidden font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Aspect Ratio:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['1:1', '16:9', '9:16'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setImageAspectRatio(ratio)}
                      className={`p-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                        imageAspectRatio === ratio
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Photo to Edit (Optional):
                </label>
                <label className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-slate-300 hover:border-indigo-400 text-xs text-slate-600 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{sourceImage ? 'Replace Image' : 'Choose File'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'image')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {sourceImage && (
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <img src={sourceImage} alt="Source" className="w-12 h-12 rounded object-cover" />
                <div className="text-xs text-slate-600">
                  <span className="font-semibold block">Source photo attached</span>
                  <button
                    onClick={() => setSourceImage(null)}
                    className="text-rose-600 hover:underline text-[11px]"
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            )}

            {imageError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{imageError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateImage}
              disabled={isGeneratingImage || !imagePrompt.trim()}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGeneratingImage ? 'Rendering with Nano Banana 2.1...' : 'Generate Image'}</span>
            </button>
          </div>

          {/* Image Display */}
          <div className="lg:col-span-6 bg-slate-900 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[360px] border border-slate-800 shadow-xl">
            {generatedImageUrl ? (
              <div className="space-y-4 max-w-md w-full">
                <img
                  src={generatedImageUrl}
                  alt="Generated asset"
                  className="rounded-xl max-h-[320px] w-full object-contain mx-auto shadow-2xl"
                />
                <div className="flex items-center justify-center gap-3">
                  <a
                    href={generatedImageUrl}
                    download="gideon-ai-image.png"
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setActiveTab('meme-studio')}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-semibold"
                  >
                    <span>Use in Meme Studio →</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 space-y-2">
                <ImageIcon className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs">Your generated image will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. VIDEO STUDIO */}
      {activeMediaTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Generate Video from Text or Animate Images (gemini-omni-1.2-flash)
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prompt or Motion Directive:
              </label>
              <textarea
                rows={3}
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder="Describe scene motion, camera movement, or animate photo..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-hidden font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Aspect Ratio:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['16:9', '9:16'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setVideoAspectRatio(ratio)}
                      className={`p-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                        videoAspectRatio === ratio
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {ratio === '16:9' ? '16:9 Landscape' : '9:16 Portrait'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Photo to Animate:
                </label>
                <label className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-slate-300 hover:border-indigo-400 text-xs text-slate-600 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{videoSourceImage ? 'Change Image' : 'Select Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'video')}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {videoSourceImage && (
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <img src={videoSourceImage} alt="Source" className="w-12 h-12 rounded object-cover" />
                <div className="text-xs text-slate-600">
                  <span className="font-semibold block">Source photo will animate</span>
                  <button
                    onClick={() => setVideoSourceImage(null)}
                    className="text-rose-600 hover:underline text-[11px]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {videoError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{videoError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateVideo}
              disabled={isGeneratingVideo || !videoPrompt.trim()}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGeneratingVideo ? 'Processing via Interactions API...' : 'Generate Video (Omni Flash)'}</span>
            </button>
          </div>

          {/* Video Player */}
          <div className="lg:col-span-6 bg-slate-900 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[360px] border border-slate-800 shadow-xl">
            {generatedVideoUrl ? (
              <div className="space-y-4 max-w-md w-full">
                <video
                  src={generatedVideoUrl}
                  controls
                  autoPlay
                  loop
                  className="rounded-xl w-full max-h-[300px] object-contain shadow-2xl bg-black"
                />
                <div className="text-center text-xs text-slate-400">
                  Video rendered via Gemini Omni Flash 1.2
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-400 space-y-2">
                <Video className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs">Your generated video will stream here.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MUSIC STUDIO */}
      {activeMediaTab === 'music' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Generate Music & Audio Tracks (lyria-3-clip-preview)
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Musical Style & Mood Prompt:
              </label>
              <textarea
                rows={3}
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                placeholder="e.g. 30-second chill lofi hip hop with acoustic piano and vinyl rain..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-hidden font-medium"
              />
            </div>

            {musicError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{musicError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateMusic}
              disabled={isGeneratingMusic || !musicPrompt.trim()}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGeneratingMusic ? 'Synthesizing with Lyria Clip...' : 'Generate 30s Music Track'}</span>
            </button>
          </div>

          {/* Music Player */}
          <div className="lg:col-span-6 bg-slate-900 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[260px] border border-slate-800 shadow-xl">
            {generatedAudioUrl ? (
              <div className="space-y-4 max-w-md w-full">
                <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                      <Music className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Generated Lyria Track</div>
                      <div className="text-[11px] text-slate-400">30-second audio track</div>
                    </div>
                  </div>
                  <audio src={generatedAudioUrl} controls className="w-full" />
                </div>
                {generatedLyrics && (
                  <div className="text-xs text-slate-300 bg-slate-800/60 p-3 rounded-lg border border-slate-700 italic">
                    "{generatedLyrics}"
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-400 space-y-2">
                <Music className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs">Your generated track will be ready to listen here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
