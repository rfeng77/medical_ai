import { useEffect, useMemo, useRef, useState } from "react";
import { BodyPanel } from "./components/BodyPanel";
import { ConclusionPanel } from "./components/ConclusionPanel";
import { LeftPanel } from "./components/LeftPanel";
import { PostTurnRatingPanel } from "./components/PostTurnRatingPanel";
import { TopBar } from "./components/TopBar";
import {
  CASES,
  EXPERIMENT_OPENING_QUESTION,
  MAX_TURNS,
  MIN_TURNS,
} from "./data/cases";
import {
  fetchCases,
  savePostTurnRatings,
  type TriageCaseApiItem,
  type PostTurnRatingRequest,
  sendChatMessageStream,
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
const PARTICIPANT_ID = "test_web_001";

type PendingRatingContext = {
  turnIndex: number;
  doctorMessageId: string;
};

function createId(prefix: string) {
  idCounter += 1;
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${idCounter}`;
  return `${prefix}-${uniqueId}`;
}

function createSessionId() {
  return createId("session");
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
  const streamTokenRef = useRef(0);

  const [selectedCase, setSelectedCase] = useState<TriageCase | null>(null);
  const [sessionId, setSessionId] = useState(createSessionId);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>(
    [],
  );
  const [revealedClues, setRevealedClues] = useState<RevealedClue[]>([]);
  const [bodyMapLockedAfterTurn, setBodyMapLockedAfterTurn] = useState<
    number | null
  >(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isStreamingDoctorMessage, setIsStreamingDoctorMessage] = useState(false);
  const [doctorTurns, setDoctorTurns] = useState(0);
  const [sessionConcluded, setSessionConcluded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState(false);
  const [pendingRatingContext, setPendingRatingContext] =
    useState<PendingRatingContext | null>(null);
  const [isSavingRating, setIsSavingRating] = useState(false);
  const [, setPostTurnRatings] = useState<PostTurnRatingRequest[]>([]);

  useEffect(() => {
    return () => {
      streamTokenRef.current += 1;
    };
  }, []);

  const controlsLocked =
    isLoadingCases ||
    !selectedCase ||
    isThinking ||
    isStreamingDoctorMessage ||
    pendingRating ||
    sessionConcluded ||
    doctorTurns >= MAX_TURNS;
  const bodyMapAwaitingDialogue =
    bodyMapLockedAfterTurn !== null && doctorTurns <= bodyMapLockedAfterTurn;
  const bodyMapLocked =
    bodyMapAwaitingDialogue ||
    isThinking ||
    isStreamingDoctorMessage ||
    pendingRating ||
    sessionConcluded ||
    doctorTurns >= MAX_TURNS;

  useEffect(() => {
    if (bodyMapLockedAfterTurn !== null && doctorTurns > bodyMapLockedAfterTurn) {
      setBodyMapLockedAfterTurn(null);
    }
  }, [bodyMapLockedAfterTurn, doctorTurns]);

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

        if (!fallbackCase) {
          setCaseError(
            requestError instanceof Error
              ? `Cases could not be loaded. ${requestError.message}`
              : "Cases could not be loaded.",
          );
          return;
        }

        setSelectedCase(fallbackCase);
        setCaseError(null);

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
    streamTokenRef.current += 1;
    setSelectedCase(nextCase);
    setSessionId(createSessionId());
    setConversationHistory([]);
    setRevealedClues([]);
    setBodyMapLockedAfterTurn(null);
    setIsThinking(false);
    setIsStreamingDoctorMessage(false);
    setDoctorTurns(0);
    setSessionConcluded(false);
    setError(null);
    setPendingRating(false);
    setPendingRatingContext(null);
    setIsSavingRating(false);
    setPostTurnRatings([]);
  }

  function appendDoctorMessageDelta(messageId: string, delta: string, streamToken: number) {
    if (streamTokenRef.current !== streamToken) return;

    setConversationHistory((items) =>
      items.map((item) =>
        item.id === messageId
          ? { ...item, content: `${item.content}${delta}` }
          : item,
      ),
    );
  }

  async function sendPatientMessage(content: string) {
    if (condition === "reasoning" || controlsLocked || !selectedCase || !content.trim()) return;

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

      const doctorMessage: ChatMessage = {
        id: createId("doctor"),
        role: "doctor",
        content: "",
      };
      const streamToken = streamTokenRef.current + 1;
      streamTokenRef.current = streamToken;

      setConversationHistory([...nextHistory, doctorMessage]);
      setIsStreamingDoctorMessage(true);

      const chatResponse = await sendChatMessageStream(
        {
          participantId: PARTICIPANT_ID,
          caseId: selectedCase.caseId,
          condition,
          sessionId,
          message: content,
        },
        (delta) => {
          if (streamTokenRef.current !== streamToken) return;
          setIsThinking(false);
          appendDoctorMessageDelta(doctorMessage.id, delta, streamToken);
        },
      );

      const streamCompleted = streamTokenRef.current === streamToken;

      if (!streamCompleted) return;

      setConversationHistory((items) =>
        items.map((item) =>
          item.id === doctorMessage.id
            ? { ...item, content: chatResponse.response }
            : item,
        ),
      );

      setIsStreamingDoctorMessage(false);

      setPendingRating(true);
      setPendingRatingContext({
        turnIndex: doctorTurns + 1,
        doctorMessageId: doctorMessage.id,
      });

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
      setIsStreamingDoctorMessage(false);
    }
  }

  async function handlePostTurnRatingSubmit(ratings: {
    perceivedUrgency: number;
    perceivedRisk: number;
    confidence: number;
  }) {
    if (!selectedCase || !pendingRatingContext || isSavingRating) return;

    const timestamp = new Date().toISOString();
    const payload: PostTurnRatingRequest = {
      participantId: PARTICIPANT_ID,
      caseId: selectedCase.caseId,
      condition,
      sessionId,
      turnIndex: pendingRatingContext.turnIndex,
      messageId: pendingRatingContext.doctorMessageId,
      doctorMessageId: pendingRatingContext.doctorMessageId,
      perceivedUrgency: ratings.perceivedUrgency,
      perceivedRisk: ratings.perceivedRisk,
      confidence: ratings.confidence,
      timestamp,
    };

    setIsSavingRating(true);
    setError(null);

    try {
      await savePostTurnRatings(payload);
    } catch (requestError) {
      console.warn("Post-turn rating could not be saved to backend:", requestError);
    } finally {
      setPostTurnRatings((items) => [...items, payload]);
      setPendingRating(false);
      setPendingRatingContext(null);
      setIsSavingRating(false);
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

  function handleReasoningSubmit(reasoning: string) {
    if (
      condition !== "reasoning" ||
      controlsLocked ||
      !selectedCase ||
      !reasoning.trim()
    ) {
      return;
    }

    const reasoningMessage: ChatMessage = {
      id: createId("reasoning"),
      role: "patient",
      content: reasoning.trim(),
    };

    setConversationHistory((items) => [...items, reasoningMessage]);
    setPendingRating(true);
    setPendingRatingContext({
      turnIndex: doctorTurns + 1,
      doctorMessageId: reasoningMessage.id,
    });

    setDoctorTurns((turns) => {
      const nextTurns = turns + 1;

      if (nextTurns >= MAX_TURNS) {
        setSessionConcluded(true);
      }

      return nextTurns;
    });
  }

  function handleRevealClue(clue: RevealedClue) {
    setRevealedClues((items) =>
      items.some((item) => item.id === clue.id) ? items : [...items, clue],
    );

    if (clue.source === "region") {
      setBodyMapLockedAfterTurn(doctorTurns);
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
            onReasoningSubmit={handleReasoningSubmit}
            ratingPanel={
              pendingRating ? (
                <PostTurnRatingPanel
                  disabled={isSavingRating}
                  onSubmit={handlePostTurnRatingSubmit}
                />
              ) : null
            }
          />

          <BodyPanel
            currentCase={selectedCase}
            condition={condition}
            participantId={PARTICIPANT_ID}
            sessionId={sessionId}
            revealedClues={revealedClues}
            bodyMapLocked={bodyMapLocked}
            onReveal={handleRevealClue}
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
