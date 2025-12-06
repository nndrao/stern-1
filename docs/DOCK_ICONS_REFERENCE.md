# Dock Menu Icons Reference

This document shows all the beautiful, colorful default icons available for dock menu items.

## Overview

The dock menu system automatically selects appropriate icons for menu items based on their caption text. Each icon category has both **light** and **dark** theme variants for optimal visibility.

## Icon System Features

- **17+ icon categories** with distinct colors for visual differentiation
- **Keyword-based matching** - analyzes menu item captions to select the best icon
- **Theme support** - automatic switching between light and dark variants
- **Smart fallbacks** - folder icons for submenus, default icon when no match found
- **Customizable** - users can override with custom icons via the dock configurator

## Available Icon Categories

### Trading & Market Data

| Icon | Category | Color | Keywords |
|------|----------|-------|----------|
| 📊 | **Blotter** | Blue (#3B82F6) | blotter, trades, orders, positions, executions, fills |
| 📈 | **Chart** | Green (#10B981) | chart, graph, analytics, analysis, market data, prices |
| 👁️ | **Watchlist** | Purple (#8B5CF6) | watchlist, watch list, symbols, quotes, tickers |

### Data & Reports

| Icon | Category | Color | Keywords |
|------|----------|-------|----------|
| 📄 | **Report** | Amber (#F59E0B) | report, reports, statement, summary, pnl, p&l |
| 🗄️ | **Data** | Indigo (#6366F1) | data, database, table, grid, list |
| 📱 | **Dashboard** | Pink (#EC4899) | dashboard, overview, home, main |

### Settings & Configuration

| Icon | Category | Color | Keywords |
|------|----------|-------|----------|
| ⚙️ | **Settings** | Slate (#64748B) | settings, config, configuration, preferences, options |
| 👤 | **User** | Teal (#14B8A6) | user, profile, account, admin |

### Tools & Utilities

| Icon | Category | Color | Keywords |
|------|----------|-------|----------|
| 🔧 | **Tools** | Orange (#F97316) | tools, utilities, developer, debug |
| 🧮 | **Calculator** | Lime (#84CC16) | calculator, calc, calculate, pricing |
| 📅 | **Calendar** | Red (#EF4444) | calendar, schedule, events, dates |

### Communication

| Icon | Category | Color | Keywords |
|------|----------|-------|----------|
| 🔔 | **Notification** | Rose (#F43F5E) | notification, notifications, alerts, messages |
| ✉️ | **Mail** | Blue (#3B82F6) | mail, email, message, inbox |

### Files & Documents

| Icon | Category | Color | Keywords |
|------|----------|-------|----------|
| 📃 | **Document** | Sky (#0EA5E9) | document, documents, files, file |
| 📁 | **Folder** | Yellow (#FBBF24) | folder, directory, workspace, project |

### Generic

| Icon | Category | Color | Keywords |
|------|----------|-------|----------|
| 🪟 | **Window** | Purple (#A855F7) | window, view, panel |
| 🎯 | **App** | Cyan (#06B6D4) | app, application, program |
| ⚪ | **Default** | Slate (#94A3B8) | (fallback for all unmatched items) |

## Icon Files

All icon SVG files are located in: `client/public/icons/`

### File Naming Convention

- Light theme: `{category}-light.svg`
- Dark theme: `{category}-dark.svg`

### Examples

```
/icons/blotter-light.svg
/icons/blotter-dark.svg
/icons/chart-light.svg
/icons/chart-dark.svg
/icons/folder-light.svg
/icons/folder-dark.svg
/icons/default-light.svg
/icons/default-dark.svg
```

## How Icon Selection Works

### 1. Custom Icon Priority
If a menu item has a custom icon specified via the dock configurator, it will always be used:

```typescript
menuItem.icon = "/my-custom-icon.svg" // This takes precedence
```

### 2. Keyword Matching
If no custom icon is specified, the system analyzes the menu item caption:

```typescript
// Example menu items and their auto-selected icons
"Equity Blotter" → blotter icon (matches keyword "blotter")
"Market Charts" → chart icon (matches keyword "chart")
"User Settings" → settings icon (matches keyword "settings")
"P&L Report" → report icon (matches keyword "p&l")
```

### 3. Submenu Detection
Items with children automatically get folder icons:

```typescript
{
  caption: "Reports",
  children: [...] // Automatically gets folder icon
}
```

### 4. Default Fallback
Items that don't match any keywords get the default icon:

```typescript
"XYZ Component" → default icon (no keyword match)
```

## Implementation Details

### Icon Selection Function

Located in: `client/src/utils/dock/defaultIcons.ts`

```typescript
export function getDefaultMenuIcon(
  menuItem: DockMenuItem,
  theme: 'light' | 'dark' = 'light',
  level: number = 0
): string {
  // 1. Custom icon if specified
  if (menuItem.icon) {
    return buildUrl(menuItem.icon);
  }

  // 2. Keyword matching
  const caption = menuItem.caption.toLowerCase();
  for (const category of ICON_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (caption.includes(keyword)) {
        return buildUrl(`/icons/${category.baseName}-${theme}.svg`);
      }
    }
  }

  // 3. Folder icon for submenus
  if (menuItem.children && menuItem.children.length > 0) {
    return buildUrl(`/icons/folder-${theme}.svg`);
  }

  // 4. Default fallback
  return buildUrl(`/icons/default-${theme}.svg`);
}
```

### Usage in Dock Rendering

Located in: `client/src/openfin/platform/openfinDock.ts`

```typescript
function convertToDropdownOptions(menuItems: DockMenuItem[], level: number = 0): any[] {
  return menuItems.map((item) => {
    // Smart icon selection
    const iconUrl = item.icon
      ? buildUrl(item.icon)
      : getDefaultMenuIcon(item, currentTheme, level);

    return {
      tooltip: item.caption,
      iconUrl,
      // ... other properties
    };
  });
}
```

## Adding New Icon Categories

To add a new icon category:

1. **Create SVG files**:
   - `client/public/icons/{name}-light.svg`
   - `client/public/icons/{name}-dark.svg`

2. **Add to ICON_CATEGORIES** in `client/src/utils/dock/defaultIcons.ts`:

```typescript
{
  baseName: 'your-category',
  keywords: ['keyword1', 'keyword2', 'keyword3'],
  color: '#HEX_COLOR' // Choose from Tailwind color palette
}
```

3. **Rebuild** the application:

```bash
cd client
npm run build
```

## Icon Design Guidelines

### Style Consistency

All icons follow these design principles:

- **Size**: 24x24px viewBox
- **Stroke width**: 2px for primary elements
- **Fill opacity**: 0.1-0.2 for light theme, 0.2-0.3 for dark theme
- **Color scheme**: Based on Tailwind CSS color palette
- **Visual weight**: Balanced and not too detailed

### Light vs Dark Themes

- **Light theme**: Darker, more saturated colors for contrast on light backgrounds
- **Dark theme**: Lighter, slightly desaturated colors for contrast on dark backgrounds

### Example SVG Structure

```xml
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background shape with low opacity fill -->
  <rect x="3" y="3" width="18" height="18" rx="2"
        stroke="#3B82F6" stroke-width="2"
        fill="#3B82F6" fill-opacity="0.1"/>

  <!-- Foreground elements with solid stroke -->
  <line x1="3" y1="8" x2="21" y2="8"
        stroke="#3B82F6" stroke-width="2"/>
</svg>
```

## Testing Icons

To test the icon system:

1. **Create a dock configuration** with menu items
2. **Use various captions** that match different keywords
3. **Verify** that appropriate icons are automatically selected
4. **Test theme switching** to see both light and dark variants
5. **Check submenus** to ensure they get folder icons
6. **Test custom icons** to ensure they override defaults

## Related Documentation

- [Phase 3 Architecture Refinement](./PHASE3_ARCHITECTURE_REFINEMENT.md) - Overall architecture improvements
- [OpenFin Dock Provider](../client/src/openfin/platform/openfinDock.ts) - Dock implementation
- [Default Icons Utility](../client/src/utils/dock/defaultIcons.ts) - Icon selection logic

## Color Reference

All colors are from the Tailwind CSS palette for consistency:

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Blue | #3B82F6 | Blotter, Mail |
| Green | #10B981 | Chart |
| Purple | #8B5CF6 | Watchlist |
| Amber | #F59E0B | Report |
| Indigo | #6366F1 | Data |
| Pink | #EC4899 | Dashboard |
| Slate | #64748B | Settings |
| Teal | #14B8A6 | User |
| Orange | #F97316 | Tools |
| Lime | #84CC16 | Calculator |
| Red | #EF4444 | Calendar |
| Rose | #F43F5E | Notification |
| Sky | #0EA5E9 | Document |
| Yellow | #FBBF24 | Folder |
| Cyan | #06B6D4 | App |

---

**Last Updated**: December 5, 2025
**Status**: ✅ Complete
**Build Status**: ✅ No errors
