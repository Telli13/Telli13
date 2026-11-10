// The "platform" is everything that touches the real computer.
// In the browser prototype these do nothing real. When the app is wrapped
// with Tauri, these functions will call small Rust commands instead
// (see README → "Later: turning it into a Windows app with Tauri").
(function () {
  const ML = window.ML;
  const tauri = window.__TAURI__ || null;
  const invoke = tauri && tauri.core && tauri.core.invoke;

  ML.platform = {
    isDesktopApp: !!invoke,

    // Leave the library and go back to the normal Windows desktop.
    // Returns true if the real app handled it.
    async exit() {
      if (invoke) { try { await invoke('exit_shell'); return true; } catch (e) { console.warn(e); } }
      return false;
    },

    // Open a file with its normal Windows program.
    async openFile(item) {
      if (invoke) { try { await invoke('open_path', { path: item.path }); return true; } catch (e) { console.warn(e); } }
      return false;
    },
  };
})();
