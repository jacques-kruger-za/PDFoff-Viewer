/** IPC channel names — single source of truth for main, preload, and renderer. */

export const IPC = {
  OPEN_FILES: 'open-files',
  MENU_COMMAND: 'menu-command',
  CONSUME_PENDING: 'consume-pending-pdf-files',
  SHOW_IN_FOLDER: 'show-in-folder',
  OPEN_FILE_DIALOG: 'open-file-dialog',
  OPEN_DROPPED_FILES: 'open-dropped-files',
} as const;

export const MENU_COMMANDS = {
  CLOSE_TAB: 'close-tab',
  SHOW_SIDEBAR: 'show-sidebar',
  HIDE_SIDEBAR: 'hide-sidebar',
} as const;
