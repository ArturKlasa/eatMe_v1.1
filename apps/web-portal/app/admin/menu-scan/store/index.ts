import { create } from 'zustand';
import { createUploadSlice, UploadSlice } from './uploadSlice';
import { createProcessingSlice, ProcessingSlice } from './processingSlice';
import { createReviewSlice, ReviewSlice } from './reviewSlice';
import { createDraftSlice, DraftSlice } from './draftSlice';
import { createGroupSlice, GroupSlice } from './groupSlice';

export type ReviewStore = UploadSlice & ProcessingSlice & ReviewSlice & DraftSlice & GroupSlice;

export const useReviewStore = create<ReviewStore>()((...a) => ({
  ...createUploadSlice(...a),
  ...createProcessingSlice(...a),
  ...createReviewSlice(...a),
  ...createDraftSlice(...a),
  ...createGroupSlice(...a),
}));
