import { configureStore } from '@reduxjs/toolkit';
import youtubePlayback from './youtubePlaybackSlice';
import { recordReduxAction } from './reduxLog';

export const store = configureStore({
  reducer: {
    youtubePlayback,
  },
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(
    (storeApi: any) => (next: any) => (action: any) => {
      const result = next(action);
      recordReduxAction(action.type, action.payload, storeApi.getState().youtubePlayback);
      return result;
    },
  ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;