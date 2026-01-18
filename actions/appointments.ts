"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { deductCreditsForAppointment } from "@/actions/credits";
import { Vonage } from "@vonage/server-sdk";
import { addDays, addMinutes, format, isBefore, endOfDay } from "date-fns";
import { Auth } from "@vonage/auth";

/* -----------------------------------------------------------
   TYPES
------------------------------------------------------------ */

export interface BookAppointmentResponse {
  success: boolean;
  appointment?: unknown;
  error?: string;
}

export interface TokenResponse {
  success: boolean;
  videoSessionId?: string;
  token?: string;
  error?: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  formatted: string;
  day: string;
}

export interface TimeSlotDay {
  date: string;
  displayDate: string;
  slots: TimeSlot[];
}

/* -----------------------------------------------------------
   VONAGE VIDEO CLIENT
------------------------------------------------------------ */

// Initialize Vonage Video API client
const credentials = new Auth({
  applicationId: process.env.NEXT_PUBLIC_VONAGE_APPLICATION_ID!,
  privateKey: process.env.VONAGE_PRIVATE_KEY!,
});
const vonage = new Vonage(credentials, {});

/**
 * Book a new appointment with a doctor
 */
export async function bookAppointment(
  formData: FormData
): Promise<BookAppointmentResponse> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Get the patient user
    const patient = await db.user.findUnique({
      where: {
        clerkUserId: userId,
        role: "PATIENT",
      },
    });

    if (!patient) {
      throw new Error("Patient not found");
    }

    // Parse form data
    const doctorId = formData.get("doctorId") as string | null;
    const startTimeStr = formData.get("startTime") as string | null;
    const endTimeStr = formData.get("endTime") as string | null;
    const patientDescription = (formData.get("description") as string | null) || null;

    // Validate input
    if (!doctorId || !startTimeStr || !endTimeStr) {
      return {
        success: false,
        error: "Doctor, start time, and end time are required",
      };
    }

    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    // Check if the doctor exists and is verified
    const doctor = await db.user.findUnique({
      where: {
        id: doctorId,
        role: "DOCTOR",
        verificationStatus: "VERIFIED",
      },
    });

    if (!doctor) {
      return { success: false, error: "Doctor not found or not verified" };
    }

    // Check if the patient has enough credits (2 credits per appointment)
    if (patient.credits < 2) {
      return { success: false, error: "Insufficient credits" };
    }

    // Check if the requested time slot is available
    const overlappingAppointment = await db.appointment.findFirst({
      where: {
        doctorId: doctorId,
        status: "SCHEDULED",
        OR: [
          {
            // New appointment starts during an existing appointment
            startTime: {
              lte: startTime,
            },
            endTime: {
              gt: startTime,
            },
          },
          {
            // New appointment ends during an existing appointment
            startTime: {
              lt: endTime,
            },
            endTime: {
              gte: endTime,
            },
          },
          {
            // New appointment completely overlaps an existing appointment
            startTime: {
              gte: startTime,
            },
            endTime: {
              lte: endTime,
            },
          },
        ],
      },
    });

    if (overlappingAppointment) {
      return { success: false, error: "This time slot is already booked" };
    }

    // Create a new Vonage Video API session
    const sessionId = await createVideoSession();

    // Deduct credits from patient and add to doctor
    const { success, error } = await deductCreditsForAppointment(
      patient.id,
      doctor.id
    );

    if (!success) {
      return { success: false, error: error || "Failed to deduct credits" };
    }

    // Create the appointment with the video session ID
    const appointment = await db.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        startTime,
        endTime,
        patientDescription,
        status: "SCHEDULED",
        videoSessionId: sessionId, // Store the Vonage session ID
      },
    });

    revalidatePath("/appointments");
    return { success: true, appointment };
  } catch (error: unknown) {
    console.error("booking error:", error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "Failed to book appointment" };
  }
}

/**
 * Generate a Vonage Video API session
 */
async function createVideoSession(): Promise<string> {
  try {
    const session = await vonage.video.createSession();
    return session.sessionId;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error("Failed to create video session: " + error.message);
    }

    throw new Error("Failed to create video session");
  }
}

/**
 * Generate a token for a video session
 * This will be called when either doctor or patient is about to join the call
 */
export async function generateVideoToken(
  formData: FormData
): Promise<TokenResponse> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const appointmentId = formData.get("appointmentId") as string | null;

    if (!appointmentId) {
      return { success: false, error: "Appointment ID is required" };
    }

    // Find the appointment and verify the user is part of it
    const appointment = await db.appointment.findUnique({
      where: {
        id: appointmentId,
      },
    });

    if (!appointment) {
      return { success: false, error: "Appointment not found" };
    }

    // Verify the user is either the doctor or the patient for this appointment
    if (appointment.doctorId !== user.id && appointment.patientId !== user.id) {
      return {
        success: false,
        error: "You are not authorized to join this call",
      };
    }

    // Verify the appointment is scheduled
    if (appointment.status !== "SCHEDULED") {
      return { success: false, error: "Appointment not scheduled" };
    }

    // Verify the appointment is within a valid time range (e.g., starting 5 minutes before scheduled time)
    const now = new Date();
    const appointmentTime = new Date(appointment.startTime);
    const timeDifference =
      (appointmentTime.getTime() - now.getTime()) / (1000 * 60); // difference in minutes

    if (timeDifference > 30) {
      return {
        success: false,
        error: "Call available 30 minutes before start time",
      };
    }

    // Generate a token for the video session
    // Token expires 2 hours after the appointment start time
    const appointmentEndTime = new Date(appointment.endTime);
    const expirationTime =
      Math.floor(appointmentEndTime.getTime() / 1000) + 60 * 60; // 1 hour after end time

    // Use user's name and role as connection data
    const connectionData = JSON.stringify({
      name: user.name,
      role: user.role,
      userId: user.id,
    });

    // Generate the token with appropriate role and expiration
    const token = vonage.video.generateClientToken(appointment.videoSessionId || "", {
      role: "publisher", // Both doctor and patient can publish streams
      expireTime: expirationTime,
      data: connectionData,
    });

    // Update the appointment with the token
    await db.appointment.update({
      where: {
        id: appointmentId,
      },
      data: {
        videoSessionToken: token,
      },
    });

    return {
      success: true,
      videoSessionId: appointment.videoSessionId!,
      token,
    };
  } catch (error: unknown) {
    console.error("token error:", error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "Failed to generate video token" };
  }
}

/**
 * Get doctor by ID
 */
export async function getDoctorById(doctorId: string) {
  try {
    const doctor = await db.user.findUnique({
      where: {
        id: doctorId,
        role: "DOCTOR",
        verificationStatus: "VERIFIED",
      },
    });

    if (!doctor) throw new Error("Doctor not found");

    return { doctor };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error("Failed to fetch doctor details: " + error.message);
    }

    throw new Error("Failed to fetch doctor details");
  }
}

/**
 * Get available time slots for booking for the next 4 days
 */
export async function getAvailableTimeSlots(
  doctorId: string
): Promise<{ days: TimeSlotDay[] }> {
  try {
    // Validate doctor existence and verification
    const doctor = await db.user.findUnique({
      where: {
        id: doctorId,
        role: "DOCTOR",
        verificationStatus: "VERIFIED",
      },
    });

    if (!doctor) {
      throw new Error("Doctor not found or not verified");
    }

    // Fetch a single availability record
    const availability = await db.availability.findFirst({
      where: {
        doctorId: doctor.id,
        status: "AVAILABLE",
      },
    });

    if (!availability) throw new Error("No availability set by doctor");

    // Get the next 4 days
    const now = new Date();
    const days = [now, addDays(now, 1), addDays(now, 2), addDays(now, 3)];

    // Fetch existing appointments for the doctor over the next 4 days
    const lastDay = endOfDay(days[3]);
    const existingAppointments = await db.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: "SCHEDULED",
        startTime: {
          lte: lastDay,
        },
      },
    });

    const availableSlotsByDay: Record<string, TimeSlot[]> = {};

    // For each of the next 4 days, generate available slots
    for (const day of days) {
      const dayString = format(day, "yyyy-MM-dd");
      availableSlotsByDay[dayString] = [];

      // Create a copy of the availability start/end times for this day
      const availabilityStart = new Date(availability.startTime);
      const availabilityEnd = new Date(availability.endTime);

      // Set the day to the current day we're processing
      availabilityStart.setFullYear(
        day.getFullYear(),
        day.getMonth(),
        day.getDate()
      );
      availabilityEnd.setFullYear(
        day.getFullYear(),
        day.getMonth(),
        day.getDate()
      );

      let current = new Date(availabilityStart);
      const end = new Date(availabilityEnd);

      while (
        isBefore(addMinutes(current, 30), end) ||
        +addMinutes(current, 30) === +end
      ) {
        const next = addMinutes(current, 30);

        // Skip past slots
        if (isBefore(current, now)) {
          current = next;
          continue;
        }

        const overlaps = existingAppointments.some((appointment) => {
          const aStart = new Date(appointment.startTime);
          const aEnd = new Date(appointment.endTime);

          return (
            (current >= aStart && current < aEnd) ||
            (next > aStart && next <= aEnd) ||
            (current <= aStart && next >= aEnd)
          );
        });

        if (!overlaps) {
          availableSlotsByDay[dayString].push({
            startTime: current.toISOString(),
            endTime: next.toISOString(),
            formatted: `${format(current, "h:mm a")} - ${format(
              next,
              "h:mm a"
            )}`,
            day: format(current, "EEEE, MMMM d"),
          });
        }

        current = next;
      }
    }

    // Convert to array of slots grouped by day for easier consumption by the UI
    const result: TimeSlotDay[] = Object.entries(availableSlotsByDay).map(
      ([date, slots]) => ({
      date,
      displayDate:
        slots.length > 0
          ? slots[0].day
          : format(new Date(date), "EEEE, MMMM d"),
      slots,
    })
    );

    return { days: result };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error("Failed to fetch available slots: " + error.message);
    }

    throw new Error("Failed to fetch available slots");
  }
}
