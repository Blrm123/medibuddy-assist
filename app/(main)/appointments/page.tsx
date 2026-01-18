import { getPatientAppointments } from "@/actions/patient";
import {
  AppointmentCard,
  type Appointment as AppointmentCardAppointment,
} from "@/components/appointment-card";
import { PageHeader } from "@/components/page-header";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/actions/onboarding";

export default async function PatientAppointmentsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "PATIENT") {
    redirect("/onboarding");
  }

  const { appointments, error } = await getPatientAppointments();

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        icon={<Calendar />}
        title="My Appointments"
        backLink="/doctors"
        backLabel="Find Doctors"
      />

      <Card className="border-emerald-900/20">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-emerald-400" />
            Your Scheduled Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <p className="text-red-400">Error: {error}</p>
            </div>
          ) : appointments && appointments.length > 0 ? (
            <div className="space-y-4">
              {appointments.map((appointment) => {
                const cardAppointment: AppointmentCardAppointment = {
                  id: appointment.id,
                  startTime: appointment.startTime,
                  endTime: appointment.endTime,
                  status: appointment.status as AppointmentCardAppointment["status"],
                  // These fields may or may not exist depending on schema; default to null/empty.
                  notes: ("notes" in appointment ? appointment.notes : null) ?? null,
                  patientDescription: ("patientDescription" in appointment ? appointment.patientDescription : null) ?? null,
                  doctor: {
                    id: appointment.doctor.id,
                    name: appointment.doctor.name ?? "Unknown",
                    email: "",
                    specialty: appointment.doctor.specialty ?? "",
                  },
                  // Patient fields are not used when userRole="PATIENT", but required by the type.
                  patient: {
                    id: "",
                    name: "",
                    email: "",
                  },
                };

                return (
                  <AppointmentCard
                    key={cardAppointment.id}
                    appointment={cardAppointment}
                    userRole="PATIENT"
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-xl font-medium text-white mb-2">
                No appointments scheduled
              </h3>
              <p className="text-muted-foreground">
                You don&apos;t have any appointments scheduled yet. Browse our
                doctors and book your first consultation.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
