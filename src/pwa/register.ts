import { registerSW } from 'virtual:pwa-register';

export const registerPwa = () =>
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('Mortgage Payment Planner is ready for offline use.');
    }
  });
