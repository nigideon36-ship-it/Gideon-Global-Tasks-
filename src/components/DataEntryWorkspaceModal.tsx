import React, { useState } from 'react';
import { Task } from '../types/tasks';
import { useTasks } from '../context/TaskContext';
import { X, ZoomIn, ZoomOut, Check, FileText, Sparkles, CheckCircle2 } from 'lucide-react';
import receiptSampleScan from '../assets/images/receipt_sample_scan_1794041823242.jpg';

interface Props {
  task: Task;
  onClose: () => void;
}

export const DataEntryWorkspaceModal: React.FC<Props> = ({ task, onClose }) => {
  const { completeTask } = useTasks();
  const config = task.dataEntryConfig;
  const fields = config?.fields || [];

  const [formData, setFormData] = useState<Record<string, string>>({
    storeName: 'APEX TECH SUPPLIES',
    transactionDate: '26 OCT 2023',
    transactionNumber: '',
    itemsSold: '',
    subtotal: '',
    totalAmount: '',
    surveyCode: ''
  });

  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrorMsg(null);
  };

  const handleFillDemoValues = () => {
    const filled: Record<string, string> = {};
    fields.forEach((f) => {
      filled[f.key] = f.expectedValue || '';
    });
    setFormData(filled);
    setErrorMsg(null);
  };

  const calculateAccuracy = () => {
    let matches = 0;
    fields.forEach((f) => {
      const entered = (formData[f.key] || '').trim().toLowerCase();
      const expected = (f.expectedValue || '').trim().toLowerCase();
      if (entered && (entered === expected || entered.includes(expected) || expected.includes(entered))) {
        matches += 1;
      }
    });
    return Math.round((matches / fields.length) * 100);
  };

  const accuracy = calculateAccuracy();

  const handleSubmit = () => {
    // Check missing fields
    const missing = fields.filter((f) => !formData[f.key]?.trim());
    if (missing.length > 0) {
      setErrorMsg(`Please fill in all ${fields.length} receipt fields before submitting (${missing.length} missing).`);
      return;
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
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Data Entry & Digitization</span>
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

        {/* Workstation Body */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left Pane: Document Image Viewer with Zoom */}
          <div className="flex-1 bg-slate-900 p-4 flex flex-col items-center justify-center relative overflow-hidden select-none border-b lg:border-b-0 lg:border-r border-slate-800">
            {/* Zoom toolbar */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-800/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
                className="hover:text-white p-1"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] px-1">{zoomLevel}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(180, z + 15))}
                className="hover:text-white p-1"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-auto w-full h-full max-h-[64vh] flex items-center justify-center p-2">
              <img
                src={config?.documentUrl || receiptSampleScan}
                alt="Scanned Receipt Document"
                className="rounded-lg shadow-2xl transition-transform duration-200 origin-center max-w-full"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              />
            </div>
          </div>

          {/* Right Pane: Digitization Form Fields */}
          <div className="w-full lg:w-96 bg-white p-5 flex flex-col justify-between overflow-y-auto max-h-[64vh] lg:max-h-none">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Structured Extraction
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Transcribe printed values accurately
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFillDemoValues}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                >
                  Quick Fill Sample
                </button>
              </div>

              {/* Form fields */}
              <div className="space-y-3.5">
                {fields.map((field) => {
                  const val = formData[field.key] || '';
                  const isMatch = val.trim().toLowerCase() === (field.expectedValue || '').toLowerCase();
                  return (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-medium text-slate-700">
                          {field.label}
                        </label>
                        {isMatch && (
                          <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
                            <Check className="w-3 h-3" />
                            <span>Matched</span>
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={val}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors outline-hidden font-mono ${
                            isMatch
                              ? 'border-emerald-300 bg-emerald-50/20 text-slate-900 focus:border-emerald-500'
                              : 'border-slate-300 bg-white text-slate-800 focus:border-indigo-500'
                          }`}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {field.hint}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Accuracy readout */}
              <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
                  <span>Transcription Accuracy</span>
                  <span className="font-mono font-bold text-indigo-600 tabular-nums">{accuracy}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      accuracy >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${accuracy}%` }}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Verifying Digits...' : `Submit Extraction ($${task.reward.toFixed(2)})`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
