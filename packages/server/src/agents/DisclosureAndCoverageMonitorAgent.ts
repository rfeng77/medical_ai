import casesData from "../data/simulatedAbdominalPainCases.json";
import checklistData from "../data/fieldChecklist.json";
import { extractOtherSymptomsWithAI } from "../services/symptomExtractorService";
import type {
  ClinicalField,
  DisclosureCoverageMonitorResult,
  DisclosedFields,
  FieldEvidence,
  FieldValue,
  ParticipantMemory,
} from "../types/experiment";

type ExtractionRule = {
  field: ClinicalField;
  value: FieldValue;
  patterns: RegExp[];
};

type SimulatedCase = {
  caseId: string;
  structuredFeatures: Partial<Record<ClinicalField, unknown>>;
  fieldPriority: Partial<Record<ClinicalField, number>>;
};

type ChecklistItem = {
  field: ClinicalField;
  category: string;
  neutralLabel: string;
  priority: number;
};

const fieldLabels: Record<ClinicalField, string> = {
  pain_location: "pain location",
  pain_quality: "pain quality",
  pain_migration: "pain movement over time",
  movement_pain: "movement-related pain",
  duration: "duration",
  fever: "fever-like symptoms",
  vomiting: "nausea or vomiting",
  nausea: "nausea",
  diarrhea: "diarrhea",
  bowel_movement: "bowel movement changes",
  bleeding: "bleeding or stool color",
  hydration: "hydration",
  urination: "urination",
  pregnancy: "pregnancy relevance",
  dizziness: "dizziness or fainting",
  medication: "medication use",
  medical_history: "medical history",
  red_flags: "severe or rapidly worsening symptoms",
  other_symptoms: "other disclosed symptoms",
};

const extractionRules: ExtractionRule[] = [
  {
    field: "pain_location",
    value: "right_lower_quadrant",
    patterns: [/\bright lower\b/i, /\blower right\b/i, /\brlq\b/i],
  },
  {
    field: "pain_location",
    value: "upper_abdomen",
    patterns: [/\bupper abdomen\b/i, /\bupper stomach\b/i],
  },
  {
    field: "pain_location",
    value: "left_lower_quadrant",
    patterns: [/\bleft lower\b/i],
  },
  {
    field: "pain_location",
    value: "diffuse_abdomen",
    patterns: [/\ball over\b/i, /\bdiffuse\b/i, /\bwhole belly\b/i],
  },
  {
    field: "pain_migration",
    value: "reported_migration",
    patterns: [
      /\bmoved\b/i,
      /\bstarted near (the )?belly button\b/i,
      /\bbelly button then right\b/i,
    ],
  },
  {
    field: "movement_pain",
    value: true,
    patterns: [/\bwalk\b/i, /\bwalking\b/i, /\bcough\b/i, /\bmovement\b/i, /\bbumps\b/i],
  },
  {
    field: "duration",
    value: "mentioned",
    patterns: [
      /\b\d+\s*(hour|hours|hr|hrs)\b/i,
      /\b\d+\s*(day|days)\b/i,
      /\bsince yesterday\b/i,
      /\bstarted\b/i,
    ],
  },
  {
    field: "fever",
    value: true,
    patterns: [/\bfever\b/i, /\bfeverish\b/i, /\bchills\b/i],
  },
  {
    field: "vomiting",
    value: true,
    patterns: [/\bvomit\b/i, /\bvomiting\b/i, /\bthrowing up\b/i],
  },
  {
    field: "nausea",
    value: true,
    patterns: [/\bnausea\b/i, /\bnauseous\b/i, /\bsick to my stomach\b/i],
  },
  {
    field: "diarrhea",
    value: true,
    patterns: [/\bdiarrhea\b/i, /\bwatery stool\b/i, /\bloose stool\b/i],
  },
  {
    field: "bleeding",
    value: true,
    patterns: [/\bblack stool\b/i, /\bblood\b/i, /\bbleeding\b/i, /\bcoffee ground\b/i],
  },
  {
    field: "dizziness",
    value: true,
    patterns: [/\bdizzy\b/i, /\bfaint\b/i, /\blightheaded\b/i],
  },
  {
    field: "medication",
    value: "mentioned",
    patterns: [/\bibuprofen\b/i, /\bblood thinner\b/i, /\bmedication\b/i],
  },
  {
    field: "hydration",
    value: "mentioned",
    patterns: [/\bdehydrated\b/i, /\bdry mouth\b/i, /\bnot peeing\b/i, /\burine\b/i],
  },

  // Symptoms disclosed by the participant but not necessarily relevant to the current case.
  {
    field: "other_symptoms",
    value: "back pain",
    patterns: [
      /\bback pain\b/i,
      /\bmy back hurts\b/i,
      /\bback hurts\b/i,
      /\bpain in my back\b/i,
      /\bback is pain\b/i,
      /\bmy back is pain\b/i,
    ],
  },
  {
    field: "other_symptoms",
    value: "headache",
    patterns: [/\bheadache\b/i, /\bhead pain\b/i, /\bhead hurts\b/i],
  },
  {
    field: "other_symptoms",
    value: "chest pain",
    patterns: [/\bchest pain\b/i, /\bchest tightness\b/i, /\bchest hurts\b/i],
  },
  {
    field: "other_symptoms",
    value: "breathing symptoms",
    patterns: [/\bshortness of breath\b/i, /\btrouble breathing\b/i, /\bbreathless\b/i],
  },
  {
    field: "other_symptoms",
    value: "rash",
    patterns: [/\brash\b/i, /\bhives\b/i],
  },
];

function appendOtherSymptom(currentValue: FieldValue | undefined, nextValue: FieldValue): FieldValue {
  if (!currentValue) {
    return nextValue;
  }

  const currentText = String(currentValue);
  const nextText = String(nextValue);

  if (currentText.split("; ").includes(nextText)) {
    return currentText;
  }

  return `${currentText}; ${nextText}`;
}

function extractExplicitFields(message: string): {
  extractedFields: DisclosedFields;
  evidenceText: FieldEvidence;
} {
  const extractedFields: DisclosedFields = {};
  const evidenceText: FieldEvidence = {};

  // TODO: Add an LLM extraction pass after the deterministic baseline is validated.
  for (const rule of extractionRules) {
    const matchedPattern = rule.patterns.find((pattern) => pattern.test(message));

    if (!matchedPattern) {
      continue;
    }

    const match = message.match(matchedPattern);
    const evidence = match?.[0] ?? message;

    if (rule.field === "other_symptoms") {
      extractedFields.other_symptoms = appendOtherSymptom(
        extractedFields.other_symptoms,
        rule.value,
      );
      evidenceText.other_symptoms = [...(evidenceText.other_symptoms ?? []), evidence];
      continue;
    }

    if (extractedFields[rule.field] !== undefined) {
      continue;
    }

    extractedFields[rule.field] = rule.value;
    evidenceText[rule.field] = [evidence];
  }

  return { extractedFields, evidenceText };
}

function mergeVisibleFields(
  existingFields: DisclosedFields,
  newFields: DisclosedFields,
): DisclosedFields {
  const mergedFields: DisclosedFields = {
    ...existingFields,
    ...newFields,
  };

  if (existingFields.other_symptoms && newFields.other_symptoms) {
    mergedFields.other_symptoms = appendOtherSymptom(
      existingFields.other_symptoms,
      newFields.other_symptoms,
    );
  }

  return mergedFields;
}

function getCase(caseId: string): SimulatedCase {
  const simulatedCase = (casesData.cases as unknown as SimulatedCase[]).find(
    (caseItem) => caseItem.caseId === caseId,
  );

  if (!simulatedCase) {
    throw new Error("Case not found.");
  }

  return simulatedCase;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) {
    return "no clinical fields";
  }

  if (items.length === 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export async function monitorDisclosureAndCoverage({

  message,

  memory,

  caseId

}: {

  message: string;

  memory: ParticipantMemory;

  caseId: string;

}): Promise<DisclosureCoverageMonitorResult> {
  const simulatedCase = getCase(caseId);
  const checklist = checklistData.fields as ChecklistItem[];
  const categoryByField = new Map(checklist.map((item) => [item.field, item.category]));

  const deterministicExtraction = extractExplicitFields(message);

  const aiSymptomExtraction = await extractOtherSymptomsWithAI(message);

  const extractedFields: DisclosedFields = {

    ...deterministicExtraction.extractedFields,

  };

  const evidenceText: FieldEvidence = {

    ...deterministicExtraction.evidenceText,

  };

  for (const symptom of aiSymptomExtraction.otherSymptoms) {

    extractedFields.other_symptoms =

      extractedFields.other_symptoms === undefined

        ? symptom

        : `${extractedFields.other_symptoms}; ${symptom}`;

    evidenceText.other_symptoms = [

      ...(evidenceText.other_symptoms ?? []),

      symptom,

    ];

  }

  const updatedVisibleFieldsPreview = mergeVisibleFields(
    memory.aiVisibleFields,
    extractedFields,
  );

  const relevantFields = Object.keys(simulatedCase.fieldPriority) as ClinicalField[];
  const disclosedFields = Object.keys(updatedVisibleFieldsPreview) as ClinicalField[];

  const matchedFields = disclosedFields.filter((field) => relevantFields.includes(field));
  const unmatchedDisclosedFields = disclosedFields.filter(
    (field) => !relevantFields.includes(field),
  );

  const unmatchedDisclosedEvidence: FieldEvidence = Object.fromEntries(
    unmatchedDisclosedFields
      .map((field) => [field, evidenceText[field] ?? memory.fieldEvidence[field] ?? []])
      .filter(([, evidenceItems]) => (evidenceItems as string[]).length > 0),
  ) as FieldEvidence;

  const missingFields = relevantFields.filter(
    (field) => updatedVisibleFieldsPreview[field] === undefined,
  );

  const totalPriority = relevantFields.reduce(
    (sum, field) => sum + (simulatedCase.fieldPriority[field] ?? 0),
    0,
  );

  const matchedPriority = matchedFields.reduce(
    (sum, field) => sum + (simulatedCase.fieldPriority[field] ?? 0),
    0,
  );

  const informationCoverageRatio =
    totalPriority > 0 ? Number((matchedPriority / totalPriority).toFixed(2)) : 0;

  const disclosedFieldCount = disclosedFields.length;
  const matchedFieldCount = matchedFields.length;

  const hitRatio =
    disclosedFieldCount > 0
      ? Number((matchedFieldCount / disclosedFieldCount).toFixed(2))
      : 0;

  const uncertaintyLevel =
    informationCoverageRatio < 0.4
      ? "high"
      : informationCoverageRatio < 0.65
        ? "moderate"
        : "lower";

  const matchStrength =
    informationCoverageRatio < 0.4
      ? "low"
      : informationCoverageRatio < 0.65
        ? "moderate"
        : "high";

  const missingInformationCategories = [
    ...new Set(
      missingFields
        .filter((field) => (simulatedCase.fieldPriority[field] ?? 0) >= 4)
        .map((field) => categoryByField.get(field))
        .filter((category): category is string => Boolean(category)),
    ),
  ];

  const disclosedLabels = disclosedFields.map((field) => fieldLabels[field] ?? field);

  const coverageDescription =
    informationCoverageRatio < 0.4
      ? "Current information coverage is limited."
      : informationCoverageRatio < 0.65
        ? "Current information coverage is partial."
        : "Current information coverage includes several key categories.";

  const monitoringSummary =
    disclosedFieldCount > 0 && matchedFieldCount === 0
      ? `The participant disclosed ${disclosedFieldCount} symptom field(s), but none of them currently match the key fields for this case. ${coverageDescription}`
      : matchedFieldCount > 0
        ? `The participant disclosed ${disclosedFieldCount} field(s), and ${matchedFieldCount} of them match the current case fields. ${coverageDescription}`
        : `The participant has disclosed ${joinWithAnd(disclosedLabels)}. ${coverageDescription}`;

  return {
    extractedFields,
    evidenceText,
    updatedVisibleFieldsPreview,
    matchedFields,
    unmatchedDisclosedFields,
    unmatchedDisclosedEvidence,
    disclosedFieldCount,
    matchedFieldCount,
    hitRatio,
    missingFields,
    missingInformationCategories,
    informationCoverageRatio,
    matchStrength,
    uncertaintyLevel,
    shouldSuggestMoreSearch: informationCoverageRatio < 0.65,
    monitoringSummary,
    isSymptomDisclosure:
      disclosedFieldCount > 0 || aiSymptomExtraction.isSymptomDisclosure,
    nonSymptomInputType:
      disclosedFieldCount > 0 || aiSymptomExtraction.isSymptomDisclosure
        ? null
        : aiSymptomExtraction.nonSymptomInputType,
  };
}