import React, { useRef, useState } from 'react';
import { ArrowUp, Paperclip, X } from 'lucide-react';
import type {
  MissionAttachment,
  MissionMode,
  MissionPayload,
} from '../types/dotBrain';
import { MISSION_MODES } from '../constants/dotVisuals';

interface MissionComposerProps {
  onMissionSubmit: (mission: MissionPayload) => void | Promise<void>;
  activeMissionPrompt?: string | null;
  onClearActiveMission?: () => void;
  isDemoMode?: boolean;
  inspectorOpen?: boolean;
  leftPanelOpen?: boolean;
}

export function MissionComposer({
  onMissionSubmit,
  activeMissionPrompt,
  onClearActiveMission,
  isDemoMode = true,
  inspectorOpen = false,
  leftPanelOpen = false,
}: MissionComposerProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<MissionMode>('orchestration');
  const [attachments, setAttachments] = useState<MissionAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSubmit = (prompt.trim().length > 0 || attachments.length > 0) && !isSubmitting;

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const added: MissionAttachment[] = Array.from(files).map((file, idx) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${idx}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      file,
    }));

    setAttachments((prev) => [...prev, ...added]);
    e.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;

    const trimmed = prompt.trim();
    const payload: MissionPayload = {
      id: `mission-${Date.now()}`,
      prompt: trimmed || `Analyse des pièces jointes (${attachments.length})`,
      mode,
      attachments,
      submittedAt: new Date().toISOString(),
    };

    try {
      setIsSubmitting(true);
      await onMissionSubmit(payload);
      setPrompt('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-3 pb-4 transition-[padding] duration-200 sm:px-6 sm:pb-5 ${
        leftPanelOpen ? 'lg:pl-[332px]' : ''
      } ${inspectorOpen ? 'lg:pr-[384px]' : ''}`}
    >
      <div className="pointer-events-auto w-full max-w-[680px]">
        {/* Bandeau discret de mission active */}
        {activeMissionPrompt && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#DFDDD5] bg-[#FFFFFF]/95 px-3.5 py-2 text-xs text-[#4E4C46] shadow-xs backdrop-blur-sm dark:border-[#42423D] dark:bg-[#30302E]/95 dark:text-[#C8C5BC]">
            <div className="min-w-0 truncate">
              <span className="font-medium text-[#1C1B19] dark:text-[#ECEAE4]">
                {isDemoMode ? 'Mission simulée :' : 'Mission active :'}
              </span>{' '}
              <span>{activeMissionPrompt}</span>
            </div>
            {onClearActiveMission && (
              <button
                type="button"
                onClick={onClearActiveMission}
                aria-label="Effacer le bandeau de mission active"
                className="shrink-0 text-[#827F77] transition-colors hover:text-[#1C1B19] dark:text-[#96938A] dark:hover:text-[#ECEAE4] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Barre de mission principale (esthétique épurée inspirée de Claude) */}
        <form
          onSubmit={handleSubmit}
          aria-label="Composer une mission multi-agents"
          className="rounded-2xl border border-[#D8D5CC] bg-[#FFFFFF]/98 shadow-[0_12px_36px_-16px_rgba(28,27,25,0.16)] backdrop-blur-md transition-colors focus-within:border-[#ABA79B] dark:border-[#454540] dark:bg-[#30302E]/98 dark:shadow-[0_16px_42px_-16px_rgba(0,0,0,0.58)] dark:focus-within:border-[#63635C]"
        >
          {/* Fichiers joints éventuels */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[#EAE8E1] px-4 py-2 text-xs text-[#5A5852] dark:border-[#3E3E39] dark:text-[#B4B1A8]">
              {attachments.map((item) => (
                <div key={item.id} className="flex items-center gap-1.5">
                  <Paperclip className="h-3 w-3 text-[#827F77] dark:text-[#96938A]" />
                  <span className="max-w-[180px] truncate font-medium text-[#1C1B19] dark:text-[#ECEAE4]">
                    {item.name}
                  </span>
                  <span className="font-mono text-[11px] text-[#827F77] dark:text-[#96938A]">
                    {formatBytes(item.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(item.id)}
                    aria-label={`Retirer le fichier ${item.name}`}
                    className="ml-0.5 text-[#827F77] transition-colors hover:text-[#1C1B19] dark:text-[#96938A] dark:hover:text-[#ECEAE4] cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Champ de texte de la mission */}
          <div className="px-4 pt-3 pb-1.5">
            <label htmlFor="mission-composer-input" className="sr-only">
              Décrire une mission pour le réseau d’agents
            </label>
            <textarea
              ref={textareaRef}
              id="mission-composer-input"
              rows={1}
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              placeholder="Décrire une mission à confier au réseau Dot Brain…"
              className="block w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-[#1C1B19] placeholder:text-[#8E8B82] focus:outline-none dark:text-[#ECEAE4] dark:placeholder:text-[#8C8980]"
            />
          </div>

          {/* Barre d'actions inférieure */}
          <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelection}
                className="hidden"
                aria-label="Sélectionner des fichiers à joindre"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Ajouter des fichiers"
                title="Ajouter des fichiers"
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#5A5852] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] dark:focus-visible:outline-[#D97757] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Fichiers</span>
              </button>

              <span className="h-4 w-px bg-[#DFDDD5] dark:bg-[#44443F]" aria-hidden="true" />

              <label htmlFor="mission-mode-select" className="sr-only">
                Mode de mission
              </label>
              <select
                id="mission-mode-select"
                value={mode}
                onChange={(e) => setMode(e.target.value as MissionMode)}
                className="h-8 rounded-lg bg-transparent px-2 text-xs font-medium text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] dark:focus-visible:outline-[#D97757] cursor-pointer"
              >
                {MISSION_MODES.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    className="bg-[#FFFFFF] text-[#1C1B19] dark:bg-[#30302E] dark:text-[#ECEAE4]"
                  >
                    Mode : {m.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              aria-label="Envoyer la mission"
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#D97757] ${
                canSubmit
                  ? 'bg-[#D97757] text-[#FAF9F5] hover:bg-[#C96949] dark:bg-[#D97757] dark:hover:bg-[#E28566] cursor-pointer'
                  : 'bg-[#E5E3DC] text-[#9A978E] dark:bg-[#3B3B37] dark:text-[#78756E] cursor-not-allowed'
              }`}
            >
              <span>Envoyer</span>
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
