import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Cpu,
  FileCode2,
  Folder,
  FolderOpen,
  Paperclip,
  Shield,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type {
  DotAttachedWorkspaceFile,
  DotEffortLevel,
  DotModelOption,
  DotPermissionMode,
  DotWorkspaceOption,
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
  availableModels?: DotModelOption[];
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
  effort?: DotEffortLevel;
  onEffortChange?: (effort: DotEffortLevel) => void;
  permissionMode?: DotPermissionMode;
  onPermissionModeChange?: (mode: DotPermissionMode) => void;
  workspaces?: DotWorkspaceOption[];
  activeWorkspaceId?: string;
  workspaceRootPath?: string;
  onSelectWorkspace?: (workspaceId: string) => void;
  onOpenFolderPicker?: () => void;
  attachedWorkspaceFiles?: DotAttachedWorkspaceFile[];
  onRemoveWorkspaceFile?: (filePath: string) => void;
  onToggleWorkspaceBrowser?: () => void;
  placeholder?: string;
}

const EFFORT_LABELS: Array<{ id: DotEffortLevel; label: string }> = [
  { id: 'low', label: 'Rapide' },
  { id: 'medium', label: 'Équilibré' },
  { id: 'high', label: 'Élevé' },
  { id: 'max', label: 'Max' },
];

const PERMISSION_LABELS: Array<{ id: DotPermissionMode; label: string }> = [
  { id: 'manual', label: 'Demander' },
  { id: 'auto-edit', label: 'Auto-édition' },
  { id: 'plan', label: 'Plan' },
];

export function MissionComposer({
  onMissionSubmit,
  activeMissionPrompt,
  onClearActiveMission,
  isDemoMode = true,
  inspectorOpen = false,
  leftPanelOpen = false,
  availableModels = [],
  selectedModelId,
  onModelChange,
  effort = 'low',
  onEffortChange,
  permissionMode = 'manual',
  onPermissionModeChange,
  workspaces = [],
  activeWorkspaceId,
  workspaceRootPath,
  onSelectWorkspace,
  onOpenFolderPicker,
  attachedWorkspaceFiles = [],
  onRemoveWorkspaceFile,
  onToggleWorkspaceBrowser,
  placeholder = 'Décrire une mission à confier au réseau Dot Brain…',
}: MissionComposerProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<MissionMode>('orchestration');
  const [attachments, setAttachments] = useState<MissionAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const folderMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!folderMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setFolderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [folderMenuOpen]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const activeFolderLabel =
    activeWorkspace?.name ||
    workspaceRootPath?.split(/[\\/]/).filter(Boolean).pop() ||
    'Dossier';

  const canSubmit =
    (prompt.trim().length > 0 ||
      attachments.length > 0 ||
      attachedWorkspaceFiles.length > 0) &&
    !isSubmitting;

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
    const totalAttached = attachments.length + attachedWorkspaceFiles.length;
    const payload: MissionPayload = {
      id: `mission-${Date.now()}`,
      prompt: trimmed || `Analyse des fichiers joints (${totalAttached})`,
      mode,
      attachments,
      submittedAt: new Date().toISOString(),
      modelId: selectedModelId,
      effort,
      permissionMode,
      workspaceId: activeWorkspace?.id,
      workspaceName: activeWorkspace?.name,
      workspacePath: workspaceRootPath || activeWorkspace?.pathLabel,
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

  const hasAnyAttachment = attachments.length > 0 || attachedWorkspaceFiles.length > 0;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-3 pb-4 transition-[padding] duration-200 sm:px-5 sm:pb-5 ${
        leftPanelOpen ? 'lg:pl-[336px]' : ''
      } ${inspectorOpen ? 'lg:pr-[376px]' : ''}`}
    >
      <div className="pointer-events-auto w-full min-w-0 max-w-[740px]">
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
          className="max-w-full rounded-2xl border border-[#D8D5CC] bg-[#FFFFFF]/98 shadow-[0_12px_36px_-16px_rgba(28,27,25,0.16)] backdrop-blur-md transition-colors focus-within:border-[#ABA79B] dark:border-[#454540] dark:bg-[#30302E]/98 dark:shadow-[0_16px_42px_-16px_rgba(0,0,0,0.58)] dark:focus-within:border-[#63635C]"
        >
          {/* Fichiers joints (uploadés + fichiers du dossier actif) */}
          {hasAnyAttachment && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[#EAE8E1] px-4 py-2 text-xs text-[#5A5852] dark:border-[#3E3E39] dark:text-[#B4B1A8]">
              {attachedWorkspaceFiles.map((wf) => (
                <div
                  key={`ws-${wf.path}`}
                  className="flex items-center gap-1.5 rounded-md bg-[#FAF9F5] px-2 py-0.5 border border-[#E5E3DC] dark:bg-[#262624] dark:border-[#42423D]"
                >
                  <FileCode2 className="h-3 w-3 text-[#D97757]" />
                  <span
                    className="max-w-[190px] truncate font-mono text-[11px] font-medium text-[#1C1B19] dark:text-[#ECEAE4]"
                    title={wf.path}
                  >
                    {wf.path}
                  </span>
                  {typeof wf.size === 'number' && (
                    <span className="font-mono text-[10.5px] text-[#827F77] dark:text-[#96938A]">
                      {formatBytes(wf.size)}
                    </span>
                  )}
                  {onRemoveWorkspaceFile && (
                    <button
                      type="button"
                      onClick={() => onRemoveWorkspaceFile(wf.path)}
                      aria-label={`Retirer le fichier ${wf.path}`}
                      className="ml-0.5 text-[#827F77] transition-colors hover:text-[#1C1B19] dark:text-[#96938A] dark:hover:text-[#ECEAE4] cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
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
              placeholder={placeholder}
              className="block w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-[#1C1B19] placeholder:text-[#8E8B82] focus:outline-none dark:text-[#ECEAE4] dark:placeholder:text-[#8C8980]"
            />
          </div>

          {/* Barre d'actions inférieure : fichiers, dossier, mode, modèle, effort, permissions, envoi */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0">
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
                className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[#5A5852] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] dark:focus-visible:outline-[#D97757] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Fichiers</span>
              </button>

              {/* Sélecteur de dossier / espace de travail */}
              {(workspaces.length > 0 || onOpenFolderPicker || onToggleWorkspaceBrowser) && (
                <div ref={folderMenuRef} className="relative">
                  <button
                    type="button"
                    data-testid="dot-brain-composer-folder-btn"
                    onClick={() => setFolderMenuOpen((v) => !v)}
                    aria-expanded={folderMenuOpen}
                    aria-label="Choisir le dossier ou parcourir les fichiers"
                    title={workspaceRootPath || activeWorkspace?.pathLabel || 'Choisir un dossier'}
                    className="flex h-7 max-w-[150px] items-center gap-1 rounded-lg px-2 text-xs font-medium text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] dark:text-[#C8C5BC] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] cursor-pointer"
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0 text-[#D97757]" />
                    <span className="truncate">{activeFolderLabel}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-65" />
                  </button>

                  {folderMenuOpen && (
                    <div
                      role="menu"
                      aria-label="Espaces de travail et dossiers"
                      className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-[#DFDDD5] bg-[#FFFFFF] p-1.5 shadow-xl dark:border-[#42423D] dark:bg-[#2B2B29] z-40"
                    >
                      {workspaces.length > 0 && (
                        <div className="mb-1">
                          <div className="px-2 py-1 text-[10.5px] font-medium uppercase tracking-wider text-[#827F77] dark:text-[#8E8B82]">
                            Espaces de travail
                          </div>
                          {workspaces.map((ws) => {
                            const selected = ws.id === activeWorkspace?.id;
                            return (
                              <button
                                key={ws.id}
                                type="button"
                                role="menuitemradio"
                                aria-checked={selected}
                                onClick={() => {
                                  onSelectWorkspace?.(ws.id);
                                  setFolderMenuOpen(false);
                                }}
                                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[#1C1B19] transition-colors hover:bg-[#EFECE5] dark:text-[#ECEAE4] dark:hover:bg-[#3A3A37] cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-medium">{ws.name}</div>
                                  <div className="truncate font-mono text-[10.5px] text-[#827F77] dark:text-[#96938A]">
                                    {ws.pathLabel}
                                  </div>
                                </div>
                                {selected && (
                                  <Check className="h-3.5 w-3.5 shrink-0 text-[#D97757]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="border-t border-[#EAE8E1] pt-1 dark:border-[#3E3E39]">
                        {onToggleWorkspaceBrowser && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onToggleWorkspaceBrowser();
                              setFolderMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[#1C1B19] transition-colors hover:bg-[#EFECE5] dark:text-[#ECEAE4] dark:hover:bg-[#3A3A37] cursor-pointer"
                          >
                            <FileCode2 className="h-3.5 w-3.5 text-[#D97757]" />
                            <span>Parcourir les fichiers du dossier</span>
                          </button>
                        )}
                        {onOpenFolderPicker && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onOpenFolderPicker();
                              setFolderMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[#1C1B19] transition-colors hover:bg-[#EFECE5] dark:text-[#ECEAE4] dark:hover:bg-[#3A3A37] cursor-pointer"
                          >
                            <FolderOpen className="h-3.5 w-3.5 text-[#D97757]" />
                            <span>Ouvrir un autre dossier…</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <span className="h-3.5 w-px bg-[#DFDDD5] dark:bg-[#44443F]" aria-hidden="true" />

              {/* Sélecteur de mode de mission */}
              <label htmlFor="mission-mode-select" className="sr-only">
                Mode de mission
              </label>
              <select
                id="mission-mode-select"
                value={mode}
                onChange={(e) => setMode(e.target.value as MissionMode)}
                className="h-7 rounded-lg bg-transparent px-1.5 text-xs font-medium text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] focus:outline-none dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] cursor-pointer"
              >
                {MISSION_MODES.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    className="bg-[#FFFFFF] text-[#1C1B19] dark:bg-[#30302E] dark:text-[#ECEAE4]"
                  >
                    {m.label}
                  </option>
                ))}
              </select>

              {/* Sélecteur de modèle IA dans Dot Brain */}
              {availableModels.length > 0 && onModelChange && (
                <>
                  <span className="h-3.5 w-px bg-[#DFDDD5] dark:bg-[#44443F]" aria-hidden="true" />
                  <div className="flex items-center gap-1 rounded-lg px-1 text-[#4E4C46] hover:bg-[#EFECE5] dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38]">
                    <Cpu className="h-3 w-3 shrink-0 text-[#D97757]" />
                    <label htmlFor="dot-brain-model-select" className="sr-only">
                      Modèle IA pour Dot Brain
                    </label>
                    <select
                      id="dot-brain-model-select"
                      data-testid="dot-brain-model-select"
                      value={selectedModelId ?? availableModels[0]?.id ?? ''}
                      onChange={(e) => onModelChange(e.target.value)}
                      className="h-7 max-w-[165px] bg-transparent pr-1 text-xs font-medium text-[#1C1B19] focus:outline-none dark:text-[#ECEAE4] cursor-pointer"
                    >
                      {availableModels.map((model) => (
                        <option
                          key={model.id}
                          value={model.id}
                          className="bg-[#FFFFFF] text-[#1C1B19] dark:bg-[#30302E] dark:text-[#ECEAE4]"
                        >
                          {model.shortLabel ?? model.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Sélecteur d'effort */}
              {onEffortChange && (
                <div className="hidden items-center gap-0.5 rounded-lg px-1 text-[#5A5852] hover:bg-[#EFECE5] sm:flex dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38]">
                  <SlidersHorizontal className="h-3 w-3 shrink-0 opacity-70" />
                  <label htmlFor="dot-brain-effort-select" className="sr-only">
                    Effort de raisonnement
                  </label>
                  <select
                    id="dot-brain-effort-select"
                    data-testid="dot-brain-effort-select"
                    value={effort}
                    onChange={(e) => onEffortChange(e.target.value as DotEffortLevel)}
                    className="h-7 bg-transparent text-[11.5px] font-medium text-[#4E4C46] focus:outline-none dark:text-[#C8C5BC] cursor-pointer"
                  >
                    {EFFORT_LABELS.map((opt) => (
                      <option
                        key={opt.id}
                        value={opt.id}
                        className="bg-[#FFFFFF] text-[#1C1B19] dark:bg-[#30302E] dark:text-[#ECEAE4]"
                      >
                        Effort : {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sélecteur de permission */}
              {onPermissionModeChange && (
                <div className="hidden items-center gap-0.5 rounded-lg px-1 text-[#5A5852] hover:bg-[#EFECE5] md:flex dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38]">
                  <Shield className="h-3 w-3 shrink-0 opacity-70" />
                  <label htmlFor="dot-brain-permission-select" className="sr-only">
                    Mode de permission
                  </label>
                  <select
                    id="dot-brain-permission-select"
                    data-testid="dot-brain-permission-select"
                    value={permissionMode}
                    onChange={(e) =>
                      onPermissionModeChange(e.target.value as DotPermissionMode)
                    }
                    className="h-7 bg-transparent text-[11.5px] font-medium text-[#4E4C46] focus:outline-none dark:text-[#C8C5BC] cursor-pointer"
                  >
                    {PERMISSION_LABELS.map((opt) => (
                      <option
                        key={opt.id}
                        value={opt.id}
                        className="bg-[#FFFFFF] text-[#1C1B19] dark:bg-[#30302E] dark:text-[#ECEAE4]"
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              aria-label="Envoyer la mission"
              className={`ml-auto flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#D97757] ${
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
