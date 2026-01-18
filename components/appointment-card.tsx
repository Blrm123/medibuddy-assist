"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Clock,
  User,
  Video,
  Stethoscope,
  X,
  Edit,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelAppointment,
  addAppointmentNotes,
  markAppointmentCompleted,
} from "@/actions/doctor";
import { generateVideoToken } from "@/actions/appointments";
import { useFetch } from "@/hooks/use-fetch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

/* ----------------------------------------------------
   TYPES
---------------------------------------------------- */

export interface OtherUser {
  id: string;
  name: string;
  email: string;
  specialty?: string;
}

export interface Appointment {
  id: string;
  startTime: Date;
  endTime: Date;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
  patientDescription?: string | null;

  patient: OtherUser;
  doctor: OtherUser;
}

export type UserRole = "DOCTOR" | "PATIENT";

interface AppointmentCardProps {
  appointment: Appointment;
  userRole: UserRole;
  refetchAppointments?: (() => Promise<void>) | (() => void);
}

/* ----------------------------------------------------
   COMPONENT
---------------------------------------------------- */

export function AppointmentCard({
  appointment,
  userRole,
  refetchAppointments,
}: AppointmentCardProps) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"cancel" | "notes" | "video" | "complete" | null>(null);
  const [notes, setNotes] = useState<string>(appointment.notes || "");

  const router = useRouter();

  /* ----------------------------------------------------
     FETCH HOOKS
  ---------------------------------------------------- */

  const { loading: cancelLoading, fn: submitCancel, data: cancelData } =
    useFetch(cancelAppointment);

  const { loading: notesLoading, fn: submitNotes, data: notesData } =
    useFetch(addAppointmentNotes);

  const { loading: tokenLoading, fn: submitTokenRequest, data: tokenData } =
    useFetch(generateVideoToken);

  const {
    loading: completeLoading,
    fn: submitMarkCompleted,
    data: completeData,
  } = useFetch(markAppointmentCompleted);

  /* ----------------------------------------------------
     HELPERS
  ---------------------------------------------------- */

  const formatDateTime = (date: Date) => {
    try {
      return format(date, "MMMM d, yyyy 'at' h:mm a");
    } catch {
      return "Invalid date";
    }
  };

  const formatTime = (date: Date) => {
    try {
      return format(date, "h:mm a");
    } catch {
      return "Invalid time";
    }
  };

  const canMarkCompleted = () => {
    if (userRole !== "DOCTOR" || appointment.status !== "SCHEDULED") return false;

    const now = new Date();
    return now >= appointment.endTime;
  };

  /* ----------------------------------------------------
     CANCEL APPOINTMENT
  ---------------------------------------------------- */
  const handleCancelAppointment = async () => {
    if (cancelLoading) return;

    if (window.confirm("Are you sure? This action cannot be undone.")) {
      const form = new FormData();
      form.append("appointmentId", appointment.id);
      await submitCancel(form);
    }
  };

  /* ----------------------------------------------------
     MARK COMPLETED
  ---------------------------------------------------- */
  const handleMarkCompleted = async () => {
    if (completeLoading) return;

    const now = new Date();
    if (now < appointment.endTime) {
      alert("Cannot mark as completed before end time.");
      return;
    }

    if (window.confirm("Mark appointment as completed?")) {
      const form = new FormData();
      form.append("appointmentId", appointment.id);
      await submitMarkCompleted(form);
    }
  };

  /* ----------------------------------------------------
     SAVE NOTES
  ---------------------------------------------------- */
  const handleSaveNotes = async () => {
    if (notesLoading || userRole !== "DOCTOR") return;

    const form = new FormData();
    form.append("appointmentId", appointment.id);
    form.append("notes", notes);

    await submitNotes(form);
  };

  /* ----------------------------------------------------
     JOIN VIDEO
  ---------------------------------------------------- */
  const handleJoinVideoCall = async () => {
    if (tokenLoading) return;

    setAction("video");

    const form = new FormData();
    form.append("appointmentId", appointment.id);

    await submitTokenRequest(form);
  };

  /* ----------------------------------------------------
     SIDE EFFECTS
  ---------------------------------------------------- */

  useEffect(() => {
    if (cancelData?.success) {
      toast.success("Appointment cancelled.");
      setTimeout(() => setOpen(false), 0);
      if (refetchAppointments) {
        void refetchAppointments();
      } else {
        router.refresh();
      }
    }
  }, [cancelData, refetchAppointments, router]);

  useEffect(() => {
    if (completeData?.success) {
      toast.success("Appointment completed.");
      setTimeout(() => setOpen(false), 0);
      if (refetchAppointments) {
        void refetchAppointments();
      } else {
        router.refresh();
      }
    }
  }, [completeData, refetchAppointments, router]);

  useEffect(() => {
    if (notesData?.success) {
      toast.success("Notes saved.");
      setTimeout(() => setAction(null), 0);
      if (refetchAppointments) {
        void refetchAppointments();
      } else {
        router.refresh();
      }
    }
  }, [notesData, refetchAppointments, router]);

  useEffect(() => {
    if (!tokenData) return;

    if (tokenData.success && tokenData.videoSessionId && tokenData.token) {
      router.push(
        `/video-call?sessionId=${tokenData.videoSessionId}&token=${tokenData.token}&appointmentId=${appointment.id}`
      );
      return;
    }

    if (!tokenData.success && tokenData.error) {
      toast.error(tokenData.error);
    }
  }, [tokenData, appointment.id, router]);

  /* ----------------------------------------------------
     APPOINTMENT ACTIVE CHECK (video access timing)
  ---------------------------------------------------- */

  const isAppointmentActive = () => {
    const now = new Date();
    const minutesBefore = 30 * 60 * 1000;

    return (
      (appointment.startTime.getTime() - now.getTime() <= minutesBefore && now < appointment.startTime) ||
      (now >= appointment.startTime && now <= appointment.endTime)
    );
  };

  /* ----------------------------------------------------
     WHO IS THE OTHER PARTY?
  ---------------------------------------------------- */
  const otherParty = userRole === "DOCTOR" ? appointment.patient : appointment.doctor;

  const otherPartyLabel = userRole === "DOCTOR" ? "Patient" : "Doctor";
  const otherPartyIcon = userRole === "DOCTOR" ? <User /> : <Stethoscope />;

  /* ----------------------------------------------------
     RENDER
  ---------------------------------------------------- */
  return (
    <>
      <Card className="border-emerald-900/20 hover:border-emerald-700/30 transition-all">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            {/* Left Section */}
            <div className="flex items-start gap-3">
              <div className="bg-muted/20 rounded-full p-2 mt-1">
                {otherPartyIcon}
              </div>
              <div>
                <h3 className="font-medium text-white">
                  {userRole === "DOCTOR" ? otherParty.name : `Dr. ${otherParty.name}`}
                </h3>

                {userRole === "DOCTOR" && (
                  <p className="text-sm text-muted-foreground">{otherParty.email}</p>
                )}

                {userRole === "PATIENT" && (
                  <p className="text-sm text-muted-foreground">{otherParty.specialty}</p>
                )}

                <div className="flex items-center mt-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>{formatDateTime(appointment.startTime)}</span>
                </div>

                <div className="flex items-center mt-1 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>
                    {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex flex-col gap-2 self-end md:self-start">
              <Badge
                variant="outline"
                className={
                  appointment.status === "COMPLETED"
                    ? "bg-emerald-900/20 border-emerald-900/30 text-emerald-400"
                    : appointment.status === "CANCELLED"
                    ? "bg-red-900/20 border-red-900/30 text-red-400"
                    : "bg-amber-900/20 border-amber-900/30 text-amber-400"
                }
              >
                {appointment.status}
              </Badge>

              <div className="flex gap-2 mt-2 flex-wrap">
                {canMarkCompleted() && (
                  <Button
                    size="sm"
                    onClick={handleMarkCompleted}
                    disabled={completeLoading}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {completeLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Complete
                      </>
                    )}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-900/30"
                  onClick={() => setOpen(true)}
                >
                  View Details
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------
         DETAILS DIALOG
      ---------------------------------------------------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Appointment Details
            </DialogTitle>
            <DialogDescription>
              {appointment.status === "SCHEDULED"
                ? "Manage your appointment"
                : "View appointment information"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* OTHER PARTY INFO */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">{otherPartyLabel}</h4>

              <div className="flex items-center">
                <div className="h-5 w-5 text-emerald-400 mr-2">{otherPartyIcon}</div>
                <div>
                  <p className="text-white font-medium">
                    {userRole === "DOCTOR" ? otherParty.name : `Dr. ${otherParty.name}`}
                  </p>

                  {userRole === "DOCTOR" && (
                    <p className="text-muted-foreground text-sm">{otherParty.email}</p>
                  )}

                  {userRole === "PATIENT" && (
                    <p className="text-muted-foreground text-sm">{otherParty.specialty}</p>
                  )}
                </div>
              </div>
            </div>

            {/* TIME */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Scheduled Time</h4>
              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-emerald-400 mr-2" />
                  <p className="text-white">{formatDateTime(appointment.startTime)}</p>
                </div>

                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-emerald-400 mr-2" />
                  <p className="text-white">
                    {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                  </p>
                </div>
              </div>
            </div>

            {/* STATUS */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
              <Badge
                variant="outline"
                className={
                  appointment.status === "COMPLETED"
                    ? "bg-emerald-900/20 border-emerald-900/30 text-emerald-400"
                    : appointment.status === "CANCELLED"
                    ? "bg-red-900/20 border-red-900/30 text-red-400"
                    : "bg-amber-900/20 border-amber-900/30 text-amber-400"
                }
              >
                {appointment.status}
              </Badge>
            </div>

            {appointment.patientDescription && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {userRole === "DOCTOR" ? "Patient Description" : "Your Description"}
                </h4>

                <div className="p-3 rounded-md bg-muted/20 border border-emerald-900/20">
                  <p className="text-white whitespace-pre-line">
                    {appointment.patientDescription}
                  </p>
                </div>
              </div>
            )}

            {/* VIDEO CALL */}
            {appointment.status === "SCHEDULED" && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Video Consultation
                </h4>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={!isAppointmentActive() || tokenLoading}
                  onClick={handleJoinVideoCall}
                >
                  {tokenLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing Video Call...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 mr-2" />
                      {isAppointmentActive()
                        ? "Join Video Call"
                        : "Video call available 30 minutes before appointment"}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* DOCTOR NOTES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">Doctor Notes</h4>

                {userRole === "DOCTOR" &&
                  action !== "notes" &&
                  appointment.status !== "CANCELLED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAction("notes")}
                      className="h-7 text-emerald-400 hover:bg-emerald-900/20"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      {appointment.notes ? "Edit" : "Add"}
                    </Button>
                  )}
              </div>

              {userRole === "DOCTOR" && action === "notes" ? (
                <div className="space-y-3">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter your clinical notes..."
                    className="bg-background border-emerald-900/20 min-h-[100px]"
                  />

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAction(null);
                        setNotes(appointment.notes || "");
                      }}
                      disabled={notesLoading}
                      className="border-emerald-900/30"
                    >
                      Cancel
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={notesLoading}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {notesLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Notes"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-md bg-muted/20 border border-emerald-900/20 min-h-[80px]">
                  {appointment.notes ? (
                    <p className="text-white whitespace-pre-line">
                      {appointment.notes}
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic">No notes added yet</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* FOOTER BUTTONS */}
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
            <div className="flex gap-2">
              {canMarkCompleted() && (
                <Button
                  onClick={handleMarkCompleted}
                  disabled={completeLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {completeLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark Complete
                    </>
                  )}
                </Button>
              )}

              {appointment.status === "SCHEDULED" && (
                <Button
                  variant="outline"
                  onClick={handleCancelAppointment}
                  disabled={cancelLoading}
                  className="border-red-900/30 text-red-400 hover:bg-red-900/10 mt-3 sm:mt-0"
                >
                  {cancelLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelling...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-1" />
                      Cancel Appointment
                    </>
                  )}
                </Button>
              )}
            </div>

            <Button onClick={() => setOpen(false)} className="bg-emerald-600 hover:bg-emerald-700">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
