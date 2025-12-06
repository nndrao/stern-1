/**
 * Default Icon Mapping for Dock Menu Items
 *
 * Provides beautiful, colorful default icons for menu items that don't
 * have custom icons specified via the dock configurator.
 *
 * Icons are selected based on:
 * - Menu item caption keywords
 * - Application type hints
 * - Position in menu hierarchy
 *
 * Each icon category has both light and dark theme variants for
 * optimal visibility.
 */

import { buildUrl } from '@stern/openfin-platform';
import { DockMenuItem } from '@stern/openfin-platform';

// ============================================================================
// Icon Categories with Keywords
// ============================================================================

interface IconCategory {
  /** Icon base name (e.g., 'blotter', 'chart', 'settings') */
  baseName: string;
  /** Keywords to match in menu item caption (case-insensitive) */
  keywords: string[];
  /** Icon color for visual distinction */
  color: string;
}

/**
 * Icon categories with associated keywords and colors
 * Ordered by priority (more specific matches first)
 */
const ICON_CATEGORIES: IconCategory[] = [
  // Trading & Market Data
  {
    baseName: 'blotter',
    keywords: ['blotter', 'trades', 'orders', 'positions', 'executions', 'fills'],
    color: '#3B82F6' // Blue
  },
  {
    baseName: 'chart',
    keywords: ['chart', 'graph', 'analytics', 'analysis', 'market data', 'prices'],
    color: '#10B981' // Green
  },
  {
    baseName: 'watchlist',
    keywords: ['watchlist', 'watch list', 'symbols', 'quotes', 'tickers'],
    color: '#8B5CF6' // Purple
  },

  // Data & Reports
  {
    baseName: 'report',
    keywords: ['report', 'reports', 'statement', 'summary', 'pnl', 'p&l'],
    color: '#F59E0B' // Amber
  },
  {
    baseName: 'data',
    keywords: ['data', 'database', 'table', 'grid', 'list'],
    color: '#6366F1' // Indigo
  },
  {
    baseName: 'dashboard',
    keywords: ['dashboard', 'overview', 'home', 'main'],
    color: '#EC4899' // Pink
  },

  // Settings & Configuration
  {
    baseName: 'settings',
    keywords: ['settings', 'config', 'configuration', 'preferences', 'options'],
    color: '#64748B' // Slate
  },
  {
    baseName: 'user',
    keywords: ['user', 'profile', 'account', 'admin'],
    color: '#14B8A6' // Teal
  },

  // Tools & Utilities
  {
    baseName: 'tools',
    keywords: ['tools', 'utilities', 'developer', 'debug'],
    color: '#F97316' // Orange
  },
  {
    baseName: 'calculator',
    keywords: ['calculator', 'calc', 'calculate', 'pricing'],
    color: '#84CC16' // Lime
  },
  {
    baseName: 'calendar',
    keywords: ['calendar', 'schedule', 'events', 'dates'],
    color: '#EF4444' // Red
  },

  // Communication
  {
    baseName: 'notification',
    keywords: ['notification', 'notifications', 'alerts', 'messages'],
    color: '#F43F5E' // Rose
  },
  {
    baseName: 'mail',
    keywords: ['mail', 'email', 'message', 'inbox'],
    color: '#3B82F6' // Blue
  },

  // Files & Documents
  {
    baseName: 'document',
    keywords: ['document', 'documents', 'files', 'file'],
    color: '#0EA5E9' // Sky
  },
  {
    baseName: 'folder',
    keywords: ['folder', 'directory', 'workspace', 'project'],
    color: '#FBBF24' // Yellow
  },

  // Generic Fallbacks
  {
    baseName: 'window',
    keywords: ['window', 'view', 'panel'],
    color: '#A855F7' // Purple
  },
  {
    baseName: 'app',
    keywords: ['app', 'application', 'program'],
    color: '#06B6D4' // Cyan
  }
];

/**
 * Default icon to use when no category matches
 */
const DEFAULT_ICON: IconCategory = {
  baseName: 'default',
  keywords: [],
  color: '#94A3B8' // Slate
};

// ============================================================================
// Icon Selection Logic
// ============================================================================

/**
 * Get the appropriate default icon for a menu item
 *
 * Analyzes the menu item caption and properties to select the most
 * appropriate icon from the category list.
 *
 * @param menuItem - The menu item to get an icon for
 * @param theme - Current theme (light or dark)
 * @param level - Nesting level (0 = top level, 1+ = submenu)
 * @returns Icon URL with theme suffix
 */
export function getDefaultMenuIcon(
  menuItem: DockMenuItem,
  theme: 'light' | 'dark' = 'light',
  level: number = 0
): string {
  // If item already has an icon, use it
  if (menuItem.icon) {
    return buildUrl(menuItem.icon);
  }

  // Analyze caption for keywords
  const caption = menuItem.caption.toLowerCase();

  // Try to find matching category
  for (const category of ICON_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (caption.includes(keyword)) {
        return buildUrl(`/icons/${category.baseName}-${theme}.svg`);
      }
    }
  }

  // Special case: submenu folders get folder icon
  if (menuItem.children && menuItem.children.length > 0) {
    return buildUrl(`/icons/folder-${theme}.svg`);
  }

  // Fallback to default icon
  return buildUrl(`/icons/${DEFAULT_ICON.baseName}-${theme}.svg`);
}

/**
 * Get icon color for a menu item (useful for custom rendering)
 *
 * @param menuItem - The menu item
 * @returns Hex color code
 */
export function getMenuIconColor(menuItem: DockMenuItem): string {
  const caption = menuItem.caption.toLowerCase();

  for (const category of ICON_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (caption.includes(keyword)) {
        return category.color;
      }
    }
  }

  return DEFAULT_ICON.color;
}

/**
 * Get all icon categories (useful for documentation/preview)
 *
 * @returns Array of all icon categories with metadata
 */
export function getAllIconCategories(): IconCategory[] {
  return [...ICON_CATEGORIES, DEFAULT_ICON];
}

/**
 * Pre-generate icons for common combinations
 * This can be used to verify all icons exist
 *
 * @param theme - Theme to generate for
 * @returns Array of icon URLs
 */
export function getAllIconUrls(theme: 'light' | 'dark' = 'light'): string[] {
  return [...ICON_CATEGORIES, DEFAULT_ICON].map(
    category => buildUrl(`/icons/${category.baseName}-${theme}.svg`)
  );
}
