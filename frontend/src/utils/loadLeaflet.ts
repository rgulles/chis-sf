export function loadLeaflet() {
  return import('./leafletRuntime').then(module => module.default);
}
