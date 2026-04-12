export interface PdfFile {
  id: string;
  name: string;
  data: ArrayBuffer;
  path?: string;
}

export interface ViewerState {
  currentPage: number;
  totalPages: number;
  zoom: number;
}
