import { generateGeminiResponse } from "../services/geminiService";
import type {
  ExtractedSymptom,
  ParticipantMemory,
  SymptomExtractionAgentResult
} from "../types/experiment";

const emptyExtractionResult: SymptomExtractionAgentResult = {
  isSymptomDisclosure: false,
  nonSymptomInputType: "other",
  extractedSymptoms: [],
  extractionNotes: "No symptom disclosure detected."
};

type SymptomTemplate = {
  symptomId: string;
  label: string;
  aliases: string[];
  presentPatterns: RegExp[];
  absentPatterns?: RegExp[];
  uncertainPatterns?: RegExp[];
  bodyLocation?: string | null;
};

const symptomTemplates: SymptomTemplate[] = [
  {
    symptomId: "upper_abdominal_pain",
    label: "upper abdominal pain",
    aliases: ["upper abdominal pain", "upper stomach pain", "upper belly pain"],
    presentPatterns: [/\bupper abdominal pain\b/i, /\bupper stomach pain\b/i, /\bupper belly pain\b/i]
  },
  {
    symptomId: "epigastric_pain",
    label: "epigastric pain",
    aliases: ["epigastric pain", "upper middle pain", "burning upper abdominal pain"],
    presentPatterns: [/\bepigastric pain\b/i, /\bupper middle\b/i, /\bburning upper abdominal pain\b/i]
  },
  {
    symptomId: "burning_or_indigestion",
    label: "burning or indigestion",
    aliases: ["burning", "heartburn", "indigestion", "gnawing"],
    presentPatterns: [/\bburning\b/i, /\bheartburn\b/i, /\bindigestion\b/i, /\bgnawing\b/i]
  },
  {
    symptomId: "left_lower_abdominal_pain",
    label: "left lower abdominal pain",
    aliases: ["left lower abdomen", "lower left side", "LLQ pain"],
    presentPatterns: [/\bleft lower\b/i, /\blower left\b/i, /\bllq\b/i],
    bodyLocation: "left lower abdomen"
  },
  {
    symptomId: "flank_or_groin_pain",
    label: "flank or groin pain",
    aliases: ["flank pain", "groin pain", "pain to groin"],
    presentPatterns: [/\bflank\b/i, /\bgroin\b/i, /\bback to groin\b/i, /\bside pain\b/i]
  },
  {
    symptomId: "painful_bulge",
    label: "painful bulge",
    aliases: ["painful bulge", "painful lump", "hernia"],
    presentPatterns: [/\bpainful bulge\b/i, /\bpainful lump\b/i, /\bhernia\b/i, /\bbulge\b/i]
  },
  {
    symptomId: "watery_diarrhea",
    label: "watery diarrhea",
    aliases: ["watery diarrhea", "watery stool", "loose stool"],
    presentPatterns: [/\bwatery diarrhea\b/i, /\bwatery stools?\b/i]
  },
  {
    symptomId: "diarrhea",
    label: "diarrhea",
    aliases: ["diarrhea", "loose stool", "watery stool"],
    presentPatterns: [/\bdiarrhea\b/i, /\bloose stools?\b/i, /\bwatery stools?\b/i]
  },
  {
    symptomId: "blood_in_stool",
    label: "blood in stool",
    aliases: ["blood in stool", "bloody diarrhea", "black stool", "no blood", "no black stool"],
    presentPatterns: [/\bblood in (my )?stool\b/i, /\bbloody stools?\b/i, /\bblack stools?\b/i],
    absentPatterns: [
      /\bno blood\b/i,
      /\bno blood in (my )?stool\b/i,
      /\bno black stools?\b/i,
      /\bno bleeding\b/i,
      /\bnot bloody\b/i
    ],
    uncertainPatterns: [/\bnot sure (if|whether).*blood/i, /\bmaybe.*blood.*stool/i]
  },
  {
    symptomId: "high_fever",
    label: "high fever",
    aliases: ["high fever", "fever"],
    presentPatterns: [/\bhigh fever\b/i, /\bvery feverish\b/i, /\bshaking chills\b/i],
    absentPatterns: [/\bno high fever\b/i, /\bdo not have a high fever\b/i, /\bdon't have a high fever\b/i],
    uncertainPatterns: [/\bnot sure (if|whether).*high fever/i, /\bmaybe.*high fever/i]
  },
  {
    symptomId: "fever",
    label: "fever",
    aliases: ["fever", "feverish", "chills"],
    presentPatterns: [/\bfever\b/i, /\bfeverish\b/i, /\bchills\b/i],
    absentPatterns: [
      /\bno fever\b/i,
      /\bno high fever\b/i,
      /\bnot feverish\b/i,
      /\bdo not have (a )?(high )?fever\b/i,
      /\bdon't have (a )?(high )?fever\b/i
    ],
    uncertainPatterns: [/\bnot sure (if|whether).*(a )?fever/i, /\bmaybe.*(a )?fever/i, /\bmight have (a )?fever/i]
  },
  {
    symptomId: "stomach_cramps",
    label: "stomach cramps",
    aliases: ["stomach cramps", "belly cramps", "diffuse cramps", "cramping", "crampy abdominal discomfort"],
    presentPatterns: [
      /\bstomach cramps\b/i,
      /\bbelly cramps\b/i,
      /\bcramps?\b/i,
      /\bcramping\b/i,
      /\bcrampy\b/i,
      /\bdiffuse crampy abdominal discomfort\b/i
    ]
  },
  {
    symptomId: "vomiting",
    label: "vomiting",
    aliases: ["vomiting", "throwing up", "vomit"],
    presentPatterns: [/\bvomiting\b/i, /\bvomit(ed|ing)?\b/i, /\bthrowing up\b/i],
    absentPatterns: [
      /\bno\b[^.?!]*\bvomiting\b/i,
      /\bnot vomiting\b/i,
      /\bdo not have\b[^.?!]*\bvomiting\b/i,
      /\bdon't have\b[^.?!]*\bvomiting\b/i,
      /\bwithout vomiting\b/i
    ],
    uncertainPatterns: [/\bfeel like (I might )?(vomit|throw up)\b/i]
  },
  {
    symptomId: "nausea",
    label: "nausea",
    aliases: ["nausea", "nauseous", "feel like throwing up"],
    presentPatterns: [/\bnausea\b/i, /\bnauseous\b/i, /\bfeel like throwing up\b/i],
    absentPatterns: [
      /\bno\b[^.?!]*\bnausea\b/i,
      /\bnot nauseous\b/i,
      /\bdo not have\b[^.?!]*\bnausea\b/i,
      /\bdon't have\b[^.?!]*\bnausea\b/i,
      /\bwithout nausea\b/i
    ],
    uncertainPatterns: [/\bmaybe nauseous\b/i, /\bnot sure (if|whether).*nauseous/i]
  },
  {
    symptomId: "hydration_preserved",
    label: "able to drink fluids",
    aliases: [
      "can still drink",
      "able to drink",
      "keeping fluids down",
      "can keep small sips of water down",
      "urination normal"
    ],
    presentPatterns: [
      /\bcan still drink\b/i,
      /\bable to drink\b/i,
      /\bkeep(ing)? fluids down\b/i,
      /\bkeep(ing)? (small )?sips? of water down\b/i,
      /\bcan keep (small )?sips? of water down\b/i,
      /\bdrink water\b/i,
      /\burination normal\b/i,
      /\burinating normally\b/i,
      /\burine is normal\b/i
    ]
  },
  {
    symptomId: "dehydration",
    label: "possible dehydration",
    aliases: ["dehydrated", "dry mouth", "not peeing", "cannot drink"],
    presentPatterns: [/\bdehydrated\b/i, /\bdry mouth\b/i, /\bnot peeing\b/i, /\bcannot drink\b/i, /\bcan't drink\b/i],
    absentPatterns: [/\bnot dehydrated\b/i, /\bno dehydration\b/i]
  },
  {
    symptomId: "right_lower_abdominal_pain",
    label: "right lower abdominal pain",
    aliases: ["right lower abdomen", "lower right side", "RLQ pain"],
    presentPatterns: [/\bright lower\b/i, /\blower right\b/i, /\brlq\b/i, /\bright side low\b/i],
    bodyLocation: "right lower abdomen"
  },
  {
    symptomId: "pain_migration",
    label: "pain migration",
    aliases: ["pain moved", "started near belly button", "migrated"],
    presentPatterns: [/\bmoved\b/i, /\bmigrated\b/i, /\bstarted near (my |the )?belly button\b/i, /\bbelly button.*right\b/i]
  },
  {
    symptomId: "movement_worsens_pain",
    label: "movement worsens pain",
    aliases: ["walking makes it worse", "movement pain", "coughing hurts", "bumps hurt"],
    presentPatterns: [/\bwalking makes it worse\b/i, /\bhurts? to walk\b/i, /\bmovement makes it worse\b/i, /\bcoughing hurts\b/i, /\bbumps? hurt\b/i, /\bworse (when|if) (I )?(walk|move|cough)\b/i]
  },
  {
    symptomId: "generic_abdominal_pain",
    label: "abdominal pain",
    aliases: ["abdominal pain", "stomach pain", "belly pain", "stomach hurts"],
    presentPatterns: [/\babdominal pain\b/i, /\bstomach hurts?\b/i, /\bbelly hurts?\b/i, /\bstomach pain\b/i, /\bbelly pain\b/i]
  },
  {
    symptomId: "abdominal_swelling_or_no_stool",
    label: "abdominal swelling or inability to pass stool",
    aliases: ["abdominal swelling", "cannot pass stool", "cannot pass gas", "constipation"],
    presentPatterns: [
      /\bswollen abdomen\b/i,
      /\babdominal swelling\b/i,
      /\bbelly is swollen\b/i,
      /\bbloated\b/i,
      /\bcan't (poop|pass stool|pass gas)\b/i,
      /\bcannot (poop|pass stool|pass gas)\b/i,
      /\bhas not passed stool or gas\b/i,
      /\bnot passed stool or gas\b/i,
      /\bconstipat/i
    ]
  },
  {
    symptomId: "urinary_symptoms",
    label: "urinary symptoms",
    aliases: ["burning urination", "peeing often", "urinary symptoms"],
    presentPatterns: [/\bburning (when )?(I )?pee\b/i, /\bpainful urination\b/i, /\bpeeing often\b/i, /\burinary\b/i]
  },
  {
    symptomId: "pregnancy_possible",
    label: "possible pregnancy",
    aliases: ["pregnant", "pregnancy", "missed period"],
    presentPatterns: [/\bpregnan/i, /\bmissed period\b/i]
  },
  {
    symptomId: "dizziness_syncope",
    label: "dizziness or fainting",
    aliases: ["dizzy", "faint", "lightheaded", "passed out"],
    presentPatterns: [/\bdizz/i, /\bfaint/i, /\blightheaded\b/i, /\bpassed out\b/i]
  },
  {
    symptomId: "severe_or_worsening",
    label: "severe or worsening symptoms",
    aliases: ["severe", "worsening", "unbearable", "racing heart", "clammy"],
    presentPatterns: [/\bsevere\b/i, /\bworst\b/i, /\bworsening\b/i, /\bunbearable\b/i, /\bracing heart\b/i, /\bclammy\b/i]
  },
  {
    symptomId: "right_upper_quadrant_pain",
    label: "right upper abdominal pain",
    aliases: ["right upper quadrant pain", "right upper abdomen", "upper right abdomen", "RUQ pain"],
    presentPatterns: [/\bright upper\b/i, /\bupper right\b/i, /\bruq\b/i],
    bodyLocation: "right upper abdomen"
  },
  {
    symptomId: "diffuse_abdominal_pain",
    label: "diffuse abdominal pain",
    aliases: ["diffuse abdominal pain", "pain all over", "generalized abdominal pain"],
    presentPatterns: [/\bdiffuse abdominal pain\b/i, /\bpain all over\b/i, /\bgeneralized abdominal pain\b/i],
    bodyLocation: "diffuse abdomen"
  },
  {
    symptomId: "radiation_to_back",
    label: "pain radiating to the back",
    aliases: ["radiates to back", "goes to the back", "back radiation"],
    presentPatterns: [/\bradiat(es|ing)? to (the )?back\b/i, /\bgo(es|ing)? to (the )?back\b/i, /\bback radiation\b/i]
  },
  {
    symptomId: "shoulder_or_back_radiation",
    label: "pain radiating to shoulder or back",
    aliases: ["radiates to shoulder", "radiates to back", "goes to shoulder", "goes to back"],
    presentPatterns: [/\bradiat(es|ing)? to (the )?(right )?shoulder\b/i, /\bgo(es|ing)? to (the )?(right )?shoulder\b/i, /\bshoulder\b/i]
  },
  {
    symptomId: "postprandial_pain",
    label: "pain after eating",
    aliases: ["after eating", "after meals", "fatty meals", "postprandial"],
    presentPatterns: [/\bafter eating\b/i, /\bafter meals?\b/i, /\bfatty meals?\b/i, /\bpostprandial\b/i]
  },
  {
    symptomId: "prolonged_episode",
    label: "prolonged episode",
    aliases: ["lasted several hours", "lasting hours", "prolonged episode"],
    presentPatterns: [/\blast(ed|ing)? several hours\b/i, /\bfor several hours\b/i, /\bprolonged episode\b/i]
  },
  {
    symptomId: "pain_out_of_proportion",
    label: "pain out of proportion",
    aliases: ["pain out of proportion", "pain seems worse than exam"],
    presentPatterns: [/\bpain out of proportion\b/i, /\bworse than (the )?(exam|tenderness)\b/i]
  },
  {
    symptomId: "sudden_severe_pain",
    label: "sudden severe pain",
    aliases: ["sudden severe pain", "abrupt severe pain"],
    presentPatterns: [/\bsudden severe pain\b/i, /\babrupt severe pain\b/i, /\bsuddenly.*severe\b/i]
  },
  {
    symptomId: "vascular_risk_factors",
    label: "vascular risk factors",
    aliases: ["atrial fibrillation", "blood clot risk", "vascular disease"],
    presentPatterns: [/\batrial fibrillation\b/i, /\bafib\b/i, /\bblood clot\b/i, /\bvascular disease\b/i]
  },
  {
    symptomId: "ill_appearance",
    label: "ill appearance",
    aliases: ["looks very ill", "appears ill", "clammy"],
    presentPatterns: [/\blooks? very ill\b/i, /\bappears? ill\b/i, /\bclammy\b/i]
  },
  {
    symptomId: "altered_bowel_habits",
    label: "altered bowel habits",
    aliases: ["bowel habit change", "constipation", "diarrhea"],
    presentPatterns: [/\bbowel habit/i, /\bconstipat/i, /\bdiarrhea\b/i]
  },
  {
    symptomId: "worsening_tenderness",
    label: "worsening tenderness",
    aliases: ["worsening tenderness", "more tender"],
    presentPatterns: [/\bworsening tenderness\b/i, /\bmore tender\b/i, /\bincreasing tenderness\b/i]
  },
  {
    symptomId: "older_age_or_prior_history",
    label: "older age or prior history",
    aliases: ["prior diverticulitis", "previous similar episode", "older"],
    presentPatterns: [/\bprior diverticulitis\b/i, /\bprevious similar episode\b/i, /\bolder\b/i]
  },
  {
    symptomId: "alcohol_or_gallstone_risk_factors",
    label: "alcohol or gallstone risk factors",
    aliases: ["alcohol", "gallstones", "gallstone"],
    presentPatterns: [/\balcohol\b/i, /\bgallstones?\b/i]
  },
  {
    symptomId: "medication_risk",
    label: "medication bleeding risk",
    aliases: ["ibuprofen", "NSAID", "blood thinner", "warfarin", "aspirin"],
    presentPatterns: [/\bibuprofen\b/i, /\bnsaid\b/i, /\bblood thinner\b/i, /\bwarfarin\b/i, /\baspirin\b/i]
  }
];

const canonicalSymptomIds = new Set(symptomTemplates.map((template) => template.symptomId));

const llmSymptomIdAliases: Record<string, string> = {
  bloody_stool: "blood_in_stool",
  black_stool: "blood_in_stool",
  melena: "blood_in_stool",
  coffee_ground_vomit: "blood_in_stool",
  coffee_ground_emesis: "blood_in_stool",
  stool_blood: "blood_in_stool",
  loose_stool: "diarrhea",
  loose_stools: "diarrhea",
  watery_stool: "watery_diarrhea",
  watery_stools: "watery_diarrhea",
  cramps: "stomach_cramps",
  crampy: "stomach_cramps",
  cramping: "stomach_cramps",
  abdominal_cramps: "stomach_cramps",
  diffuse_cramps: "stomach_cramps",
  crampy_abdominal_discomfort: "stomach_cramps",
  nausea_vomiting: "nausea",
  vomiting_or_nausea: "nausea",
  right_lower_quadrant_pain: "right_lower_abdominal_pain",
  rlq_pain: "right_lower_abdominal_pain",
  lower_right_pain: "right_lower_abdominal_pain",
  left_lower_quadrant_pain: "left_lower_abdominal_pain",
  llq_pain: "left_lower_abdominal_pain",
  lower_left_pain: "left_lower_abdominal_pain",
  right_upper_quadrant_pain: "right_upper_quadrant_pain",
  ruq_pain: "right_upper_quadrant_pain",
  upper_right_pain: "right_upper_quadrant_pain",
  upper_abdomen_pain: "upper_abdominal_pain",
  epigastric_abdominal_pain: "epigastric_pain",
  diffuse_abdominal_pain: "diffuse_abdominal_pain",
  indigestion: "burning_or_indigestion",
  heartburn: "burning_or_indigestion",
  flank_pain: "flank_or_groin_pain",
  groin_pain: "flank_or_groin_pain",
  bulge: "painful_bulge",
  migration: "pain_migration",
  movement_or_rebound: "movement_worsens_pain",
  movement_pain: "movement_worsens_pain",
  movement_pain_or_rebound_tenderness: "movement_worsens_pain",
  radiation_to_back: "radiation_to_back",
  radiates_back: "radiation_to_back",
  shoulder_or_back_radiation: "shoulder_or_back_radiation",
  postprandial_pain: "postprandial_pain",
  prolonged_episode: "prolonged_episode",
  pain_out_of_proportion: "pain_out_of_proportion",
  sudden_severe_pain: "sudden_severe_pain",
  vascular_risk_factors: "vascular_risk_factors",
  ill_appearance: "ill_appearance",
  altered_bowel_habits: "altered_bowel_habits",
  worsening_tenderness: "worsening_tenderness",
  older_age_or_prior_history: "older_age_or_prior_history",
  alcohol_or_gallstone_risk_factors: "alcohol_or_gallstone_risk_factors",
  hydration: "hydration_preserved",
  can_drink: "hydration_preserved",
  able_to_drink: "hydration_preserved",
  keeping_fluids_down: "hydration_preserved",
  can_keep_fluids_down: "hydration_preserved",
  can_keep_water_down: "hydration_preserved",
  normal_urination: "hydration_preserved",
  urination_normal: "hydration_preserved",
  urinating_normally: "hydration_preserved",
  unable_to_drink: "dehydration",
  urinary: "urinary_symptoms",
  dizziness: "dizziness_syncope",
  fainting: "dizziness_syncope",
  lightheadedness: "dizziness_syncope",
  constipation_or_no_stool: "abdominal_swelling_or_no_stool",
  abdominal_distension: "abdominal_swelling_or_no_stool",
  bloating: "abdominal_swelling_or_no_stool",
  worsening: "severe_or_worsening",
  severe_pain: "severe_or_worsening",
  medication: "medication_risk",
  nsaid_use: "medication_risk",
  anticoagulant: "medication_risk"
};

function canonicalizeSymptomId(symptomId: string): string {
  const normalized = symptomId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return llmSymptomIdAliases[normalized] ?? normalized;
}

function stripJsonFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function isValidStatus(status: unknown): status is ExtractedSymptom["status"] {
  return status === "present" || status === "absent" || status === "uncertain" || status === "not_mentioned";
}

function messageContainsEvidence(message: string, evidenceText: string): boolean {
  return message.toLowerCase().includes(evidenceText.toLowerCase());
}

function mergePatternDetectedSymptoms(
  symptoms: ExtractedSymptom[],
  latestMessage: string
): ExtractedSymptom[] {
  const byId = new Map(symptoms.map((symptom) => [symptom.symptomId, symptom]));
  const patternDetectedSymptoms = fallbackExtractSymptoms(latestMessage).extractedSymptoms;

  for (const symptom of patternDetectedSymptoms) {
    const existing = byId.get(symptom.symptomId);

    if (!existing || (symptom.status === "absent" && existing.status !== "absent")) {
      byId.set(symptom.symptomId, symptom);
    }
  }

  return [...byId.values()];
}

function sanitizeExtractionResult(value: unknown, latestMessage: string): SymptomExtractionAgentResult {
  const parsed = value as Partial<SymptomExtractionAgentResult>;
  const llmSymptoms = Array.isArray(parsed.extractedSymptoms)
    ? parsed.extractedSymptoms
        .map((item): ExtractedSymptom | null => {
          const symptom = item as Partial<ExtractedSymptom>;

          if (
            typeof symptom.symptomId !== "string" ||
            typeof symptom.label !== "string" ||
            !isValidStatus(symptom.status) ||
            typeof symptom.evidenceText !== "string"
          ) {
            return null;
          }

          const symptomId = canonicalizeSymptomId(symptom.symptomId);

          if (!canonicalSymptomIds.has(symptomId)) {
            return null;
          }

          const evidenceText = symptom.evidenceText.trim();

          if (!evidenceText || !messageContainsEvidence(latestMessage, evidenceText)) {
            return null;
          }

          return {
            symptomId,
            label: symptom.label,
            value: symptom.value ?? null,
            status: symptom.status,
            bodyLocation: symptom.bodyLocation ?? null,
            severity: symptom.severity ?? null,
            duration: symptom.duration ?? null,
            evidenceText,
            normalizedAliases: Array.isArray(symptom.normalizedAliases)
              ? symptom.normalizedAliases.filter((alias): alias is string => typeof alias === "string")
              : []
          };
        })
        .filter((item): item is ExtractedSymptom => item !== null)
    : [];
  const symptoms = mergePatternDetectedSymptoms(llmSymptoms, latestMessage);

  return {
    isSymptomDisclosure: symptoms.length > 0,
    nonSymptomInputType:
      parsed.nonSymptomInputType === "greeting" ||
      parsed.nonSymptomInputType === "question" ||
      parsed.nonSymptomInputType === "other"
        ? parsed.nonSymptomInputType
        : null,
    extractedSymptoms: symptoms,
    correctedMessage: typeof parsed.correctedMessage === "string" ? parsed.correctedMessage : undefined,
    extractionNotes: typeof parsed.extractionNotes === "string" ? parsed.extractionNotes : undefined
  };
}

function parseExtractionJson(text: string, latestMessage: string): SymptomExtractionAgentResult {
  const stripped = stripJsonFence(text);

  try {
    return sanitizeExtractionResult(JSON.parse(stripped) as unknown, latestMessage);
  } catch {
    const repaired = stripped
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, "$1");

    try {
      return sanitizeExtractionResult(JSON.parse(repaired) as unknown, latestMessage);
    } catch (error) {
      throw new Error(
        `Unable to parse Gemini symptom extraction JSON. ${
          error instanceof Error ? error.message : String(error)
        }. Raw response starts: ${stripped.slice(0, 1000)}`
      );
    }
  }
}

function classifyNonSymptomInput(message: string): SymptomExtractionAgentResult["nonSymptomInputType"] {
  if (/^(hi|hello|hey|good morning|good afternoon|thanks|thank you|ok|okay)\.?!?$/i.test(message.trim())) {
    return "greeting";
  }

  if (message.includes("?")) {
    return "question";
  }

  return "other";
}

function isLikelyNonDisclosureQuestion(message: string): boolean {
  const trimmed = message.trim();

  if (!trimmed.includes("?")) {
    return false;
  }

  const hasExplicitDisclosure =
    /\b(i have|i've had|i am having|i'm having|i feel|i felt|my .*hurts?|my .*pain|there is no|there's no|i do not have|i don't have|no blood|no fever)\b/i.test(trimmed);

  if (hasExplicitDisclosure) {
    return false;
  }

  return /^(what|why|how|can|could|should|would|do|does|is|are|tell me|please tell me)\b/i.test(trimmed);
}

function firstMatchingEvidence(message: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[0]) {
      return match[0];
    }
  }

  return message;
}

function fallbackExtractSymptoms(message: string): SymptomExtractionAgentResult {
  if (isLikelyNonDisclosureQuestion(message)) {
    return {
      isSymptomDisclosure: false,
      nonSymptomInputType: "question",
      extractedSymptoms: [],
      correctedMessage: message,
      extractionNotes: "Fallback extractor treated this as a non-disclosure question."
    };
  }

  const extractedSymptoms: ExtractedSymptom[] = [];
  const seen = new Set<string>();

  for (const template of symptomTemplates) {
    const absent = template.absentPatterns?.some((pattern) => pattern.test(message)) ?? false;
    const uncertain = template.uncertainPatterns?.some((pattern) => pattern.test(message)) ?? false;
    const present = template.presentPatterns.some((pattern) => pattern.test(message));

    if (!absent && !uncertain && !present) {
      continue;
    }

    if (seen.has(template.symptomId)) {
      continue;
    }

    seen.add(template.symptomId);
    const evidenceText = firstMatchingEvidence(
      message,
      absent
        ? template.absentPatterns ?? template.presentPatterns
        : uncertain
          ? template.uncertainPatterns ?? template.presentPatterns
          : template.presentPatterns
    );

    extractedSymptoms.push({
      symptomId: template.symptomId,
      label: template.label,
      value: absent ? false : uncertain ? null : true,
      status: absent ? "absent" : uncertain ? "uncertain" : "present",
      bodyLocation: template.bodyLocation ?? null,
      severity: /\b(severe|worst|unbearable|mild|moderate)\b/i.exec(message)?.[0] ?? null,
      duration: /\b(\d+\s*(hours?|hrs?|days?)|since (yesterday|this morning|last night)|started (yesterday|this morning|last night|\d+\s*(hours?|hrs?|days?) ago))\b/i.exec(message)?.[0] ?? null,
      evidenceText,
      normalizedAliases: template.aliases
    });
  }

  return {
    isSymptomDisclosure: extractedSymptoms.length > 0,
    nonSymptomInputType: extractedSymptoms.length > 0 ? null : classifyNonSymptomInput(message),
    extractedSymptoms,
    correctedMessage: message,
    extractionNotes: "Fallback extractor used because the LLM extractor was unavailable."
  };
}

function summarizeMemory(memory: ParticipantMemory): string {
  return memory.disclosedSymptoms.symptoms
    .map((symptom) => `${symptom.symptomId}: ${symptom.status}, evidence: ${symptom.evidenceText}`)
    .join("\n");
}

export async function extractSymptomsWithAgent({
  message,
  memory
}: {
  message: string;
  memory: ParticipantMemory;
}): Promise<SymptomExtractionAgentResult> {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return emptyExtractionResult;
  }

  const nonSymptomInputType = classifyNonSymptomInput(trimmedMessage);

  if (nonSymptomInputType === "greeting") {
    return {
      isSymptomDisclosure: false,
      nonSymptomInputType,
      extractedSymptoms: [],
      correctedMessage: trimmedMessage,
      extractionNotes: "Greeting detected without symptom disclosure."
    };
  }

const systemInstruction = `
You are the Symptom Extraction Agent for a self-triage research study.
Extract only symptoms explicitly stated by the participant in the latest message.
Use existing memory only to understand repeated references; do not invent symptoms.
Correct obvious typos, normalize wording, detect synonyms, negations, uncertainty, body location, severity, and duration.
Use only these symptomId values when a symptom is present, absent, or uncertain:
upper_abdominal_pain, epigastric_pain, burning_or_indigestion, left_lower_abdominal_pain,
flank_or_groin_pain, painful_bulge, watery_diarrhea, diarrhea, blood_in_stool, high_fever,
fever, stomach_cramps, vomiting, nausea, hydration_preserved, dehydration,
right_lower_abdominal_pain, pain_migration, movement_worsens_pain, generic_abdominal_pain,
abdominal_swelling_or_no_stool, urinary_symptoms, pregnancy_possible, dizziness_syncope,
severe_or_worsening, right_upper_quadrant_pain, diffuse_abdominal_pain, radiation_to_back,
shoulder_or_back_radiation, postprandial_pain, prolonged_episode, pain_out_of_proportion,
sudden_severe_pain, vascular_risk_factors, ill_appearance, altered_bowel_habits,
worsening_tenderness, older_age_or_prior_history, alcohol_or_gallstone_risk_factors,
medication_risk.
Map "diffuse crampy abdominal discomfort", "crampy abdominal discomfort", or "cramps" to stomach_cramps.
Map "can keep small sips of water down", "keeping fluids down", "can still drink", "urination normal", or "urinating normally" to hydration_preserved.
Map "no blood", "no blood in stool", "no black stool", or "not bloody" to blood_in_stool with status "absent".
Map "black sticky stool", "coffee grounds", or "blood in stool" to blood_in_stool with status "present".
Map "left lower abdominal pain" or "lower left pain" to left_lower_abdominal_pain.
Map "right upper abdominal pain", "upper right pain", or "RUQ pain" to right_upper_quadrant_pain.
Map pain spreading to the back to radiation_to_back; map pain spreading to the right shoulder to shoulder_or_back_radiation.
Map "upper abdominal pain", "upper stomach pain", or "burning upper abdominal pain" to upper_abdominal_pain; also extract burning_or_indigestion when burning/indigestion is stated.
Map pain after eating or fatty meals to postprandial_pain.
Map "pain out of proportion" to pain_out_of_proportion.
Map atrial fibrillation, vascular disease, or blood clot risk to vascular_risk_factors.
Map "ibuprofen", "NSAID", "blood thinner", "warfarin", or "aspirin" to medication_risk.
Preserve exact evidence text from the latest message; evidenceText must be a substring of the latest participant message.
Return strict JSON only. Do not include markdown.
`;

  const userPrompt = `
Existing disclosed symptom memory:
${summarizeMemory(memory) || "None"}

Latest participant message:
${message}

Return JSON matching this schema:
{
  "isSymptomDisclosure": boolean,
  "nonSymptomInputType": "greeting" | "question" | "other" | null,
  "extractedSymptoms": [
    {
      "symptomId": "snake_case_normalized_symptom",
      "label": "short participant-facing label",
      "value": string | boolean | number | null,
      "status": "present" | "absent" | "uncertain" | "not_mentioned",
      "bodyLocation": string | null,
      "severity": string | null,
      "duration": string | null,
      "evidenceText": "exact phrase from latest message",
      "normalizedAliases": ["synonym"]
    }
  ],
  "correctedMessage": string,
  "extractionNotes": string
}
`;

  try {
    const response = await generateGeminiResponse({
      systemInstruction,
      userPrompt,
      temperature: 0.1,
      maxOutputTokens: 6000,
      responseMimeType: "application/json"
    });

    return parseExtractionJson(response, message);
  } catch (error) {
    throw new Error(
      `Gemini symptom extraction failed. Agent-only mode does not allow fallback. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
