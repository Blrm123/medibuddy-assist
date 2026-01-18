import { getDoctorById, getAvailableTimeSlots } from "@/actions/appointments";
import { DoctorProfile } from "./_components/doctor-profile";
import { redirect } from "next/navigation";

interface DoctorProfilePageParams {
  speciality: string;
  id: string;
}

export default async function DoctorProfilePage({
  params,
}: {
  params: DoctorProfilePageParams;
}) {
  const { id } = params;
  let doctorData;
  let slotsData;

  try {
    // Fetch doctor data and available slots in parallel
    [doctorData, slotsData] = await Promise.all([
      getDoctorById(id),
      getAvailableTimeSlots(id),
    ]);
  } catch (error) {
    console.error("Error loading doctor profile:", error);
    redirect("/doctors");
  }

  return (
    <DoctorProfile
      doctor={doctorData.doctor}
      availableDays={slotsData.days || []}
    />
  );
}
