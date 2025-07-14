import { clearApprovalCache } from '../../plugin-cache.js';
import { intro, outro, promptConfirm } from '../../utils/prompts.js';
import { step } from '../../utils/steps.js';
import { logger } from '../../utils/logger.js';

export const clearAllApprovals = async (): Promise<void> => {
  intro('Rozenite');

  const confirm = await promptConfirm({
    message:
      'Are you sure you want to clear all plugin approvals? This will require re-approval of all plugins.',
    confirmLabel: 'Clear All',
    cancelLabel: 'Cancel',
  });

  if (confirm) {
    await step(
      {
        start: 'Clearing all plugin approvals',
        stop: 'All plugin approvals cleared',
        error: 'Failed to clear plugin approvals',
      },
      async () => {
        await clearApprovalCache();
      }
    );
    outro();
  } else {
    logger.info('Operation cancelled');
    outro('Operation cancelled');
  }
};
