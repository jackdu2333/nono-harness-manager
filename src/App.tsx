import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/routes";
import { useTheme } from "./features/theme/useTheme";

function App() {
  useTheme();
  
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
