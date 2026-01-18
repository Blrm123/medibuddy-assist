import { getDoctorById } from "@/actions/appointments";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import type { ReactNode } from "react";

type DoctorParams = {
  speciality: string;
  id: string;
};

/* ✅ generateMetadata MUST use sync params */
export async function generateMetadata({
  params,
}: {
  params: DoctorParams;
}) {
  const { id } = params;

  const { doctor } = await getDoctorById(id);

  return {
    title: `Dr. ${doctor.name} - MediBuddy`,
    description: `Book an appointment with Dr. ${doctor.name}, ${doctor.specialty} specialist with ${doctor.experience} years of experience.`,
  };
}

/* ✅ layout params IS async */
export default async function DoctorProfileLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<DoctorParams>;
}) {
  const { id } = await params;
  const { doctor } = await getDoctorById(id);

  if (!doctor) redirect("/doctors");

  return (
    <div className="container mx-auto">
      <PageHeader
        title={`Dr. ${doctor.name}`}
        backLink={`/doctors/${doctor.specialty}`}
        backLabel={`Back to ${doctor.specialty}`}
      />

      {children}
    </div>
  );
}
