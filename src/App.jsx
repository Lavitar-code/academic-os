import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import AppShell from "./layout/AppShell";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import SearchModal from "./components/SearchModal";

import DashboardPage from "./pages/DashboardPage";
import PlannerPage from "./pages/PlannerPage";
import DoubtsPage from "./pages/DoubtsPage";
import ReviewPage from "./pages/ReviewPage";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";
import DataIntegrityPage from "./pages/DataIntegrityPage";

export default function App() {
  const [page, setPage] = useState("dashboard");

  const [doubtsSubjectId, setDoubtsSubjectId] = useState(null);
  const [focusSelection, setFocusSelection] = useState(null); // {subjectId, topicId}
  const [plannerSubjectId, setPlannerSubjectId] = useState(null);

  const [searchOpen, setSearchOpen] = useState(false);

  function navigate(next) {
    setPage(next);
    if (next !== "doubts") setDoubtsSubjectId(null);
    if (next !== "planner") setPlannerSubjectId(null);
  }

  function openDoubtsForSubject(subjectId) {
    setDoubtsSubjectId(String(subjectId));
    setPage("doubts");
  }

  function onSelectSearchResult(item) {
    if (item.kind === "subject") {
      setPlannerSubjectId(String(item.id));
      setPage("planner");
      return;
    }
    if (item.kind === "topic") {
      setFocusSelection({ subjectId: String(item.subjectId), topicId: String(item.id) });
      setPage("dashboard");
      return;
    }
    if (item.kind === "doubt") {
      setDoubtsSubjectId(String(item.subjectId));
      setPage("doubts");
      return;
    }
  }

  const title =
    page === "dashboard"
      ? "Dashboard"
      : page === "planner"
      ? "Planner"
      : page === "doubts"
      ? "Non mi è chiaro"
      : page === "review"
      ? "Dimentico"
      : page === "stats"
      ? "Statistiche"
      : page === "settings"
      ? "Impostazioni"
      : page === "integrity"
      ? "Integrità dati"
      : "Academic OS";

  const subtitle = "Academic OS • dark • minimal";

  return (
    <AppShell
      sidebar={<Sidebar page={page} onNavigate={navigate} />}
      topbar={<Topbar title={title} subtitle={subtitle} onOpenSearch={() => setSearchOpen(true)} />}
    >
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelect={onSelectSearchResult} />

      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18 }}
        >
          {page === "dashboard" && (
            <DashboardPage onOpenDoubtsForSubject={openDoubtsForSubject} focusSelection={focusSelection} />
          )}
          {page === "planner" && <PlannerPage initialSubjectId={plannerSubjectId} />}
          {page === "doubts" && (
            <DoubtsPage subjectIdFilter={doubtsSubjectId} onClearFilter={() => setDoubtsSubjectId(null)} />
          )}
          {page === "review" && <ReviewPage />}
          {page === "stats" && <StatsPage />}
          {page === "settings" && <SettingsPage />}
          {page === "integrity" && <DataIntegrityPage />}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}