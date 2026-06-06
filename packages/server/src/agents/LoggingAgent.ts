import { addEvent, getEventsByParticipant } from "../stores/eventLogStore";

type LogExperimentEventInput = {
  participantId: string;
  caseId: string;
  condition: string;
  eventType: string;
  payload: unknown;
};

export function logExperimentEvent(input: LogExperimentEventInput) {
  return addEvent(input);
}

export function getParticipantLogs(participantId: string) {
  return getEventsByParticipant(participantId);
}
