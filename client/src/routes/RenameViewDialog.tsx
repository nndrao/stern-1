import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logger } from '@/utils/logger';

/**
 * Standalone Rename View Dialog
 *
 * This component is loaded as an OpenFin popup window using fin.me.showPopupWindow().
 * It communicates results back to the caller via fin.me.dispatchPopupResult().
 * Query parameters are used to pass the current view name to the dialog.
 */
export default function RenameViewDialogPage() {
  const [newName, setNewName] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Get the current name from query parameters
    const params = new URLSearchParams(window.location.search);
    const name = params.get('currentName') || '';
    setCurrentName(name);
    setNewName(name);

    logger.info('RenameViewDialog loaded', { currentName: name }, 'RenameViewDialog');

    // Focus the input after a short delay
    setTimeout(() => {
      document.getElementById('view-name-input')?.focus();
      const input = document.getElementById('view-name-input') as HTMLInputElement;
      if (input) {
        input.select();
      }
    }, 100);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim() || newName === currentName) {
      handleCancel();
      return;
    }

    setIsSubmitting(true);

    try {
      logger.info('Rename submitted', { oldName: currentName, newName: newName.trim() }, 'RenameViewDialog');

      // Dispatch result using OpenFin popup API
      if (window.fin) {
        await fin.me.dispatchPopupResult({
          newName: newName.trim()
        });
      } else {
        // Fallback for non-OpenFin environments
        window.close();
      }
    } catch (error) {
      logger.error('Failed to submit rename', error, 'RenameViewDialog');
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      logger.info('Rename cancelled', {}, 'RenameViewDialog');

      // Dispatch null result (cancelled)
      if (window.fin) {
        await fin.me.dispatchPopupResult(null);
      } else {
        // Fallback for non-OpenFin environments
        window.close();
      }
    } catch (error) {
      logger.error('Failed to cancel', error, 'RenameViewDialog');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className="flex items-center justify-center w-full h-full bg-transparent">
      <div className="w-[254px] bg-white dark:bg-[#2b2b2b] rounded-lg shadow-xl border border-gray-300 dark:border-[#3d3d3d]">
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="p-3 space-y-3">
            {/* Header with icon */}
            <div className="flex items-center gap-2 text-gray-700 dark:text-[#cccccc] text-[13px]">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z"/>
              </svg>
              <span>Rename View As</span>
            </div>

            {/* Input field */}
            <Input
              id="view-name-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter view name"
              disabled={isSubmitting}
              autoFocus
              className="w-full h-8 bg-white dark:bg-[#3c3c3c] border-[#0078d4] text-gray-900 dark:text-[#cccccc] text-[13px] rounded focus:ring-1 focus:ring-[#0078d4] focus-visible:ring-1 focus-visible:ring-[#0078d4] placeholder:text-gray-400 dark:placeholder:text-[#858585]"
            />

            {/* Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="h-7 px-4 text-[13px] bg-transparent hover:bg-gray-100 dark:hover:bg-[#3d3d3d] text-gray-700 dark:text-[#cccccc] rounded"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newName.trim() || newName === currentName || isSubmitting}
                className="h-7 px-4 text-[13px] bg-[#0078d4] hover:bg-[#006cc1] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
