export type EsignStatus = "draft" | "pending_client" | "completed" | "cancelled" | "waiting_countersign";

export type EsignPlacement = {
  id: string;
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
  imageDataUrl: string;
  locked: boolean;
};

export type EsignCountersignPlacement = {
  id: string;
  page: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
  locked: boolean;
};

export type EsignDocument = {
  ownerUid: string;
  fileName: string;
  status: EsignStatus;
  createdAt?: any;
  updatedAt?: any;
  pagesCount?: number | null;
  finalPdfUrl?: string | null;
  signedPdfUrl?: string | null;
  signedAt?: any;
  placements?: EsignPlacement[];
  countersignPlaceholder?: EsignCountersignPlacement | null;
  countersignStatus?: string | null;
};

export type EsignDocumentWithId = EsignDocument & {
  id: string;
};

