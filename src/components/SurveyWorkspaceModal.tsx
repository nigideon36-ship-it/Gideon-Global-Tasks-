import React, { useState } from 'react';
import { Task, SurveyQuestion } from '../types/tasks';
import { useTasks } from '../context/TaskContext';
import { X, CheckCircle, ArrowRight, ArrowLeft, ShieldCheck, HelpCircle } from 'lucide-react';

interface Props {
  task: Task;
  onClose: () => void;
}

export const SurveyWorkspaceModal: React.FC<Props> = ({ task, onClose }) => {
  const { completeTask } = useTasks();
  const questions: SurveyQuestion[] = task.surveyQuestions || [];

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeQuestion = questions[currentStep];
  const progressPercent = Math.round(((currentStep + 1) / questions.length) * 100);

  const handleSingleSelect = (val: string) => {
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: val }));
    setErrorMsg(null);
  };

  const handleMultiSelect = (val: string) => {
    const existing: string[] = answers[activeQuestion.id] || [];
    const updated = existing.includes(val)
      ? existing.filter((item) => item !== val)
      : [...existing, val];
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: updated }));
    setErrorMsg(null);
  };

  const handleScaleSelect = (num: number) => {
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: num }));
    setErrorMsg(null);
  };

  const handleTextChange = (text: string) => {
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: text }));
    setErrorMsg(null);
  };

  const validateCurrentStep = (): boolean => {
    if (!activeQuestion) return true;
    const currentAnswer = answers[activeQuestion.id];

    if (activeQuestion.required) {
      if (currentAnswer === undefined || currentAnswer === null || currentAnswer === '') {
        setErrorMsg('Please provide an answer before continuing.');
        return false;
      }
      if (activeQuestion.type === 'multiple-choice' && Array.isArray(currentAnswer) && currentAnswer.length === 0) {
        setErrorMsg('Please select at least one option.');
        return false;
      }
      if (activeQuestion.type === 'text') {
        const minChars = activeQuestion.minChars || 15;
        if (typeof currentAnswer === 'string' && currentAnswer.trim().length < minChars) {
          setErrorMsg(`Please write at least ${minChars} characters to ensure insightful data (${currentAnswer.trim().length}/${minChars}).`);
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < questions.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setErrorMsg(null);
    } else {
      handleSubmitSurvey();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setErrorMsg(null);
    }
  };

  const handleSubmitSurvey = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      completeTask(task.id, task.reward, task.title);
      setIsSubmitting(false);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Paid Survey</span>
              <span aria-hidden="true">·</span>
              <span>{task.requesterName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-600 font-semibold">${task.reward.toFixed(2)} Reward</span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 mt-0.5 line-clamp-1">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-indigo-600 h-1.5 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Question Body */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Question {currentStep + 1} of {questions.length}</span>
            <span>{progressPercent}% Complete</span>
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-6">
            {activeQuestion.question}
          </h3>

          {/* Question Type: Single Choice */}
          {activeQuestion.type === 'single-choice' && activeQuestion.options && (
            <div className="space-y-3">
              {activeQuestion.options.map((option, idx) => {
                const isSelected = answers[activeQuestion.id] === option;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSingleSelect(option)}
                    className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <span>{option}</span>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Question Type: Multiple Choice */}
          {activeQuestion.type === 'multiple-choice' && activeQuestion.options && (
            <div className="space-y-3">
              {activeQuestion.options.map((option, idx) => {
                const selectedArr: string[] = answers[activeQuestion.id] || [];
                const isSelected = selectedArr.includes(option);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleMultiSelect(option)}
                    className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <span>{option}</span>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Question Type: Scale Rating */}
          {activeQuestion.type === 'scale' && (
            <div className="py-4">
              <div className="grid grid-cols-5 md:grid-cols-10 gap-2 mb-4">
                {Array.from(
                  { length: (activeQuestion.scaleMax || 10) - (activeQuestion.scaleMin || 1) + 1 },
                  (_, i) => (activeQuestion.scaleMin || 1) + i
                ).map((num) => {
                  const isSelected = answers[activeQuestion.id] === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleScaleSelect(num)}
                      className={`h-12 rounded-xl font-bold font-mono text-sm border transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                          : 'border-slate-200 hover:border-indigo-300 bg-slate-50 text-slate-700 hover:bg-white'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>{activeQuestion.scaleMinLabel || '1 = Lowest'}</span>
                <span>{activeQuestion.scaleMaxLabel || '10 = Highest'}</span>
              </div>
            </div>
          )}

          {/* Question Type: Free Text */}
          {activeQuestion.type === 'text' && (
            <div>
              <textarea
                rows={4}
                value={answers[activeQuestion.id] || ''}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Type your authentic response here..."
                className="w-full p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-800 text-sm resize-none outline-hidden"
              />
              <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
                <span>Quality checks are enabled. Minimum {activeQuestion.minChars || 15} characters.</span>
                <span className="font-mono">
                  {(answers[activeQuestion.id] || '').length} / {activeQuestion.minChars || 15} min
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium ${
              currentStep === 0
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-700 hover:bg-slate-200/80 transition-colors'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline">
              Instant payout upon validation
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <span>{currentStep === questions.length - 1 ? 'Submit & Earn' : 'Next Question'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
