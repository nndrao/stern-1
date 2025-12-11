/**
 * Registry Module
 *
 * Exports all registry-related functionality for toolbar actions
 */

export {
  actionRegistry,
  createActionContext,
  type ActionContext,
  type ActionHandler,
  type ActionAvailabilityCheck,
  type RegisteredAction,
  type RegisterActionOptions,
} from './actionRegistry';

export {
  registerBuiltInActions,
  getBuiltInActionIds,
} from './builtInActions';
