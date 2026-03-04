export type EsignStatus = "draft" | "pending_client" | "completed" | "cancelled";

export type EsignDocument = {
  ownerUid: string;
  fileName: string;
  status: EsignStatus;
  createdAt?: any;
  pagesCount?: number | null;
  finalPdfUrl?: string | null;
  signedPdfUrl?: string | null;
  signedAt?: any;
};

export type EsignDocumentWithId = EsignDocument & {
  id: string;
};

