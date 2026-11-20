import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Briefcase,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Gauge,
  MessageCircle,
  Monitor,
  Moon,
  Palette,
  Plug,
  RotateCcw,
  Search,
  Sun,
  User,
  X,
  Zap,
} from 'lucide-react';
import type {
  ChatFontPreference,
  ModelConfig,
  SettingsSectionId,
  ThemeMode,
  UserPreferences,
} from '../types/claude';
import { CLAUDE_MODELS } from '../data/demoData';

interface SettingsModalProps {
  initialTab: SettingsSectionId;
  preferences: UserPreferences;
  fccModels?: ModelConfig[];
  onUpdatePreferences: (next: UserPreferences) => void;
  onClose: () => void;
  onResetDemoData: () => void;
}

const NAV_GROUPS: Array<{
  items: Array<{ id: SettingsSectionId; label: string; icon: React.ComponentType<{ className?: string }> }>;
}> = [
  {
    items: [
      { id: 'account', label: 'Compte', icon: User },
      { id: 'usage', label: 'Utilisation', icon: Gauge },
    ],
  },
  {
    items: [
      { id: 'appearance', label: 'Apparence', icon: Palette },
      { id: 'general', label: 'Votre Claude', icon: MessageCircle },
      { id: 'models', label: 'Modèles', icon: Zap },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    items: [
      { id: 'customize', label: 'Personnaliser', icon: Briefcase },
      { id: 'code', label: 'Code', icon: Code2 },
      { id: 'fcc', label: 'Bridge FCC', icon: Plug },
    ],
  },
];

const SSE_CONTRACT_SNIPPET = `POST /v1/claude/stream
Content-Type: application/json
Accept: text/event-stream

data: {"type":"thinking_delta","delta":"Analyse du contexte…"}
data: {"type":"text_delta","delta":"Voici la réponse structurée."}
data: {"type":"done","thinkingDurationSec":2}`;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  initialTab,
  preferences,
  fccModels,
  onUpdatePreferences,
  onClose,
  onResetDemoData,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsSectionId>(initialTab);
  const [navSearch, setNavSearch] = useState('');
  const [endpointDraft, setEndpointDraft] = useState(preferences.fcc.endpointUrl);
  const [savedNotice, setSavedNotice] = useState(false);
  const [probeState, setProbeState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [probeMessage, setProbeMessage] = useState('');
  const [copiedContract, setCopiedContract] = useState(false);
  const [desktopNotif, setDesktopNotif] = useState(true);
  const [soundNotif, setSoundNotif] = useState(false);

  const availableModels =
    preferences.fcc.mode === 'fcc' && fccModels && fccModels.length > 0
      ? fccModels
      : CLAUDE_MODELS;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filteredGroups = useMemo(() => {
    const q = navSearch.trim().toLowerCase();
    if (!q) return NAV_GROUPS;
    return NAV_GROUPS.map((g) => ({
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [navSearch]);

  const handleSaveEndpoint = () => {
    onUpdatePreferences({
      ...preferences,
      fcc: {
        ...preferences.fcc,
        endpointUrl: endpointDraft.trim() || 'http://localhost:8787/v1/claude/stream',
      },
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleProbeEndpoint = async () => {
    const url = endpointDraft.trim();
    if (!url) return;
    setProbeState('testing');
    setProbeMessage('Vérification de la connectivité…');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(url, { method: 'OPTIONS', signal: controller.signal });
      window.clearTimeout(timer);
      setProbeState('ok');
      setProbeMessage(`Endpoint joignable (HTTP ${res.status}).`);
    } catch {
      window.clearTimeout(timer);
      setProbeState('error');
      setProbeMessage(
        'Aucun serveur FCC joignable sur cette URL depuis le navigateur (CORS ou service arrêté). Le mode démonstration reste disponible.'
      );
    }
  };

  const handleCopyContract = async () => {
    try {
      await navigator.clipboard.writeText(SSE_CONTRACT_SNIPPET);
      setCopiedContract(true);
      window.setTimeout(() => setCopiedContract(false), 1800);
    } catch {
      // ignore
    }
  };

  const currentSectionTitle =
    NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeTab)?.label ?? 'Paramètres';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div
        onClick={onClose}
        className="claude-animate-backdrop fixed inset-0 bg-black/45 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="claude-animate-modal relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border-0 bg-[var(--claude-bg-elevated)] sm:h-[600px] sm:max-h-[88vh] sm:max-w-[780px] sm:rounded-2xl sm:border sm:border-[var(--claude-border)]"
        style={{ boxShadow: 'var(--claude-popover-shadow)' }}
      >
        {/* Top Modal Header (1:1 settings-models-en.png) */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--claude-border)] px-4 sm:px-5">
          <h2
            id="settings-modal-title"
            className="m-0 text-[15px] font-semibold text-[var(--claude-text-primary)]"
          >
            Paramètres
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les paramètres"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--claude-text-muted)] transition-colors hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)] sm:h-7 sm:w-7"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile Horizontal Section Tabs (<sm) */}
        <nav
          aria-label="Sections des paramètres (mobile)"
          className="claude-scroll flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-[var(--claude-border)] px-3 py-2 sm:hidden"
        >
          {NAV_GROUPS.flatMap((g) => g.items).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                  active
                    ? 'bg-[var(--claude-sidebar-active)] font-medium text-[var(--claude-text-primary)]'
                    : 'text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Body Split: Searchable Left Nav + Content Panel */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <nav
            aria-label="Sections des paramètres"
            className="claude-scroll hidden w-[206px] shrink-0 overflow-y-auto border-r border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] p-3 sm:block"
          >
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--claude-text-muted)]" />
              <input
                type="search"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="Rechercher"
                className="w-full rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] py-1.5 pl-8 pr-2.5 text-[12.5px] text-[var(--claude-text-primary)] placeholder:text-[var(--claude-text-muted)]"
              />
            </div>

            <div className="space-y-3">
              {filteredGroups.map((group, gi) => (
                <div
                  key={gi}
                  className={gi > 0 ? 'border-t border-[var(--claude-border)] pt-2.5' : ''}
                >
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                            active
                              ? 'bg-[var(--claude-sidebar-active)] font-medium text-[var(--claude-text-primary)]'
                              : 'text-[var(--claude-text-secondary)] hover:bg-[var(--claude-surface-subtle)] hover:text-[var(--claude-text-primary)]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* Right Scrollable Settings Content */}
          <div className="claude-scroll flex-1 overflow-y-auto px-4 py-4 text-[13px] sm:px-6 sm:py-5">
            <h3 className="m-0 text-[16px] font-semibold text-[var(--claude-text-primary)]">
              {currentSectionTitle}
            </h3>

            {/* MODELS TAB (1:1 settings-models-en.png) */}
            {activeTab === 'models' && (
              <div className="mt-4 space-y-5">
                <div>
                  <div className="mb-1.5 text-[11.5px] font-medium text-[var(--claude-text-muted)]">
                    Moteur de réponse &amp; Bridge FCC
                  </div>
                  <div className="space-y-3.5 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium text-[var(--claude-text-primary)]">
                          Mode de transport
                        </div>
                        <div className="text-[12px] text-[var(--claude-text-muted)]">
                          API Gemini en direct (serveur), démonstration locale ou relais SSE vers votre FCC Claude.
                        </div>
                      </div>
                      <div className="inline-flex self-start rounded-lg bg-[var(--claude-surface-subtle)] p-0.5 text-[12px] sm:self-auto">
                        {(
                          [
                            { id: 'gemini', label: 'API Gemini' },
                            { id: 'demo', label: 'Démo' },
                            { id: 'fcc', label: 'Bridge FCC' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              onUpdatePreferences({
                                ...preferences,
                                fcc: { ...preferences.fcc, mode: opt.id },
                              })
                            }
                            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                              preferences.fcc.mode === opt.id
                                ? 'bg-[var(--claude-bg-elevated)] text-[var(--claude-text-primary)] shadow-xs'
                                : 'text-[var(--claude-text-secondary)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {preferences.fcc.mode === 'gemini' && (
                      <div className="border-t border-[var(--claude-border)] pt-3 text-[12px] text-[var(--claude-text-secondary)]">
                        Les messages sont traités en streaming SSE côté serveur via{' '}
                        <code className="font-claude-mono text-[var(--claude-inline-code-text)]">
                          gemini-4-hydrogen
                        </code>{' '}
                        (clé gérée automatiquement côté serveur dans <strong>Settings &gt; Secrets</strong>).
                      </div>
                    )}

                    <div className="flex flex-col gap-2.5 border-t border-[var(--claude-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-[var(--claude-text-primary)]">
                          URL de l’endpoint FCC (SSE)
                        </div>
                        <div className="text-[11.5px] text-[var(--claude-text-muted)]">
                          Utilisée uniquement lorsque le mode Bridge FCC est sélectionné.
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="url"
                          value={endpointDraft}
                          onChange={(e) => setEndpointDraft(e.target.value)}
                          className="w-full rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2.5 py-1.5 font-claude-mono text-[12px] sm:w-56"
                        />
                        <button
                          type="button"
                          onClick={handleSaveEndpoint}
                          className="rounded-lg bg-[var(--claude-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--claude-text-primary)] hover:bg-[var(--claude-sidebar-active)]"
                        >
                          {savedNotice ? 'Enregistré' : 'Enregistrer'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11.5px] font-medium text-[var(--claude-text-muted)]">
                    Modèles disponibles
                  </div>
                  <div className="divide-y divide-[var(--claude-border)] rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)]">
                    {availableModels.map((m, idx) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--claude-text-primary)]">
                              {m.name}
                            </span>
                            {idx === 0 && (
                              <span className="rounded-md bg-[var(--claude-surface-subtle)] px-1.5 py-0.5 text-[11px] text-[var(--claude-text-secondary)]">
                                Par défaut
                              </span>
                            )}
                          </div>
                          <div className="font-claude-mono text-[11.5px] text-[var(--claude-text-muted)]">
                            {m.id}
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--claude-text-muted)]">
                          <span>Faible – Max</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] text-[var(--claude-text-muted)]">
                    S’applique dès la prochaine requête.
                  </p>
                </div>
              </div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="mt-4 space-y-5">
                <div>
                  <label className="block text-[12.5px] font-medium text-[var(--claude-text-primary)]">
                    Thème de l’interface
                  </label>
                  <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'light', label: 'Clair', icon: Sun },
                        { id: 'dark', label: 'Sombre', icon: Moon },
                        { id: 'system', label: 'Système', icon: Monitor },
                      ] as Array<{ id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }>
                    ).map((opt) => {
                      const Icon = opt.icon;
                      const active = preferences.theme === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onUpdatePreferences({ ...preferences, theme: opt.id })
                          }
                          className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-[12.5px] font-medium transition-all ${
                            active
                              ? 'border-[var(--claude-accent)] bg-[var(--claude-accent-soft)] text-[var(--claude-text-primary)]'
                              : 'border-[var(--claude-border)] bg-[var(--claude-bg)] text-[var(--claude-text-secondary)] hover:border-[var(--claude-border-strong)]'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[12.5px] font-medium text-[var(--claude-text-primary)]">
                    Police des réponses
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'serif', label: 'Serif Claude', previewClass: 'font-claude-serif text-[14px]' },
                        { id: 'sans', label: 'Sans-serif', previewClass: 'font-claude-sans text-[12.5px]' },
                        { id: 'dyslexic', label: 'Confort lecture', previewClass: 'font-claude-dyslexic text-[12px]' },
                      ] as Array<{ id: ChatFontPreference; label: string; previewClass: string }>
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() =>
                          onUpdatePreferences({ ...preferences, chatFont: f.id })
                        }
                        className={`rounded-xl border px-3 py-2.5 font-medium transition-colors ${f.previewClass} ${
                          preferences.chatFont === f.id
                            ? 'border-[var(--claude-accent)] bg-[var(--claude-accent-soft)] text-[var(--claude-text-primary)]'
                            : 'border-[var(--claude-border)] bg-[var(--claude-bg)] text-[var(--claude-text-secondary)]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ACCOUNT / YOUR CLAUDE TAB */}
            {(activeTab === 'account' || activeTab === 'general') && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4 space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--claude-text-secondary)]">
                      Nom affiché
                    </label>
                    <input
                      type="text"
                      value={preferences.userName}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          userName: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-3 py-1.5 text-[13px]"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--claude-border)] pt-3">
                    <div>
                      <div className="font-medium text-[var(--claude-text-primary)]">
                        Envoyer avec la touche Entrée
                      </div>
                      <div className="text-[12px] text-[var(--claude-text-muted)]">
                        Utilisez Maj+Entrée pour insérer un saut de ligne.
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={preferences.sendWithEnter}
                      onClick={() =>
                        onUpdatePreferences({
                          ...preferences,
                          sendWithEnter: !preferences.sendWithEnter,
                        })
                      }
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        preferences.sendWithEnter
                          ? 'bg-[var(--claude-accent)]'
                          : 'bg-[var(--claude-border-strong)]'
                      }`}
                    >
                      <span
                        className={`block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                          preferences.sendWithEnter ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4">
                  <div>
                    <div className="font-medium text-[var(--claude-text-primary)]">
                      Réinitialiser les données de démonstration
                    </div>
                    <div className="text-[12px] text-[var(--claude-text-muted)]">
                      Restaure les sessions Code, conversations Chat, projets et artefacts initiaux.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onResetDemoData}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--claude-border-strong)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--claude-surface-subtle)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Réinitialiser
                  </button>
                </div>
              </div>
            )}

            {/* USAGE TAB */}
            {activeTab === 'usage' && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium text-[var(--claude-text-primary)]">
                      Fenêtre de session (exemple démo)
                    </span>
                    <span className="tabular-nums text-[var(--claude-text-muted)]">
                      41,8k / 128k tokens (33%)
                    </span>
                  </div>
                  <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-[var(--claude-surface-subtle)]">
                    <div className="w-[16%] bg-[#3B82F6]" />
                    <div className="w-[10%] bg-[#F97316]" />
                    <div className="w-[7%] bg-[#34A853]" />
                  </div>
                  <p className="mt-3 text-[12px] text-[var(--claude-text-muted)]">
                    Aucune facturation ni consommation réelle : l’interface tourne uniquement en frontend avec des compteurs de démonstration tant que votre bridge FCC n’est pas connecté.
                  </p>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS / CUSTOMIZE / CODE TABS */}
            {activeTab === 'notifications' && (
              <div className="mt-4 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] divide-y divide-[var(--claude-border)]">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">Notification de fin de tâche</div>
                    <div className="text-[12px] text-[var(--claude-text-muted)]">
                      Prévenir lorsqu’une génération longue ou une approbation attend votre réponse.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={desktopNotif}
                    onChange={(e) => setDesktopNotif(e.target.checked)}
                    className="h-4 w-4 accent-[var(--claude-accent)]"
                  />
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">Son discret</div>
                    <div className="text-[12px] text-[var(--claude-text-muted)]">
                      Émettre un signal subtil lors d’une demande de validation.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundNotif}
                    onChange={(e) => setSoundNotif(e.target.checked)}
                    className="h-4 w-4 accent-[var(--claude-accent)]"
                  />
                </div>
              </div>
            )}

            {(activeTab === 'customize' || activeTab === 'code') && (
              <div className="mt-4 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4 text-[12.5px] leading-relaxed text-[var(--claude-text-secondary)]">
                Cette interface reproduit l’expérience visuelle de <strong>Claude Desktop (Code &amp; Chat)</strong> exclusivement côté navigateur. Elle ne lit aucun fichier de votre disque, n’exécute aucune commande système réelle et n’accède ni à vos Skills ni à vos serveurs MCP locaux.
              </div>
            )}

            {/* BRIDGE FCC TAB */}
            {activeTab === 'fcc' && (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-surface-subtle)]/60 p-3.5 text-[12.5px] leading-relaxed text-[var(--claude-text-secondary)]">
                  Par défaut, les réponses sont générées en direct via le serveur{' '}
                  <code className="font-claude-mono text-[var(--claude-inline-code-text)]">
                    /api/gemini/stream
                  </code>{' '}
                  (<strong>gemini-4-hydrogen</strong>). L’interface n’accède ni à votre disque local, ni à vos Skills, ni à vos serveurs MCP. L’adaptateur{' '}
                  <code className="font-claude-mono text-[var(--claude-inline-code-text)]">
                    ClaudeTransportAdapter
                  </code>{' '}
                  reste prêt pour relier ultérieurement votre bridge FCC Claude.
                </div>

                <div className="space-y-2">
                  <label className="block text-[12px] font-medium text-[var(--claude-text-secondary)]">
                    URL de l’endpoint FCC (SSE)
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="url"
                      value={endpointDraft}
                      onChange={(e) => setEndpointDraft(e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] px-3 py-1.5 font-claude-mono text-[12.5px]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveEndpoint}
                      className="rounded-lg bg-[var(--claude-surface-subtle)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--claude-sidebar-active)]"
                    >
                      {savedNotice ? 'Enregistré' : 'Enregistrer'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleProbeEndpoint}
                      disabled={probeState === 'testing'}
                      className="rounded-lg border border-[var(--claude-border-strong)] px-3 py-1 text-[12px] font-medium hover:bg-[var(--claude-surface-subtle)] disabled:opacity-50"
                    >
                      {probeState === 'testing' ? 'Test en cours…' : 'Tester l’endpoint'}
                    </button>
                    {probeMessage && (
                      <span
                        className={`text-[12px] ${
                          probeState === 'ok'
                            ? 'text-[var(--cds-diff-add-text)]'
                            : 'text-[var(--claude-text-muted)]'
                        }`}
                      >
                        {probeMessage}
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-[var(--claude-border)] bg-[var(--claude-code-bg)]">
                  <div className="flex items-center justify-between border-b border-[var(--claude-border)] px-3 py-1.5 text-[11.5px] text-[var(--claude-text-muted)]">
                    <span>Contrat SSE attendu par l’interface</span>
                    <button
                      type="button"
                      onClick={handleCopyContract}
                      className="inline-flex items-center gap-1 hover:text-[var(--claude-text-primary)]"
                    >
                      {copiedContract ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="overflow-x-auto p-3 font-claude-mono text-[11.5px] leading-relaxed text-[var(--claude-text-secondary)]">
                    {SSE_CONTRACT_SNIPPET}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
