import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { Layout } from "@/components/Layout";

import Dashboard from "./pages/Dashboard";
import DepartmentsPage from "./pages/DepartmentsPage";
import Attendance from "./pages/attendance";
import Fees from "./pages/fees";
import Reports from "./pages/reports";  
import Analytics from "./pages/analytics";
import Notes from "./pages/notes";
import Alerts from "./pages/alerts"; 
import Quiz from "./pages/quiz";
import Settings from "./pages/settings";
import SharedDocumentPage from "@/components/SharedDocumentPage";
import ExtraFee from './components/fees/extrafee';
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* 1. PUBLIC SHARE ROUTE - NO SIDEBAR / NO DASHBOARD LAYOUT */}
            <Route path="/notes/share" element={<SharedDocumentPage />} />

            {/* 2. DASHBOARD ROUTES - WITH SIDEBAR */}
            <Route
              path="/*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/departments" element={<DepartmentsPage />} />
                    <Route path="/attendance" element={<Attendance />} />
                    <Route path="/fees" element={<Fees />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/quiz" element={<Quiz />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/extra-fee" element={<ExtraFee />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
