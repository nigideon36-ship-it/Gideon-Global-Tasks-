import React, { useState, useRef, useEffect } from 'react';
import { Task, BoundingBox } from '../types/tasks';
import { useTasks } from '../context/TaskContext';
import { X, Trash2, Crosshair, CheckCircle2, AlertCircle, Info, Sparkles } from 'lucide-react';

interface Props {
  task: Task;
  onClose: () => void;
}

const CLASS_COLORS: Record<string, { stroke: string; bg: string }> = {
  Vehicle: { stroke: '#3b82f6', bg: 'rgba(59, 130, 246, 0.18)' },
  Pedestrian: { stroke: '#10b981', bg: 'rgba(16, 185, 129, 0.18)' },
  Bicycle: { stroke: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)' },
  'Traffic Sign': { stroke: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.18)' }
};

export const AnnotationWorkspaceModal: React.FC<Props> = ({ task, onClose }) => {
  const { completeTask } = useTasks();
  const annoConfig = task.annotationConfig?.[0];

  const isSentimentTask = annoConfig?.type === 'sentiment';
  const targetLabels = annoConfig?.targetLabels || ['Vehicle', 'Pedestrian', 'Bicycle', 'Traffic Sign'];

  // Bounding box tool state
  const [activeLabel, setActiveLabel] = useState<string>(targetLabels[0]);
  const [boxes, setBoxes] = useState<BoundingBox[]>([
    {
      id: 'box-init-1',
      x: 18,
      y: 48,
      width: 24,
      height: 18,
      label: 'Vehicle',
      color: '#3b82f6'
    },
    {
      id: 'box-init-2',
      x: 35,
      y: 57,
      width: 14,
      height: 19,
      label: 'Bicycle',
      color: '#f59e0b'
    }
  ]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Sentiment task state
  const [selectedSentiment, setSelectedSentiment] = useState<string>('');
  const [selectedIntent, setSelectedIntent] = useState<string>('');
  const [annotatorNotes, setAnnotatorNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = Math.max(rect.left, Math.min(e.clientX, rect.right));
    const clientY = Math.max(rect.top, Math.min(e.clientY, rect.bottom));
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSentimentTask) return;
    const { x, y } = getRelativeCoords(e);
    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentBox({ x, y, width: 0, height: 0 });
    setErrorMsg(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPos) return;
    const { x, y } = getRelativeCoords(e);
    const boxX = Math.min(x, startPos.x);
    const boxY = Math.min(y, startPos.y);
    const width = Math.abs(x - startPos.x);
    const height = Math.abs(y - startPos.y);
    setCurrentBox({ x: boxX, y: boxY, width, height });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;
    setIsDrawing(false);

    // Only add if box is reasonable size (at least 2% width and height)
    if (currentBox.width > 2 && currentBox.height > 2) {
      const newBox: BoundingBox = {
        id: `box-${Date.now()}`,
        x: currentBox.x,
        y: currentBox.y,
        width: currentBox.width,
        height: currentBox.height,
        label: activeLabel,
        color: CLASS_COLORS[activeLabel]?.stroke || '#3b82f6'
      };
      setBoxes((prev) => [...prev, newBox]);
    }
    setStartPos(null);
    setCurrentBox(null);
  };

  const handleDeleteBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBoxes((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSubmit = () => {
    if (isSentimentTask) {
      if (!selectedSentiment) {
        setErrorMsg('Please select a dominant sentiment label.');
        return;
      }
    } else {
      if (boxes.length < 3) {
        setErrorMsg('Please annotate at least 3 distinct objects (e.g. crosswalk pedestrians or oncoming vehicles) to meet AI quality benchmark.');
        return;
      }
    }

    setIsSubmitting(true);
    setTimeout(() => {
      completeTask(task.id, task.reward, task.title);
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>AI Data Annotation</span>
                <span aria-hidden="true">·</span>
                <span>{task.requesterName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-emerald-600 font-semibold">${task.reward.toFixed(2)} Bounty</span>
              </div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">
                {task.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workstation body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Main Visual / Text Area */}
          <div className="flex-1 bg-slate-900 p-4 flex flex-col items-center justify-center relative select-none overflow-hidden">
            {isSentimentTask ? (
              /* Sentiment / NLP classification view */
              <div className="max-w-xl w-full bg-white rounded-xl p-6 shadow-lg">
                <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
                  Customer Message Transcript
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm leading-relaxed mb-6 font-mono">
                  "{annoConfig?.sentimentText}"
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Dominant Sentiment Classification:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {targetLabels.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setSelectedSentiment(label)}
                          className={`p-3 text-xs font-medium rounded-lg border text-center transition-all ${
                            selectedSentiment === label
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Primary Customer Intent:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Refund Escalation', 'Delivery Delay Status', 'Product Exchange', 'Technical Incompatibility'].map((intent) => (
                        <button
                          key={intent}
                          type="button"
                          onClick={() => setSelectedIntent(intent)}
                          className={`p-2.5 text-xs rounded-lg border text-left transition-all ${
                            selectedIntent === intent
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {intent}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Annotator Verification Rationale (Optional):
                    </label>
                    <input
                      type="text"
                      value={annotatorNotes}
                      onChange={(e) => setAnnotatorNotes(e.target.value)}
                      placeholder="e.g., Customer explicitly stated 'need a full immediate refund' with high urgency."
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Interactive Computer Vision Bounding Box Canvas */
              <div className="relative max-w-3xl w-full flex flex-col items-center">
                <div
                  ref={containerRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="relative rounded-lg overflow-hidden border border-slate-700 cursor-crosshair shadow-2xl max-h-[60vh] w-full flex items-center justify-center bg-black"
                >
                  <img
                    src={annoConfig?.imageUrl || '/src/assets/images/annotation_sample_street_1794041822257.jpg'}
                    alt="Street Camera Capture for AI Annotation"
                    className="w-full h-auto object-contain pointer-events-none select-none max-h-[60vh]"
                    draggable={false}
                  />

                  {/* Render Existing Bounding Boxes */}
                  {boxes.map((box) => {
                    const colors = CLASS_COLORS[box.label] || { stroke: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' };
                    return (
                      <div
                        key={box.id}
                        className="absolute group transition-shadow"
                        style={{
                          left: `${box.x}%`,
                          top: `${box.y}%`,
                          width: `${box.width}%`,
                          height: `${box.height}%`,
                          border: `2px solid ${colors.stroke}`,
                          backgroundColor: colors.bg
                        }}
                      >
                        <div
                          className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase rounded-xs whitespace-nowrap flex items-center gap-1 shadow-sm"
                          style={{ backgroundColor: colors.stroke }}
                        >
                          <span>{box.label}</span>
                          <button
                            onClick={(e) => handleDeleteBox(box.id, e)}
                            className="hover:text-red-200 ml-1"
                            title="Delete Box"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Render Current Drag Box */}
                  {isDrawing && currentBox && (
                    <div
                      className="absolute border-2 border-dashed pointer-events-none"
                      style={{
                        left: `${currentBox.x}%`,
                        top: `${currentBox.y}%`,
                        width: `${currentBox.width}%`,
                        height: `${currentBox.height}%`,
                        borderColor: CLASS_COLORS[activeLabel]?.stroke || '#ffffff',
                        backgroundColor: CLASS_COLORS[activeLabel]?.bg || 'rgba(255,255,255,0.2)'
                      }}
                    >
                      <span className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-bold text-white bg-slate-900 rounded-xs">
                        {activeLabel}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" />
                  <span>Click and drag on the street view image to draw bounding boxes.</span>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Controls & Inspection */}
          <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
            <div>
              {!isSentimentTask && (
                <>
                  <div className="mb-5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Active Label Class
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {targetLabels.map((label) => {
                        const isSelected = activeLabel === label;
                        const colorInfo = CLASS_COLORS[label] || { stroke: '#3b82f6' };
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setActiveLabel(label)}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                              isSelected
                                ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: colorInfo.stroke }}
                            />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      <span>Annotated Objects</span>
                      <span className="font-mono text-slate-600">{boxes.length} / 3 min</span>
                    </div>

                    {boxes.length === 0 ? (
                      <div className="p-4 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400">
                        No bounding boxes drawn yet. Click and drag on the camera feed.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {boxes.map((b, idx) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: CLASS_COLORS[b.label]?.stroke || '#3b82f6' }}
                              />
                              <span className="font-semibold text-slate-800">{b.label} #{idx + 1}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({Math.round(b.x)}%, {Math.round(b.y)}%)
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteBox(b.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Quality Standards Card */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 mb-4">
                <div className="font-semibold mb-1 flex items-center gap-1.5 text-indigo-950">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Quality Benchmark</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Tightly enclose visible targets. Accuracy score directly boosts your Gideon Global Quality Tier.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium mb-4 flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Validating Labelling...' : `Submit Annotation ($${task.reward.toFixed(2)})`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
