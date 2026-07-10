import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  hcps: [],
  interactions: [],
  selectedHcp: null,
  loading: false,
  error: null,
  submitSuccess: false,
  lastExtractedData: null,
};

const interactionSlice = createSlice({
  name: "interaction",
  initialState,
  reducers: {
    fetchStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchSuccess(state, action) {
      state.loading = false;
      state.interactions = action.payload;
    },
    fetchHcpsSuccess(state, action) {
      state.loading = false;
      state.hcps = action.payload;
    },
    fetchFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
    setSelectedHcp(state, action) {
      state.selectedHcp = action.payload;
    },
    logSuccess(state, action) {
      state.loading = false;
      state.submitSuccess = true;
      state.interactions.unshift(action.payload);
      state.lastExtractedData = action.payload;
    },
    editSuccess(state, action) {
      state.loading = false;
      const updated = action.payload;
      const index = state.interactions.findIndex(item => item.id === updated.id);
      if (index !== -1) {
        state.interactions[index] = updated;
      }
      if (state.lastExtractedData && state.lastExtractedData.id === updated.id) {
        state.lastExtractedData = updated;
      }
    },
    clearSubmitSuccess(state) {
      state.submitSuccess = false;
    },
    clearLastExtractedData(state) {
      state.lastExtractedData = null;
    }
  }
});

export const {
  fetchStart,
  fetchSuccess,
  fetchHcpsSuccess,
  fetchFailure,
  setSelectedHcp,
  logSuccess,
  editSuccess,
  clearSubmitSuccess,
  clearLastExtractedData
} = interactionSlice.actions;

export default interactionSlice.reducer;
