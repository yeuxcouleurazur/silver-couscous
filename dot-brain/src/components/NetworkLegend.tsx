import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import {
  AGENT_STATUS_ORDER,
  getConnectionColor,
  getStatusVisual,
} from '../constants/dotVisuals';

interface NetworkLegendProps {
  isOpen: boolean;
  isDemoMode: boolean;
  isDark?: boolean;
  leftPanelOpen?: boolean;
  onClose: () => void;
}

export function NetworkLegend({
  isOpen,
  isDemoMode,
  isDark = false,
  leftPanelOpen = false,
  onClose,
}: NetworkLegendProps) {
  const activeFlowColor = getConnectionColor('delegation', isDark);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.section
          key="network-legend"
          aria-label="Légende du réseau Dot Brain"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className={`pointer-events-auto absolute bottom-[136px] z-20 w-[284px] rounded-xl border border-[#DFDDD5] bg-[#FFFFFF]/98 p-4 shadow-[0_12px_32px_-16px_rgba(28,27,25,0.16)] backdrop-blur-md transition-[left] duration-200 dark:border-[#42423D] dark:bg-[#30302E]/98 dark:shadow-[0_16px_38px_-14px_rgba(0,0,0,0.58)] sm:bottom-[124px] ${
            leftPanelOpen ? 'left-3 lg:left-[328px]' : 'left-3 sm:left-5'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-[#1C1B19] dark:text-[#ECEAE4]">
              Légende des états & flux
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la légende"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#827F77] transition-colors hover:bg-[#EAE8E1] hover:text-[#1C1B19] dark:text-[#96938A] dark:hover:bg-[#3C3C38] dark:hover:text-[#ECEAE4] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {AGENT_STATUS_ORDER.map((status) => {
              const v = getStatusVisual(status, isDark);
              const microDotColor = isDark ? '#1F1F1D' : '#FAF9F5';
              return (
                <li
                  key={status}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
                      {status === 'Thinking' && (
                        <circle cx="10" cy="10" r="8" fill="none" stroke={v.ringColor} strokeWidth="1" opacity="0.65" />
                      )}
                      {status === 'Working' && (
                        <circle cx="10" cy="10" r="8" fill="none" stroke={v.ringColor} strokeWidth="1.1" strokeDasharray="4 3" />
                      )}
                      {status === 'Communicating' && (
                        <circle cx="10" cy="10" r="8" fill="none" stroke={v.ringColor} strokeWidth="1" opacity="0.75" />
                      )}
                      {status === 'Reviewing' && (
                        <circle cx="10" cy="10" r="8" fill="none" stroke={v.ringColor} strokeWidth="1" />
                      )}
                      {status === 'Error' && (
                        <circle cx="10" cy="10" r="8" fill="none" stroke={v.ringColor} strokeWidth="1.1" strokeDasharray="2 2" />
                      )}
                      <circle cx="10" cy="10" r="5" fill={v.fill} stroke={v.stroke} strokeWidth="0.9" />
                      {status === 'Completed' && <circle cx="10" cy="10" r="1.5" fill={microDotColor} />}
                      {status === 'Error' && (
                        <path d="M 8.2 8.2 L 11.8 11.8 M 11.8 8.2 L 8.2 11.8" stroke={microDotColor} strokeWidth="1.1" strokeLinecap="round" />
                      )}
                    </svg>
                    <span className="font-medium text-[#1C1B19] dark:text-[#ECEAE4]">{v.label}</span>
                  </div>
                  <span className="text-[11px] text-[#6A6760] truncate dark:text-[#A4A198]">
                    {v.shortLabel}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-3.5 border-t border-[#EAE8E1] pt-3 space-y-2 text-[11.5px] text-[#5A5852] dark:border-[#3E3E39] dark:text-[#C2BFB6]">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden="true">
                  <line x1="1" y1="5" x2="25" y2="5" stroke={activeFlowColor} strokeWidth="1.35" />
                  <path d="M 11 2.5 L 15 5 L 11 7.5" fill="none" stroke={activeFlowColor} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="20" cy="5" r="2" fill={activeFlowColor} />
                </svg>
                Flux actif
              </span>
              <span className="text-[#827F77] dark:text-[#8E8B82]">Particule dirigée</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden="true">
                  <line x1="1" y1="5" x2="25" y2="5" stroke={isDark ? '#8E8B82' : '#827F77'} strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
                </svg>
                Fin de flux
              </span>
              <span className="text-[#827F77] dark:text-[#8E8B82]">Atténuation</span>
            </div>
          </div>

          {isDemoMode && (
            <p className="mt-3 border-t border-[#EAE8E1] pt-2.5 text-[11px] leading-relaxed text-[#7A776F] dark:border-[#3E3E39] dark:text-[#96938A]">
              Mode démonstration : les échanges affichés sont simulés localement afin d’illustrer la dynamique du réseau.
            </p>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
