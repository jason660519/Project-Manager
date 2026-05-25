export function spawn() {
  return {
    pid: 1,
    cols: 80,
    rows: 24,
    process: 'zsh',
    handleFlowControl: false,
    write: () => {},
    resize: () => {},
    kill: () => {},
    clear: () => {},
    pause: () => {},
    resume: () => {},
    onData: () => ({ dispose: () => {} }),
    onExit: () => ({ dispose: () => {} }),
  };
}
