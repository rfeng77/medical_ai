import { Router } from "express";
import casesData from "../data/simulatedAbdominalPainCases.json";

const router = Router();

router.get("/", (_req, res) => {
  const cases = casesData.cases.map((caseItem) => ({
    caseId: caseItem.caseId,
    label: caseItem.label,
    openingComplaint: caseItem.openingComplaint,
    patientCard: "patientCard" in caseItem ? caseItem.patientCard : undefined,
  }));

  res.json({ cases });
});

export default router;