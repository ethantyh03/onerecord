import type { ComponentType } from "react";
import type { SlideProps } from "../primitives";
import type { SlideId } from "../slides-config";
import { A1Alternatives, A2WhoBuilds, A3Payback, A4DuplicateCheck, A5RealData, A6Forecast, A7Controls, A8SapLandingScope } from "./appendix";
import { S09Regional, S10Impact, S11BusinessCase } from "./after-demo";
import { S12Pilot, S13Risks, S14Close } from "./closing";
import { S03ThreeRecords, S04Merged } from "./duplicates";
import { S08DemoHandoff } from "./handoff";
import { S07OnePicture } from "./one-picture";
import { S01Title, S02Hook } from "./opening";
import { S05RootCauses, S06Principles } from "./problem";

export const SLIDE_COMPONENTS: Record<SlideId, ComponentType<SlideProps>> = {
  "s01-title": S01Title,
  "s02-hook": S02Hook,
  "s03-three-records": S03ThreeRecords,
  "s04-merged": S04Merged,
  "s05-root-causes": S05RootCauses,
  "s06-principles": S06Principles,
  "s07-one-picture": S07OnePicture,
  "s08-demo-handoff": S08DemoHandoff,
  "s09-regional": S09Regional,
  "s10-impact": S10Impact,
  "s11-business-case": S11BusinessCase,
  "s12-pilot": S12Pilot,
  "s13-risks": S13Risks,
  "s14-close": S14Close,
  "a1-alternatives": A1Alternatives,
  "a2-who-builds": A2WhoBuilds,
  "a3-payback": A3Payback,
  "a4-duplicate-check": A4DuplicateCheck,
  "a5-real-data": A5RealData,
  "a6-forecast": A6Forecast,
  "a7-controls": A7Controls,
  "a8-sap-landing-and-scope": A8SapLandingScope,
};
