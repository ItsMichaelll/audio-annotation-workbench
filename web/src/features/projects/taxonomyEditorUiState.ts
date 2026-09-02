import { removeEntry, reorderEntry } from '../../domain/taxonomyEditing'

export interface LabelUiState {
  ids: string[]
  expanded: Set<string>
}

export function toggleExpandedLabel(
  state: LabelUiState,
  uiId: string,
): LabelUiState {
  const expanded = new Set(state.expanded)
  if (expanded.has(uiId)) expanded.delete(uiId)
  else expanded.add(uiId)
  return { ...state, expanded }
}

export function addExpandedLabel(
  state: LabelUiState,
  uiId: string,
): LabelUiState {
  return {
    ids: [...state.ids, uiId],
    expanded: new Set(state.expanded).add(uiId),
  }
}

export function removeLabelUi(
  state: LabelUiState,
  index: number,
): LabelUiState {
  const uiId = state.ids[index]
  const expanded = new Set(state.expanded)
  if (uiId) expanded.delete(uiId)
  return { ids: removeEntry(state.ids, index), expanded }
}

export function reorderLabelUi(
  state: LabelUiState,
  fromIndex: number,
  toIndex: number,
): LabelUiState {
  return {
    ids: reorderEntry(state.ids, fromIndex, toIndex),
    expanded: new Set(state.expanded),
  }
}
