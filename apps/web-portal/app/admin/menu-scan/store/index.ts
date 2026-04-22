import { create } from 'zustand';
import { createUploadSlice, UploadSlice } from './uploadSlice';
import { createProcessingSlice, ProcessingSlice } from './processingSlice';

export type ReviewStore = UploadSlice & ProcessingSlice;

export const useReviewStore = create<ReviewStore>()((...a) => ({
  ...createUploadSlice(...a),
  ...createProcessingSlice(...a),
}));
