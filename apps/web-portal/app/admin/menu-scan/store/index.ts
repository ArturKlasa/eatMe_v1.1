import { create } from 'zustand';
import { createUploadSlice, UploadSlice } from './uploadSlice';
import { createProcessingSlice, ProcessingSlice } from './processingSlice';
import { createReviewSlice, ReviewSlice } from './reviewSlice';
import { createDraftSlice, DraftSlice } from './draftSlice';

export type ReviewStore = UploadSlice & ProcessingSlice & ReviewSlice & DraftSlice;

export const useReviewStore = create<ReviewStore>()((...a) => ({
  ...createUploadSlice(...a),
  ...createProcessingSlice(...a),
  ...createReviewSlice(...a),
  ...createDraftSlice(...a),
}));
