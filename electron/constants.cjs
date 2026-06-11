/** IPC channel names — mirrors src/constants/ipc.ts for Electron CJS files. */

const IPC = {
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
  SET_UNSAVED: 'set-unsaved',
  CLOSE_AFTER_SAVE: 'close-after-save',
};

const MENU_COMMANDS = {
  CLOSE_TAB: 'close-tab',
  SHOW_SIDEBAR: 'show-sidebar',
  HIDE_SIDEBAR: 'hide-sidebar',
  SAVE: 'save',
  SAVE_AS: 'save-as',
  SAVE_ALL: 'save-all',
};

module.exports = { IPC, MENU_COMMANDS };
