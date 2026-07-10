import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isRunning: false,
  demoLog: [],
  demoSuccess: false,
  error: null,
};

const toolsSlice = createSlice({
  name: "tools",
  initialState,
  reducers: {
    runDemoStart(state) {
      state.isRunning = true;
      state.demoLog = [];
      state.demoSuccess = false;
      state.error = null;
    },
    runDemoSuccess(state, action) {
      state.isRunning = false;
      state.demoSuccess = action.payload.demo_success;
      state.demoLog = action.payload.log;
    },
    runDemoFailure(state, action) {
      state.isRunning = false;
      state.error = action.payload;
    },
    clearDemoLog(state) {
      state.demoLog = [];
      state.demoSuccess = false;
      state.error = null;
    }
  }
});

export const {
  runDemoStart,
  runDemoSuccess,
  runDemoFailure,
  clearDemoLog
} = toolsSlice.actions;

export default toolsSlice.reducer;
