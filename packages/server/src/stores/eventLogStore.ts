export type ExperimentEvent = {
  id: string;
  timestamp: string;
  participantId: string;
  caseId: string;
  condition: string;
  eventType: string;
  payload: unknown;
};

const events: ExperimentEvent[] = [];

export function addEvent(event: Omit<ExperimentEvent, "id" | "timestamp">): ExperimentEvent {
  const storedEvent: ExperimentEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event
  };

  events.push(storedEvent);
  return storedEvent;
}

export function getEventsByParticipant(participantId: string): ExperimentEvent[] {
  return events.filter((event) => event.participantId === participantId);
}

export function getAllEvents(): ExperimentEvent[] {
  return [...events];
}
