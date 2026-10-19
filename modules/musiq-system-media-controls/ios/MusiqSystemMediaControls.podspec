Pod::Spec.new do |s|
  s.name = 'MusiqSystemMediaControls'
  s.version = '1.0.0'
  s.summary = 'Native iOS remote track controls for Musiqapp.'
  s.description = s.summary
  s.license = { type: 'MIT' }
  s.author = 'Musiqapp'
  s.homepage = 'https://github.com/egokam/Music'
  s.platforms = { ios: '16.4' }
  s.swift_version = '5.9'
  s.source = { path: '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '*.swift'
end
