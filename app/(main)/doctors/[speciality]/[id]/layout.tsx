import { getDoctorById } from "@/actions/appointments";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import type { ReactNode } from "react";

interface DoctorProfileLayoutParams {
  speciality: string;
  id: string;
}

export async function generateMetadata({
  params,
}: {
  params: DoctorProfileLayoutParams;
}) {
  const { id } = params;

  const { doctor } = await getDoctorById(id);
  return {
    title: `Dr. ${doctor.name} - MediBuddy`,
    description: `Book an appointment with Dr. ${doctor.name}, ${doctor.specialty} specialist with ${doctor.experience} years of experience.`,
  };
}

export default async function DoctorProfileLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: DoctorProfileLayoutParams;
}) {
  const { id } = params;
  const { doctor } = await getDoctorById(id);

  if (!doctor) redirect("/doctors");

  return (
    <div className="container mx-auto">
      <PageHeader
        // icon={<Stethoscope />}
        title={"Dr. " + doctor.name}
        backLink={`/doctors/${doctor.specialty}`}
        backLabel={`Back to ${doctor.specialty}`}
      />

      {children}
    </div>
  );
}
