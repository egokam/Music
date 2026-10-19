import { NativeModule, requireOptionalNativeModule } from 'expo';

type SystemMediaControlsEvents = {
  onNextTrackRequested: () => void;
  onPreviousTrackRequested: () => void;
};

declare class SystemMediaControlsModule extends NativeModule<SystemMediaControlsEvents> {
  setEnabled(enabled: boolean): void;
}

export const systemMediaControls = requireOptionalNativeModule<SystemMediaControlsModule>(
  'MusiqSystemMediaControls',
);
