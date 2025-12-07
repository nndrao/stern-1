/**
 * IconPickerDialog
 *
 * A dialog for selecting Lucide icons for toolbar buttons.
 * Shows common icons organized in a grid with search functionality.
 */

import React, { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';

// ============================================================================
// Common Icons List
// ============================================================================

/**
 * Common icons suitable for toolbar buttons
 * Organized by typical use case
 */
const COMMON_ICONS = [
  // Actions
  'Plus', 'Minus', 'X', 'Check', 'RefreshCw', 'RotateCcw', 'RotateCw',
  'Save', 'Download', 'Upload', 'Trash2', 'Edit', 'Edit2', 'Edit3',
  'Copy', 'Clipboard', 'ClipboardCopy', 'ClipboardCheck',
  'Send', 'Share', 'Share2', 'Forward', 'Reply',

  // Navigation
  'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight',
  'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight',
  'ChevronsDown', 'ChevronsUp', 'ChevronsLeft', 'ChevronsRight',
  'ExternalLink', 'Link', 'Link2',

  // View/Display
  'Eye', 'EyeOff', 'Search', 'ZoomIn', 'ZoomOut',
  'Maximize', 'Minimize', 'Maximize2', 'Minimize2',
  'Expand', 'Shrink', 'FullScreen', 'PanelLeft', 'PanelRight',
  'SidebarOpen', 'SidebarClose', 'Columns', 'Rows', 'Grid', 'List',

  // Data/Files
  'File', 'FileText', 'FilePlus', 'FileMinus', 'FileCheck',
  'Folder', 'FolderOpen', 'FolderPlus', 'FolderMinus',
  'Database', 'Server', 'HardDrive', 'Cloud', 'CloudDownload', 'CloudUpload',
  'Table', 'Table2', 'Sheet', 'FileSpreadsheet',

  // Filtering/Sorting
  'Filter', 'FilterX', 'SlidersHorizontal', 'Sliders',
  'ArrowUpDown', 'ArrowDownUp', 'SortAsc', 'SortDesc',
  'ListFilter', 'ListOrdered', 'ListChecks',

  // Status/Indicators
  'CheckCircle', 'CheckCircle2', 'XCircle', 'AlertCircle', 'AlertTriangle',
  'Info', 'HelpCircle', 'Bell', 'BellOff', 'BellRing',
  'Circle', 'CircleDot', 'Loader', 'Loader2',

  // Time/Calendar
  'Clock', 'Timer', 'TimerOff', 'History',
  'Calendar', 'CalendarDays', 'CalendarRange', 'CalendarClock',

  // Communication
  'Mail', 'MailOpen', 'MessageSquare', 'MessageCircle',
  'Phone', 'PhoneCall', 'PhoneOff',

  // Settings/Tools
  'Settings', 'Settings2', 'Cog', 'Wrench', 'Tool',
  'Hammer', 'Screwdriver', 'Puzzle',

  // Finance/Business
  'DollarSign', 'Euro', 'Pound', 'Coins',
  'CreditCard', 'Wallet', 'Banknote',
  'TrendingUp', 'TrendingDown', 'Activity', 'BarChart', 'BarChart2',
  'PieChart', 'LineChart', 'AreaChart',
  'Calculator', 'Percent', 'Receipt',

  // Selection
  'CheckSquare', 'CheckSquare2', 'Square', 'SquareCheck',
  'CircleCheck', 'CircleX', 'MinusSquare', 'PlusSquare',

  // Security
  'Lock', 'Unlock', 'Key', 'KeyRound', 'Shield', 'ShieldCheck', 'ShieldX',

  // Users
  'User', 'UserPlus', 'UserMinus', 'UserCheck', 'UserX',
  'Users', 'Users2', 'UserCircle', 'UserSquare',

  // Misc
  'Star', 'StarOff', 'Heart', 'HeartOff',
  'Bookmark', 'BookmarkPlus', 'BookmarkMinus',
  'Flag', 'FlagOff', 'Tag', 'Tags',
  'Pin', 'PinOff', 'MapPin',
  'Printer', 'QrCode', 'Barcode',
  'Power', 'PowerOff', 'Zap', 'ZapOff',
  'Play', 'Pause', 'Stop', 'SkipForward', 'SkipBack',
  'Volume', 'Volume1', 'Volume2', 'VolumeX',
  'Sun', 'Moon', 'Lightbulb', 'LightbulbOff',
  'Image', 'ImagePlus', 'ImageMinus',
  'Paperclip', 'Attachment',
  'Package', 'Box', 'Archive', 'ArchiveRestore',
  'Layers', 'Layers2', 'Layers3',
  'Move', 'MoveHorizontal', 'MoveVertical', 'GripVertical', 'GripHorizontal',
  'MoreHorizontal', 'MoreVertical', 'Menu',
];

// ============================================================================
// Props
// ============================================================================

export interface IconPickerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Currently selected icon name */
  currentIcon?: string;
  /** Callback when an icon is selected */
  onSelect: (iconName: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export const IconPickerDialog: React.FC<IconPickerDialogProps> = ({
  open,
  onClose,
  currentIcon,
  onSelect,
}) => {
  const [search, setSearch] = useState('');

  // Filter icons by search query
  const filteredIcons = useMemo(() => {
    if (!search.trim()) return COMMON_ICONS;
    const query = search.toLowerCase();
    return COMMON_ICONS.filter((name) =>
      name.toLowerCase().includes(query)
    );
  }, [search]);

  // Handle icon selection
  const handleSelect = (iconName: string) => {
    onSelect(iconName);
    onClose();
  };

  // Clear icon selection
  const handleClear = () => {
    onSelect('');
    onClose();
  };

  // Reset search when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSearch('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Icon</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Current Selection */}
        {currentIcon && (
          <div className="flex items-center justify-between p-2 bg-muted rounded-md">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current:</span>
              {(() => {
                const Icon = (LucideIcons as any)[currentIcon];
                return Icon ? <Icon className="h-5 w-5" /> : null;
              })()}
              <span className="text-sm font-medium">{currentIcon}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
        )}

        {/* Icons Grid */}
        <ScrollArea className="h-[300px]">
          {filteredIcons.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No icons match "{search}"
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-1 p-2">
              {filteredIcons.map((iconName) => {
                const Icon = (LucideIcons as any)[iconName];
                if (!Icon) return null;

                const isSelected = currentIcon === iconName;

                return (
                  <button
                    key={iconName}
                    onClick={() => handleSelect(iconName)}
                    className={`
                      p-2.5 rounded-lg border flex items-center justify-center
                      transition-colors hover:bg-accent hover:border-primary
                      ${isSelected ? 'bg-accent border-primary ring-2 ring-primary ring-offset-1' : 'border-transparent'}
                    `}
                    title={iconName}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer with count */}
        <div className="text-xs text-muted-foreground text-center">
          {filteredIcons.length} icons
          {search && ` matching "${search}"`}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Icon Resolver Utility
// ============================================================================

/**
 * Resolve an icon name to a Lucide React component
 */
export function resolveIcon(
  iconName?: string
): React.ComponentType<{ className?: string }> | null {
  if (!iconName) return null;
  const Icon = (LucideIcons as any)[iconName];
  return Icon || null;
}

/**
 * Check if an icon name is valid
 */
export function isValidIcon(iconName: string): boolean {
  return iconName in LucideIcons;
}

export default IconPickerDialog;
