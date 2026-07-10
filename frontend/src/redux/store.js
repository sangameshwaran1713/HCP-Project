import { configureStore } from "@reduxjs/toolkit";
import interactionReducer from "./slices/interactionSlice";
import toolsReducer from "./slices/toolsSlice";

const store = configureStore({
  reducer: {
    interaction: interactionReducer,
    tools: toolsReducer,
  },
});

export default store;
