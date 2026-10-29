import type { Metadata } from "next";
import { PageHeader } from "@/components/common";
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
        subtitle={`${ALL_ASSUMPTIONS.length} labelled assumptions behind OneRecord's process, data and business case, each with its value, basis and where it's used.`}
      />
      <AssumptionsRegister />
    </div>
  );
}
