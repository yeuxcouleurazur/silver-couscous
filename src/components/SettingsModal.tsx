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
  Trash2,
  User,
  X,
  Zap,
  Download,
} from 'lucide-react';
import type {
  ChatFontPreference,
  ModelConfig,
  SettingsSectionId,
  ThemeMode,
  UserPreferences,
} from '../types/claude';
import { CLAUDE_MODELS } from '../data/demoData';
import { usageTracker, type UsageStats, type UsageRecord } from '../services/usageTracker';

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

data: {"type":"thinking_delta","delta":"Analyse du contexte..."}
data: {"type":"text_delta","delta":"Voici la réponse structurée."}
data: {"type":"done","thinkingDurationSec":2}`;

// Usage stat card component
interface UsageStatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function UsageStatCard({ label, value, icon, color }: UsageStatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] text-[var(--claude-text-muted)] mb-1">{label}</div>
          <div className="text-xl font-mono font-medium tabular-nums text-[var(--claude-text-primary)]">{value}</div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}/15` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

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
  // Presets d'endpoints FCC Claude connus
  const FCC_ENDPOINT_PRESETS = [
    { label: 'Claude Code FCC (local)', url: 'http://localhost:8787/v1/claude/stream', description: 'Bridge FCC standard Claude Code' },
    { label: 'Claude Code FCC (Docker)', url: 'http://host.docker.internal:8787/v1/claude/stream', description: 'Depuis container Docker' },
    { label: 'Claude Code FCC (Tailscale)', url: 'http://100.x.x.x:8787/v1/claude/stream', description: 'Via Tailscale (remplacez IP)' },
    { label: 'Personnalisé', url: '', description: 'Votre endpoint SSE personnalisé' },
  ] as const;

  const [endpointDraft, setEndpointDraft] = useState(preferences.fcc.endpointUrl);
  const [savedNotice, setSavedNotice] = useState(false);
  const [probeState, setProbeState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [probeMessage, setProbeMessage] = useState('');
  const [copiedContract, setCopiedContract] = useState(false);
  const [desktopNotif, setDesktopNotif] = useState(true);
  const [soundNotif, setSoundNotif] = useState(false);

  // Real usage tracking state
  const [usageStats, setUsageStats] = useState<UsageStats>(() => usageTracker.getStats());
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>(() => usageTracker.getHistory(50));
  const [showHistory, setShowHistory] = useState(false);

  // Subscribe to usage tracker updates
  useEffect(() => {
    const unsubscribe = usageTracker.subscribe(() => {
      setUsageStats(usageTracker.getStats());
      setUsageHistory(usageTracker.getHistory(50));
    });
    return unsubscribe;
  }, []);

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
    setProbeMessage('Vérification de la connectivité...');
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
                          URL de l'endpoint FCC (SSE)
                        </div>
                        <div className="text-[11.5px] text-[var(--claude-text-muted)]">
                          Utilisée uniquement lorsque le mode Bridge FCC est sélectionné.
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={endpointDraft}
                          onChange={(e) => setEndpointDraft(e.target.value)}
                          className="w-full rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg-elevated)] px-2.5 py-1.5 font-claude-mono text-[12px] sm:w-56"
                        >
                          {FCC_ENDPOINT_PRESETS.map((p) => (
                            <option key={p.url} value={p.url}>
                              {p.label} — {p.description}
                            </option>
                          ))}
                        </select>
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
                  <div className="divide-y divide-[var(--claude-border)] rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] max-h-96 overflow-y-auto">
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
                    S'applique dès la prochaine requête.
                  </p>
                </div>
              </div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="mt-4 space-y-5">
                <div>
                  <label className="block text-[12.5px] font-medium text-[var(--claude-text-primary)]">
                    Thème de l'interface
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
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <UsageStatCard
                    label="Requêtes totales"
                    value={usageStats.totalRequests.toLocaleString()}
                    icon={<Zap className="w-4 h-4" />}
                    color="var(--dot-info)"
                  />
                  <UsageStatCard
                    label="Tokens totaux"
                    value={usageStats.totalTokens.toLocaleString()}
                    icon={<Gauge className="w-4 h-4" />}
                    color="var(--dot-success)"
                  />
                  <UsageStatCard
                    label="Coût estimé"
                    value={`$${usageStats.totalEstimatedCost.toFixed(4)}`}
                    icon={<Briefcase className="w-4 h-4" />}
                    color="var(--dot-warning)"
                  />
                  <UsageStatCard
                    label="Taux de succès"
                    value={`${usageStats.successRate.toFixed(1)}%`}
                    icon={<Check className="w-4 h-4" />}
                    color={usageStats.successRate >= 90 ? 'var(--dot-success)' : usageStats.successRate >= 70 ? 'var(--dot-warning)' : 'var(--dot-error)'}
                  />
                </div>

                {/* Latency & Tokens breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4">
                    <div className="font-medium text-[var(--claude-text-primary)] mb-3">Latence moyenne</div>
                    <div className="text-2xl font-mono tabular-nums text-[var(--claude-text-primary)]">
                      {usageStats.averageLatencyMs > 0 ? `${usageStats.averageLatencyMs.toFixed(0)} ms` : '—'}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--claude-text-muted)]">
                      Prompt: {usageStats.totalPromptTokens.toLocaleString()} · Completion: {usageStats.totalCompletionTokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4">
                    <div className="font-medium text-[var(--claude-text-primary)] mb-3">Par fournisseur</div>
                    <div className="space-y-2">
                      {Object.entries(usageStats.byProvider).length > 0 ? (
                        Object.entries(usageStats.byProvider).map(([provider, stats]) => (
                          <div key={provider} className="flex items-center justify-between text-[12px]">
                            <span className="capitalize text-[var(--claude-text-secondary)]">{provider}</span>
                            <span className="tabular-nums text-[var(--claude-text-primary)] font-medium">
                              {stats.requests} req · {stats.totalTokens.toLocaleString()} tok · ${stats.estimatedCost.toFixed(4)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[12px] text-[var(--claude-text-muted)]">Aucune donnée</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* By Model */}
                <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-[var(--claude-text-primary)]">Par modèle</div>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center gap-1 text-[11px] text-[var(--claude-accent)] hover:underline"
                    >
                      {showHistory ? <ChevronRight className="w-3 h-3 rotate-90" /> : <ChevronRight className="w-3 h-3" />}
                      {showHistory ? 'Masquer l\'historique' : 'Voir l\'historique détaillé'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(usageStats.byModel).length > 0 ? (
                      Object.entries(usageStats.byModel)
                        .sort(([, a], [, b]) => b.totalTokens - a.totalTokens)
                        .map(([modelId, stats]) => (
                          <div key={modelId} className="rounded-lg border border-[var(--claude-border)] bg-[var(--claude-surface-subtle)]/50 p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[11px] text-[var(--claude-text-primary)] truncate">{stats.modelName}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--claude-border)] text-[var(--claude-text-muted)]">{stats.provider}</span>
                              </div>
                              <div className="text-right text-[11px]">
                                <div className="tabular-nums text-[var(--claude-text-primary)] font-medium">{stats.totalTokens.toLocaleString()} tokens</div>
                                <div className="text-[var(--claude-text-muted)]">${stats.estimatedCost.toFixed(4)} · {stats.requests} req · {stats.successRate.toFixed(0)}%</div>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-8 text-[var(--claude-text-muted)]">
                        <Gauge className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Aucun appel réel effectué pour le moment</p>
                        <p className="text-[11px] mt-1">Les données apparaîtront ici après vos premières requêtes vers FCC ou Gemini</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed History */}
                {showHistory && usageHistory.length > 0 && (
                  <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium text-[var(--claude-text-primary)]">Historique des appels (50 derniers)</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const data = usageTracker.exportData();
                            const blob = new Blob([data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `claude-usage-${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg border border-[var(--claude-border)] bg-[var(--claude-surface-subtle)] hover:bg-[var(--claude-bg)] transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          Exporter JSON
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Supprimer tout l\'historique d\'utilisation ? Cette action est irréversible.')) {
                              usageTracker.clearHistory();
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg border border-[var(--claude-border)] bg-[var(--claude-surface-subtle)] text-[var(--dot-error)] hover:bg-[var(--dot-error)]/10 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Effacer
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--claude-border)] text-left text-[var(--claude-text-muted)]">
                            <th className="pb-2 pr-4 font-medium">Horodatage</th>
                            <th className="pb-2 pr-4 font-medium">Modèle</th>
                            <th className="pb-2 pr-4 font-medium tabular-nums">Tokens</th>
                            <th className="pb-2 pr-4 font-medium tabular-nums">Coût</th>
                            <th className="pb-2 pr-4 font-medium tabular-nums">Latence</th>
                            <th className="pb-2 pr-4 font-medium">Statut</th>
                            <th className="pb-2 pr-4 font-medium">Contexte</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usageHistory.map((record) => (
                            <tr key={record.id} className="border-b border-[var(--claude-border)]/50 hover:bg-[var(--claude-surface-subtle)]/50">
                              <td className="py-2 pr-4 text-[var(--claude-text-secondary)] font-mono">
                                {new Date(record.timestamp).toLocaleTimeString()}
                              </td>
                              <td className="py-2 pr-4 text-[var(--claude-text-primary)] truncate max-w-[150px]">
                                {record.modelName} <span className="text-[10px] text-[var(--claude-text-muted)] capitalize">({record.provider})</span>
                              </td>
                              <td className="py-2 pr-4 tabular-nums text-[var(--claude-text-primary)]">
                                {record.totalTokens.toLocaleString()} ({record.promptTokens}/{record.completionTokens})
                              </td>
                              <td className="py-2 pr-4 tabular-nums text-[var(--claude-text-primary)]">
                                ${record.estimatedCost.toFixed(6)}
                              </td>
                              <td className="py-2 pr-4 tabular-nums text-[var(--claude-text-secondary)]">
                                {record.durationMs} ms
                              </td>
                              <td className="py-2 pr-4">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  record.success
                                    ? 'bg-[var(--dot-success)]/20 text-[var(--dot-success)]'
                                    : 'bg-[var(--dot-error)]/20 text-[var(--dot-error)]'
                                }`}>
                                  {record.success ? 'Succès' : 'Échec'}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-[var(--claude-text-muted)] truncate max-w-[200px]">
                                {record.missionId ? `Mission: ${record.missionId.slice(0, 20)}...` : record.conversationId ? `Conv: ${record.conversationId.slice(0, 20)}...` : record.agentId ? `Agent: ${record.agentId}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {usageStats.totalRequests === 0 && !showHistory && (
                  <div className="rounded-xl border border-[var(--claude-border)] bg-[var(--claude-surface-subtle)]/60 p-6 text-center">
                    <Gauge className="w-12 h-12 mx-auto mb-3 text-[var(--claude-text-muted)]" />
                    <h4 className="font-medium text-[var(--claude-text-primary)] mb-1">Aucune utilisation réelle</h4>
                    <p className="text-[12px] text-[var(--claude-text-muted)] mb-4">
                      Les statistiques apparaîtront ici après vos premiers appels réels aux modèles via FCC ou Gemini.
                    </p>
                    <div className="text-[11px] text-[var(--claude-text-muted)] space-y-1">
                      <p>• Configurez le Bridge FCC dans l'onglet « Bridge FCC »</p>
                      <p>• Ou utilisez l'API Gemini (clé requise côté serveur)</p>
                      <p>• Lancez une mission dans Dot Brain ou une session Code</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NOTIFICATIONS / CUSTOMIZE / CODE TABS */}
            {activeTab === 'notifications' && (
              <div className="mt-4 rounded-xl border border-[var(--claude-border)] bg-[var(--claude-bg)] divide-y divide-[var(--claude-border)]">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">Notification de fin de tâche</div>
                    <div className="text-[12px] text-[var(--claude-text-muted)]">
                      Prévenir lorsqu'une génération longue ou une approbation attend votre réponse.
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
                      Émettre un signal subtil lors d'une demande de validation.
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
                Cette interface reproduit l'expérience visuelle de <strong>Claude Desktop (Code &amp; Chat)</strong> exclusivement côté navigateur. Elle ne lit aucun fichier de votre disque, n'exécute aucune commande système réelle et n'accède ni à vos Skills ni à vos serveurs MCP locaux.
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
                  (<strong>gemini-4-hydrogen</strong>). L'interface n'accède ni à votre disque local, ni à vos Skills, ni à vos serveurs MCP. L'adaptateur{' '}
                  <code className="font-claude-mono text-[var(--claude-inline-code-text)]">
                    ClaudeTransportAdapter
                  </code>{' '}
                  reste prêt pour relier ultérieurement votre bridge FCC Claude.
                </div>

                <div className="space-y-2">
                  <label className="block text-[12px] font-medium text-[var(--claude-text-secondary)]">
                    Presets d'endpoint FCC Claude
                  </label>
                  <select
                    value={endpointDraft}
                    onChange={(e) => setEndpointDraft(e.target.value)}
                    className="rounded-lg border border-[var(--claude-border)] bg-[var(--claude-bg)] px-3 py-1.5 font-claude-mono text-[12.5px]"
                  >
                    {FCC_ENDPOINT_PRESETS.map((p) => (
                      <option key={p.url} value={p.url}>
                        {p.label} — {p.description}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[var(--claude-text-muted)]">
                    Sélectionnez un preset ou choisissez « Personnalisé » pour saisir votre URL.
                  </p>

                  <label className="block text-[12px] font-medium text-[var(--claude-text-secondary)]">
                    URL de l'endpoint FCC (SSE)
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
                      {probeState === 'testing' ? 'Test en cours...' : 'Tester l\'endpoint'}
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

                <div className="flex items-center gap-2 pt-2 border-t border-[var(--claude-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      const defaultEndpoint = 'http://localhost:8787/v1/claude/stream';
                      setEndpointDraft(defaultEndpoint);
                      onUpdatePreferences({
                        ...preferences,
                        fcc: {
                          ...preferences.fcc,
                          mode: 'fcc',
                          endpointUrl: defaultEndpoint,
                          workspaceLabel: '',
                          sendWithCredentials: false,
                        },
                      });
                      setSavedNotice(true);
                      setTimeout(() => setSavedNotice(false), 1800);
                    }}
                    className="rounded-lg border border-[var(--claude-border-strong)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--claude-surface-subtle)]"
                  >
                    Réinitialiser au défaut (localhost:8787)
                  </button>
                  <span className="text-[11px] text-[var(--claude-text-muted)]">
                    Mode: Bridge FCC · Endpoint: http://localhost:8787/v1/claude/stream
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-[var(--claude-border)] bg-[var(--claude-code-bg)]">
                  <div className="flex items-center justify-between border-b border-[var(--claude-border)] px-3 py-1.5 text-[11.5px] text-[var(--claude-text-muted)]">
                    <span>Contrat SSE attendu par l'interface</span>
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
