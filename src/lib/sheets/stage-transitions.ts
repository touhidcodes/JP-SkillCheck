/**
 * Stage Transition Validation
 *
 * Defines allowed stage transitions to prevent invalid jumps
 * (e.g., learning → hired directly, or placed → learning).
 *
 * Rules:
 * - learning → applying (must complete learning first)
 * - applying → interviewing (got interview call)
 * - applying → learning (fallback, e.g., not ready)
 * - interviewing → offer_pending (got offer)
 * - interviewing → applying (rejected, back to applying)
 * - offer_pending → placed (accepted offer)
 * - offer_pending → interviewing (negotiating/declined, back to interviewing)
 * - placed → hired (confirmed employment)
 * - hired → (terminal, no transitions out)
 */

import type { StudentStage } from '@/types';

export const ALLOWED_TRANSITIONS: Record<StudentStage, StudentStage[]> = {
  learning: ['applying'],
  applying: ['learning', 'interviewing'],
  interviewing: ['applying', 'offer_pending'],
  offer_pending: ['interviewing', 'placed'],
  placed: ['hired'],
  hired: [],
};

export function isValidStageTransition(from: StudentStage, to: StudentStage): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(from: StudentStage): StudentStage[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

export function getTransitionErrorMessage(from: StudentStage, to: StudentStage): string {
  const allowed = getAllowedTransitions(from);
  if (allowed.length === 0) {
    return `Students in "${from.replace('_', ' ')}" stage cannot be moved — this is a terminal stage`;
  }
  return `Cannot move from "${from.replace('_', ' ')}" to "${to.replace('_', ' ')}". Allowed transitions: ${allowed.map(s => s.replace('_', ' ')).join(', ')}`;
}
