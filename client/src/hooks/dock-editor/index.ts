/**
 * Dock Editor Hooks
 *
 * Re-exports all dock editor hooks from the context for convenient importing
 */

export {
  // Provider
  DockEditorProvider,

  // Core hooks
  useDockEditorState,
  useDockEditorDispatch,

  // Selector hooks
  useSelectedItem,
  useItem,
  useItemChildrenIds,
  useItemChildren,
  useItemParentId,
  useIsSelected,
  useIsExpanded,
  useIsDirty,
  useConfigMetadata,
  useDockConfiguration,
  useAllItems,
  useItemCount,

  // Utilities
  denormalizeConfig,
  normalizeState,
  dockEditorReducer
} from '@/contexts/DockEditorContext';

export type {
  DockEditorState,
  DockEditorAction,
  DockEditorProviderProps
} from '@/contexts/DockEditorContext';
