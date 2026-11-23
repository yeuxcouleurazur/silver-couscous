import React, { useState } from 'react';
import {
  Crosshair,
  Eye,
  EyeOff,
  Filter,
  Minus,
  Moon,
  Orbit,
  PanelLeftOpen,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
} from 'lucide-react';
import type {
  AgentStatus,
  Group,
  GroupId,
  NetworkFilters,
} from '../types/dotBrain';
import { AGENT_STATUS_ORDER, getStatusVisual } from '../constants/dotVisuals';
import type { CameraPreset } from './DotNetwork';

interface NetworkControlsProps {
  groups: Group[];
  filters: NetworkFilters;
  showGroups: boolean;
  zoomScale: number;
  isSimulationRunning: boolean;
  isDemoMode: boolean;
  is3DMode: boolean;
  autoRotate360: boolean;
  isDark: boolean;
  leftPanelOpen: boolean;
  runningAgentsCount: number;
  matchedCount: number;
  totalCount: number;
  inspectorOpen: boolean;
  onFilterChange: (next: NetworkFilters) => void;
  onResetFilters: () => void;
  onToggleGroups: () => void;
  onToggleAutoRotate360: () => void;
  onToggleTheme: () => void;
  onToggleLeftPanel: () => void;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onReorganize: () => void;
  onToggleSimulation?: () => void;
}

export function NetworkControls({
  groups,
  filters,
  showGroups,
  zoomScale,
  isSimulationRunning,
  isDemoMode,
  is3DMode,
  autoRotate360,
  isDark,
  leftPanelOpen,
  runningAgentsCount,
  matchedCount,
  totalCount,
  inspectorOpen,
  onFilterChange,
  onResetFilters,
  onToggleGroups,
  onToggleAutoRotate360,
  onToggleTheme,
  onToggleLeftPanel,
  onSelectCameraPreset,
  onZoomIn,
  onZoomOut,
  onRecenter,
  onReorganize,
  onToggleSimulation,
}: NetworkControlsProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const hasActiveFilter =
    filters.groupId !== 'all' ||
    filters.status !== 'all' ||
    filters.isolatedAgentId !== null;

  return (
    <>
      {/* Barre de filtres et d'affichage (coin supérieur gauche du graphe) */}
      <div
        className={`pointer-events-none absolute top-3 z-20 flex flex-col items-start gap-2 transition-[left] duration-200 sm:top-4 ${
          leftPanelOpen ? 'left-3 lg:left-[328px]' : 'left-3 sm:left-5'
        }`}
      >
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-[#DFDDD5] bg-[#FFFFFF]/94 p-1 shadow-xs backdrop-blur-sm dark:border-[#42423D] dark:bg-[#30302E]/94 dark:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)]">
          {!leftPanelOpen && (
            <>
              <button
                type="button"
                data-testid="open-running-panel-btn"
                onClick={onToggleLeftPanel}
                aria-label="Ouvrir le panneau des agents en exécution"
                title="Afficher les agents en exécution"
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#1C1B19] transition-colors hover:bg-[#EFECE5] dark:text-[#ECEAE4] dark:hover:bg-[#3C3C38] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PanelLeftOpen className="h-3.5 w-3.5 text-[#D97757]" />
                <span>Actifs</span>
                <span className="font-mono tabular-nums text-[11px] text-[#6A6760] dark:text-[#A4A198]">
                  ({runningAgentsCount})
                </span>
              </button>
              <span
                className="mx-0.5 h-4 w-px bg-[#DFDDD5] dark:bg-[#44443F]"
                aria-hidden="true"
              />
            </>
          )}
          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            aria-expanded={filtersExpanded}
            aria-controls="dot-network-filter-panel"
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              hasActiveFilter
                ? 'bg-[#262522] text-[#FAF9F5] dark:bg-[#D97757] dark:text-[#FAF9F5]'
                : filtersExpanded
                  ? 'bg-[#EFECE5] text-[#1C1B19] dark:bg-[#3E3E39] dark:text-[#ECEAE4]'
                  : 'text-[#4E4C46] hover:bg-[#EFECE5] hover:text-[#1C1B19] dark:text-[#C2BFB6] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4]'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filtres</span>
            {hasActiveFilter && (
              <span className="font-mono tabular-nums text-[11px] opacity-90">
                ({matchedCount}/{totalCount})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleGroups}
            aria-pressed={showGroups}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] dark:text-[#C2BFB6] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {showGroups ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {showGroups ? 'Régions' : 'Régions masquées'}
            </span>
          </button>

          {is3DMode && (
            <button
              type="button"
              onClick={onToggleAutoRotate360}
              aria-pressed={autoRotate360}
              title={
                autoRotate360
                  ? 'Mettre en pause la rotation 360° automatique'
                  : 'Activer la rotation 360° automatique'
              }
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                autoRotate360
                  ? 'bg-[#EFECE5] text-[#1C1B19] dark:bg-[#3E3E39] dark:text-[#ECEAE4]'
                  : 'text-[#4E4C46] hover:bg-[#EFECE5] hover:text-[#1C1B19] dark:text-[#C2BFB6] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4]'
              }`}
            >
              <Orbit className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">360°</span>
            </button>
          )}

          {isDemoMode && onToggleSimulation && (
            <button
              type="button"
              onClick={onToggleSimulation}
              aria-pressed={isSimulationRunning}
              title={
                isSimulationRunning
                  ? 'Mettre en pause la démonstration animée'
                  : 'Reprendre la démonstration animée'
              }
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] dark:text-[#C2BFB6] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSimulationRunning ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              <span className="hidden md:inline">
                {isSimulationRunning ? 'Démo active' : 'Démo en pause'}
              </span>
            </button>
          )}

          <span
            className="mx-0.5 h-4 w-px bg-[#DFDDD5] dark:bg-[#44443F]"
            aria-hidden="true"
          />

          <button
            type="button"
            data-testid="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-pressed={isDark}
            aria-label={
              isDark
                ? 'Passer au thème clair Claude'
                : 'Passer au thème sombre Claude'
            }
            title={
              isDark ? 'Passer en thème clair' : 'Passer en thème sombre'
            }
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] dark:text-[#C2BFB6] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5 text-[#DE8857]" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {isDark ? 'Clair' : 'Sombre'}
            </span>
          </button>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="Réinitialiser tous les filtres"
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[#815124] transition-colors hover:bg-[#EFECE5] dark:text-[#DE8857] dark:hover:bg-[#3C3C38] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Réinitialiser</span>
            </button>
          )}
        </div>

        {/* Panneau de filtrage dépliable (Spécialité & État) */}
        {filtersExpanded && (
          <div
            id="dot-network-filter-panel"
            className="pointer-events-auto w-[272px] rounded-xl border border-[#DFDDD5] bg-[#FFFFFF]/98 p-3.5 shadow-[0_12px_32px_-16px_rgba(28,27,25,0.16)] backdrop-blur-md space-y-3.5 dark:border-[#42423D] dark:bg-[#30302E]/98 dark:shadow-[0_16px_38px_-14px_rgba(0,0,0,0.58)]"
          >
            <div>
              <label
                htmlFor="filter-group-select"
                className="block text-[11.5px] font-medium text-[#6A6760] dark:text-[#A4A198]"
              >
                Spécialité / Région
              </label>
              <select
                id="filter-group-select"
                value={filters.groupId}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    groupId: e.target.value as GroupId | 'all',
                  })
                }
                className="mt-1.5 block w-full rounded-lg border border-[#DFDDD5] bg-[#FAF9F5] px-2.5 py-1.5 text-xs text-[#1C1B19] focus:border-[#8E8A80] focus:outline-none dark:border-[#44443F] dark:bg-[#262624] dark:text-[#ECEAE4] dark:focus:border-[#6B6B64] cursor-pointer"
              >
                <option
                  value="all"
                  className="bg-[#FFFFFF] text-[#1C1B19] dark:bg-[#30302E] dark:text-[#ECEAE4]"
                >
                  Tous les groupes (8)
                </option>
                {groups.map((g) => (
                  <option
                    key={g.id}
                    value={g.id}
                    className="bg-[#FFFFFF] text-[#1C1B19] dark:bg-[#30302E] dark:text-[#ECEAE4]"
                  >
                    {g.name} ({g.agentIds.length})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-[11.5px] font-medium text-[#6A6760] dark:text-[#A4A198]">
                État cognitif
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filters, status: 'all' })}
                  className={`rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors cursor-pointer ${
                    filters.status === 'all'
                      ? 'bg-[#262522] text-[#FAF9F5] dark:bg-[#D97757] dark:text-[#FAF9F5]'
                      : 'bg-[#F0EFEA] text-[#5A5852] hover:bg-[#E5E3DC] hover:text-[#1C1B19] dark:bg-[#262624] dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4]'
                  }`}
                >
                  Tous
                </button>
                {AGENT_STATUS_ORDER.map((status: AgentStatus) => {
                  const visual = getStatusVisual(status, isDark);
                  const active = filters.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        onFilterChange({
                          ...filters,
                          status: active ? 'all' : status,
                        })
                      }
                      className={`rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#262522] text-[#FAF9F5] dark:bg-[#D97757] dark:text-[#FAF9F5]'
                          : 'bg-[#F0EFEA] text-[#5A5852] hover:bg-[#E5E3DC] hover:text-[#1C1B19] dark:bg-[#262624] dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4]'
                      }`}
                    >
                      <span
                        className="mr-1"
                        style={{
                          color: active
                            ? '#FAF9F5'
                            : isDark
                              ? visual.fill
                              : visual.stroke,
                        }}
                      >
                        {visual.glyph}
                      </span>
                      {visual.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contrôles caméra 360° & zoom (bord droit discret, décalé si inspecteur ouvert) */}
      <div
        className={`pointer-events-auto absolute top-3 z-20 flex-col items-center gap-1 rounded-xl border border-[#DFDDD5] bg-[#FFFFFF]/94 p-1 shadow-xs backdrop-blur-sm transition-all duration-200 dark:border-[#42423D] dark:bg-[#30302E]/94 dark:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.55)] sm:top-4 ${
          inspectorOpen ? 'hidden lg:flex right-[376px]' : 'flex right-3 sm:right-5'
        }`}
        aria-label="Contrôles de navigation du réseau"
      >
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom avant"
          title="Zoom avant"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:text-[#C2BFB6] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] dark:focus-visible:outline-[#D97757] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>

        <span
          className="font-mono tabular-nums text-[10.5px] text-[#827F77] dark:text-[#96938A] select-none py-0.5"
          aria-label={`Niveau de zoom ${Math.round(zoomScale * 100)} pour cent`}
        >
          {Math.round(zoomScale * 100)}%
        </span>

        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom arrière"
          title="Zoom arrière"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:text-[#C2BFB6] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] dark:focus-visible:outline-[#D97757] cursor-pointer"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="my-0.5 h-px w-5 bg-[#DFDDD5] dark:bg-[#44443F]" aria-hidden="true" />

        <button
          type="button"
          onClick={onRecenter}
          aria-label="Recentrer le réseau"
          title="Recentrer (Profil)"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:text-[#C2BFB6] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] dark:focus-visible:outline-[#D97757] cursor-pointer"
        >
          <Crosshair className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onReorganize}
          aria-label="Réorganiser automatiquement les Dots"
          title="Réorganiser automatiquement"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4E4C46] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] focus-visible:outline-2 focus-visible:outline-[#1C1B19] dark:text-[#C2BFB6] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] dark:focus-visible:outline-[#D97757] cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        {is3DMode && (
          <>
            <div className="my-0.5 h-px w-5 bg-[#DFDDD5] dark:bg-[#44443F]" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onSelectCameraPreset('lateral')}
              aria-label="Angle profil"
              title="Vue profil"
              className="flex h-7 w-8 items-center justify-center rounded-md text-[10px] font-medium text-[#5A5852] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] cursor-pointer"
            >
              Prof.
            </button>
            <button
              type="button"
              onClick={() => onSelectCameraPreset('front')}
              aria-label="Angle face"
              title="Vue face"
              className="flex h-7 w-8 items-center justify-center rounded-md text-[10px] font-medium text-[#5A5852] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] cursor-pointer"
            >
              Face
            </button>
            <button
              type="button"
              onClick={() => onSelectCameraPreset('top')}
              aria-label="Angle dessus"
              title="Vue dessus (2 hémisphères)"
              className="flex h-7 w-8 items-center justify-center rounded-md text-[10px] font-medium text-[#5A5852] transition-colors hover:bg-[#EFECE5] hover:text-[#1C1B19] dark:text-[#B4B1A8] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] cursor-pointer"
            >
              Haut
            </button>
          </>
        )}
      </div>
    </>
  );
}
