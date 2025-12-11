/**
 * Toolbar Customization Window
 *
 * Standalone window component for customizing SimpleBlotter toolbars.
 * Launched from the SimpleBlotter settings menu or dock menu.
 */

import { useEffect, useState, useCallback } from 'react';
import { useOpenfinTheme } from '@stern/openfin-platform';
import { ToolbarCustomizationWizard, ToolbarButton, BlotterToolbarConfig } from '@/components/wizards/ToolbarCustomizationWizard';
import { useToast } from '@/hooks/ui/use-toast';
import { useConfigSync } from '@/hooks/useConfigSync';
import { logger } from '@/utils/logger';

/**
 * ToolbarCustomizationWindow Component
 *
 * Wraps the ToolbarCustomizationWizard in a full-screen layout optimized
 * for a standalone OpenFin window.
 */
export default function ToolbarCustomizationWindow() {
  // Apply OpenFin theme (dark/light mode)
  useOpenfinTheme();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(true);
  const [buttons, setButtons] = useState<ToolbarButton[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceViewId, setSourceViewId] = useState<string | null>(null);

  // Set window title
  useEffect(() => {
    document.title = 'Customize Toolbar';
  }, []);

  // Load toolbar configuration - get sourceViewId from customData, then fetch config from SharedWorker
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (typeof fin !== 'undefined') {
          const currentWindow = await fin.Window.getCurrent();
          const windowOptions = await currentWindow.getOptions();

          const viewId = windowOptions.customData?.sourceViewId;

          if (!viewId) {
            logger.warn('No sourceViewId found in window customData', undefined, 'ToolbarCustomizationWindow');
            setIsLoading(false);
            return;
          }

          setSourceViewId(viewId);

          // Load from customData as fallback (for initial load)
          if (windowOptions.customData?.toolbarConfig) {
            const config = windowOptions.customData.toolbarConfig as BlotterToolbarConfig;
            setButtons(config.customButtons || []);
            logger.info('Loaded initial toolbar config from window customData', {
              buttonsCount: config.customButtons?.length || 0,
              sourceViewId: viewId
            }, 'ToolbarCustomizationWindow');
          } else {
            logger.info('No toolbar config found in window customData', undefined, 'ToolbarCustomizationWindow');
          }
        }
      } catch (error) {
        logger.warn('Could not load toolbar config from customData', error, 'ToolbarCustomizationWindow');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Connect to ConfigSyncWorker
  const configSync = useConfigSync({
    viewId: sourceViewId || 'toolbar-customization-window',
    blotterId: 'ToolbarCustomizationWindow',
    windowName: typeof window !== 'undefined' ? window.name : undefined,
    onError: (error) => {
      logger.error('ConfigSync error', error, 'ToolbarCustomizationWindow');
    },
  });

  // Fetch latest config from SharedWorker cache once we have sourceViewId and connection
  useEffect(() => {
    if (!sourceViewId || !configSync.isConnected) return;

    const fetchLatestConfig = async () => {
      try {
        logger.info('Fetching latest toolbar config from ConfigSyncWorker', {
          sourceViewId
        }, 'ToolbarCustomizationWindow');

        // Fetch config for the SOURCE viewId (SimpleBlotter), not our own viewId
        const config = await configSync.getToolbarConfig(sourceViewId);

        if (config?.customButtons) {
          setButtons(config.customButtons);
          logger.info('Loaded latest toolbar config from ConfigSyncWorker', {
            buttonsCount: config.customButtons.length,
            sourceViewId
          }, 'ToolbarCustomizationWindow');
        } else {
          logger.info('No cached config found in ConfigSyncWorker, using customData', {
            sourceViewId
          }, 'ToolbarCustomizationWindow');
        }
      } catch (error) {
        logger.warn('Could not fetch config from ConfigSyncWorker, using customData', error, 'ToolbarCustomizationWindow');
      }
    };

    fetchLatestConfig();
  }, [sourceViewId, configSync.isConnected, configSync]);

  // Handle save - send config back to parent view via ConfigSyncWorker
  const handleSave = useCallback(async (savedButtons: ToolbarButton[]) => {
    try {
      if (!sourceViewId) {
        logger.warn('Cannot save: no sourceViewId', undefined, 'ToolbarCustomizationWindow');
        toast({
          title: 'Error',
          description: 'Cannot save toolbar configuration: missing source view ID.',
          variant: 'destructive',
        });
        return;
      }

      logger.info('Sending toolbar config update via ConfigSyncWorker', {
        sourceViewId,
        buttonsCount: savedButtons.length,
      }, 'ToolbarCustomizationWindow');

      // Send config update to the SOURCE viewId (SimpleBlotter), not our own viewId
      configSync.updateToolbarConfig({
        customButtons: savedButtons,
      }, sourceViewId);

      logger.info('Toolbar config sent successfully via ConfigSyncWorker', {
        buttonsCount: savedButtons.length
      }, 'ToolbarCustomizationWindow');

      toast({
        title: 'Toolbar Updated',
        description: `${savedButtons.length} custom button(s) configured successfully.`,
      });

      // Close window after save
      setTimeout(async () => {
        try {
          if (typeof fin !== 'undefined') {
            const currentWindow = await fin.Window.getCurrent();
            await currentWindow.close();
            logger.info('Customization window closed', undefined, 'ToolbarCustomizationWindow');
          }
        } catch (error) {
          logger.warn('Could not close window', error, 'ToolbarCustomizationWindow');
        }
      }, 1000);
    } catch (error) {
      logger.error('Failed to save toolbar config', error, 'ToolbarCustomizationWindow');
      toast({
        title: 'Error',
        description: 'Failed to save toolbar configuration.',
        variant: 'destructive',
      });
    }
  }, [sourceViewId, configSync, toast]);

  // Handle close
  const handleClose = useCallback(async () => {
    try {
      if (typeof fin !== 'undefined') {
        const currentWindow = await fin.Window.getCurrent();
        await currentWindow.close();
      }
    } catch (error) {
      logger.warn('Could not close window', error, 'ToolbarCustomizationWindow');
    }
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading toolbar configuration...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background overflow-hidden">
      {/* Apply global styles to override Dialog constraints when in standalone window */}
      <style>{`
        [role="dialog"] {
          max-width: 100% !important;
          max-height: 100% !important;
          width: 100vw !important;
          height: 100vh !important;
          border-radius: 0 !important;
          margin: 0 !important;
        }
        [data-radix-dialog-overlay] {
          background: transparent !important;
        }
      `}</style>
      <ToolbarCustomizationWizard
        open={isOpen}
        onClose={handleClose}
        buttons={buttons}
        onSave={handleSave}
      />
    </div>
  );
}
