import type { Metadata } from "next";
import { PageHeader, SyntheticBadge } from "@/components/common";
import { ALL_ASSUMPTIONS } from "./_data";
import { AssumptionsRegister } from "./_components/AssumptionsRegister";

export const metadata: Metadata = {
  title: "Assumptions register",
  description: "Every labelled assumption behind OneRecord's process, data and business case, with its value and basis.",
};

export default function AssumptionsPage() {
  return (
    <div className="w-full pb-6">
      <PageHeader
        title="Assumptions register"
        meta={<SyntheticBadge label="Illustrative where marked" />}
        subtitle={`The brief leaves many numbers open, so we wrote ours down. ${ALL_ASSUMPTIONS.length} labelled assumptions, each with its value, where it comes from, and where it shows up in the prototype.`}
      />
      <AssumptionsRegister />
    </div>
  );
}
