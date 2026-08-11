"use client";

import { useState } from "react";
import { X, Sparkles, Save } from "lucide-react";

interface PromptModalProps {
  currentPrompt: string;
  onClose: () => void;
  onSavePrompt: (prompt: string) => void;
}

export function CustomPromptModal({ currentPrompt, onClose, onSavePrompt }: PromptModalProps) {
  const [promptText, setPromptText] = useState(currentPrompt || "");

  const handleSave = () => {
    onSavePrompt(promptText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card bg-paper border-line w-full max-w-lg p-0 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-line bg-paper-dark flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">AI Custom Strategy Prompt</h2>
              <p className="text-xs text-ink/50">Customize Gemini AI rules for competitor price benchmarking</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-line text-ink/50 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="label">Custom AI Instruction / Grounding Prompt</label>
            <textarea
              rows={5}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g. Focus on high-end cloud kitchens in Elgin area. Ensure suggestive price gives at least 40% net margin after 30% commission."
              className="input font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="p-3 rounded-lg bg-paper-dark border border-line text-[11px] text-ink/50 space-y-1">
            <p className="font-semibold text-ink/70">💡 Prompt Tips:</p>
            <p>• Specify target restaurant sub-segment (e.g. Fine Dining, QSR, Dessert Parlors).</p>
            <p>• Define pricing position (e.g. Premium 10% above market or Aggressive 5% below market).</p>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-end gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={handleSave} className="btn btn-primary flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Save AI Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
