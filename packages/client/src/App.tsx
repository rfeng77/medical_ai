import { useEffect, useMemo, useState } from "react";
import { BodyPanel } from "./components/BodyPanel";
import { ConclusionPanel } from "./components/ConclusionPanel";
import { LeftPanel } from "./components/LeftPanel";
import { TopBar } from "./components/TopBar";
import {
  CASES,
  EXPERIMENT_OPENING_QUESTION,
  MAX_TURNS,
  MIN_TURNS,
} from "./data/cases";
import {
  fetchCases,
  type TriageCaseApiItem,
  sendChatMessage,
} from "./services/api";
import type {
  CareLabel,
  ChatMessage,
  RevealedClue,
  TriageCase,
} from "./types/triage";
import { getConditionFromUrl } from "./utils/condition";
import "./styles/app.css";

let idCounter = 0;

function createId(prefix: string) {
  idCounter += 1;
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${idCounter}`;
  return `${prefix}-${uniqueId}`;
}

function normalizeCase(
  caseItem: TriageCaseApiItem | TriageCase,
): TriageCase | null {
  const caseId = caseItem.caseId ?? caseItem.id;

  const openingComplaint =
    "openingComplaint" in caseItem ? caseItem.openingComplaint : null;

  const opening =
    typeof openingComplaint === "string" && openingComplaint
      ? openingComplaint
      : typeof caseItem.opening === "string" && caseItem.opening
        ? caseItem.opening
        : "";

  const patientCard =
    typeof caseItem.patientCard === "string" && caseItem.patientCard
      ? caseItem.patientCard
      : "";

  if (!caseId || !caseItem.label) {
    return null;
  }

  return {
    caseId,
    id: caseId,
    label: caseItem.label,
    target: (caseItem.target ?? "Self-care") as CareLabel,
    opening,
    patientCard,
    probabilities: caseItem.probabilities ?? {
      "Self-care": 0,
      "Routine GP": 0,
      "Urgent Primary Care": 0,
      "A&E": 0,
      Ambulance: 0,
    },
    notes: caseItem.notes ?? "",
    regions: caseItem.regions ?? {
      epigastric: "",
      periumbilical: "",
      rlq: "",
      llq: "",
      general: "",
    },
    symptoms: caseItem.symptoms ?? [],
  };
}

function App() {
  const condition = useMemo(() => getConditionFromUrl(), []);

  const [selectedCase, setSelectedCase] = useState<TriageCase | null>(null);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>(
    [],
  );
  const [revealedClues, setRevealedClues] = useState<RevealedClue[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [doctorTurns, setDoctorTurns] = useState(0);
  const [sessionConcluded, setSessionConcluded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseError, setCaseError] = useState<string | null>(null);

  const controlsLocked =
    isLoadingCases ||
    !selectedCase ||
    isThinking ||
    sessionConcluded ||
    doctorTurns >= MAX_TURNS;

  useEffect(() => {
    let isMounted = true;

    async function loadCases() {
      setIsLoadingCases(true);

      try {
        const backendCases = (await fetchCases())
          .map(normalizeCase)
          .filter((item): item is TriageCase => item !== null);

        const nextCases = backendCases.length > 0 ? backendCases : CASES;
        const initialCase = nextCases[0];

        if (!isMounted) return;

        setSelectedCase(initialCase);
        setCaseError(null);

        console.log("Loaded cases:", nextCases);
        console.log("Initial selected case:", initialCase);
      } catch (requestError) {
        if (!isMounted) return;

        const fallbackCase = CASES[0];

        setSelectedCase(fallbackCase);
        setCaseError(
          requestError instanceof Error
            ? `Cases could not be loaded from the backend. Showing the first available case. ${requestError.message}`
            : "Cases could not be loaded from the backend. Showing the first available case.",
        );

        console.warn("Falling back to local cases:", requestError);
      } finally {
        if (isMounted) {
          setIsLoadingCases(false);
        }
      }
    }

    void loadCases();

    return () => {
      isMounted = false;
    };
  }, []);

  function resetTrial(nextCase = selectedCase) {
    setSelectedCase(nextCase);
    setConversationHistory([]);
    setRevealedClues([]);
    setIsThinking(false);
    setDoctorTurns(0);
    setSessionConcluded(false);
    setError(null);
  }

  async function sendPatientMessage(content: string) {
    if (controlsLocked || !selectedCase || !content.trim()) return;

    const patientMessage: ChatMessage = {
      id: createId("patient"),
      role: "patient",
      content,
    };

    const nextHistory = [...conversationHistory, patientMessage];

    setConversationHistory(nextHistory);
    setIsThinking(true);
    setError(null);

    try {
      console.log("selectedCase before chat:", selectedCase);
      console.log("caseId sent to backend:", selectedCase.caseId);

      const chatResponse = await sendChatMessage({
        participantId: "test_web_001",
        caseId: selectedCase.caseId,
        condition,
        message: content,
      });

      const doctorMessage: ChatMessage = {
        id: createId("doctor"),
        role: "doctor",
        content: chatResponse.response,
      };

      setConversationHistory([...nextHistory, doctorMessage]);

      setDoctorTurns((turns) => {
        const nextTurns = turns + 1;

        if (nextTurns >= MAX_TURNS) {
          setSessionConcluded(true);
        }

        return nextTurns;
      });
    } catch (requestError) {
      const message =
        requestError instanceof TypeError
          ? "Backend server is not connected. Please make sure the server is running on http://localhost:3001."
          : requestError instanceof Error
            ? requestError.message
            : "Backend server is not connected. Please make sure the server is running on http://localhost:3001.";

      setError(message);
    } finally {
      setIsThinking(false);
    }
  }

  function handleOpening() {
    if (
      controlsLocked ||
      !selectedCase ||
      revealedClues.some((item) => item.id === "opening")
    ) {
      return;
    }

    setRevealedClues((items) => [
      ...items,
      {
        id: "opening",
        label: "Opening complaint",
        detail: EXPERIMENT_OPENING_QUESTION,
        source: "opening",
      },
    ]);

    void sendPatientMessage(EXPERIMENT_OPENING_QUESTION);
  }

  function handleConclude() {
    if (doctorTurns >= MIN_TURNS) {
      setSessionConcluded(true);
    }
  }

  return (
    <div className="app-shell">
      <TopBar isThinking={isThinking} condition={condition} />

      {caseError ? <div className="case-status-banner">{caseError}</div> : null}

      {isLoadingCases || !selectedCase ? (
        <main className="triage-layout loading-layout">
          <section className="chat-panel">Loading cases...</section>
        </main>
      ) : (
        <main className="triage-layout">
          <LeftPanel
            condition={condition}
            messages={conversationHistory}
            canConclude={doctorTurns >= MIN_TURNS}
            disabled={controlsLocked}
            isThinking={isThinking}
            error={error}
            onOpening={handleOpening}
            onReset={() => resetTrial()}
            onConclude={handleConclude}
            onSend={sendPatientMessage}
          />

          <BodyPanel
            currentCase={selectedCase}
            condition={condition}
            revealedClues={revealedClues}
            onReveal={(clue) => setRevealedClues((items) => [...items, clue])}
          />
        </main>
      )}

      {sessionConcluded && selectedCase ? (
        <ConclusionPanel currentCase={selectedCase} doctorTurns={doctorTurns} />
      ) : null}
    </div>
  );
}

export default App;
