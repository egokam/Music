import ExpoModulesCore
import MediaPlayer

public class MusiqSystemMediaControlsModule: Module {
  private let commandCenter = MPRemoteCommandCenter.shared()
  private var nextTrackTarget: Any?
  private var previousTrackTarget: Any?

  public func definition() -> ModuleDefinition {
    Name("MusiqSystemMediaControls")

    Events("onNextTrackRequested", "onPreviousTrackRequested")

    Function("setEnabled") { (enabled: Bool) in
      self.setEnabled(enabled)
    }

    OnDestroy {
      self.setEnabled(false)
    }
  }

  private func setEnabled(_ enabled: Bool) {
    performOnMain {
      if enabled {
        if self.nextTrackTarget == nil {
          self.nextTrackTarget = self.commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            guard let self else {
              return .commandFailed
            }

            self.sendEvent("onNextTrackRequested", [:])
            return .success
          }
        }

        if self.previousTrackTarget == nil {
          self.previousTrackTarget = self.commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            guard let self else {
              return .commandFailed
            }

            self.sendEvent("onPreviousTrackRequested", [:])
            return .success
          }
        }

        self.commandCenter.nextTrackCommand.isEnabled = true
        self.commandCenter.previousTrackCommand.isEnabled = true
      } else {
        self.commandCenter.nextTrackCommand.isEnabled = false
        self.commandCenter.previousTrackCommand.isEnabled = false

        if let target = self.nextTrackTarget {
          self.commandCenter.nextTrackCommand.removeTarget(target)
          self.nextTrackTarget = nil
        }

        if let target = self.previousTrackTarget {
          self.commandCenter.previousTrackCommand.removeTarget(target)
          self.previousTrackTarget = nil
        }
      }
    }
  }

  private func performOnMain(_ operation: @escaping () -> Void) {
    if Thread.isMainThread {
      operation()
    } else {
      DispatchQueue.main.async(execute: operation)
    }
  }
}
