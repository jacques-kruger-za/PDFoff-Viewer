/** IPC channel names — single source of truth for main, preload, and renderer. */

export const IPC = {
  OPEN_FILES: 'open-files',
  MENU_COMMAND: 'menu-command',
  CONSUME_PENDING: 'consume-pending-pdf-files',
  SHOW_IN_FOLDER: 'show-in-folder',
  OPEN_FILE_DIALOG: 'open-file-dialog',
  OPEN_DROPPED_FILES: 'open-dropped-files',
  SAVE_FILE: 'save-file',
  SAVE_FILE_AS: 'save-file-as',
  GET_SIGNATURES: 'get-signatures',
  SAVE_SIGNATURE: 'save-signature',
  DELETE_SIGNATURE: 'delete-signature',
} as const;

export const MENU_COMMANDS = {
  CLOSE_TAB: 'close-tab',
  SHOW_SIDEBAR: 'show-sidebar',
  HIDE_SIDEBAR: 'hide-sidebar',
  SAVE: 'save',
  SAVE_AS: 'save-as',
} as const;
