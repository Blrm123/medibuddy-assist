"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const CREDIT_VALUE = 10; // $10 per credit total
const PLATFORM_FEE_PER_CREDIT = 2; // $2 platform fee
const DOCTOR_EARNINGS_PER_CREDIT = 8; // $8 to doctor

/**
 * Request payout for all remaining credits
 */
export async function requestPayout(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const doctor = await db.user.findUnique({
      where: {
        clerkUserId: userId,
        role: "DOCTOR",
      },
    });

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const paypalEmailEntry = formData.get("paypalEmail");

    if (!paypalEmailEntry || typeof paypalEmailEntry !== "string") {
      throw new Error("PayPal email is required");
    }

    // Check if doctor has any pending payout requests
    const existingPendingPayout = await db.payout.findFirst({
      where: {
        doctorId: doctor.id,
        status: "PROCESSING",
      },
    });

    if (existingPendingPayout) {
      throw new Error(
        "You already have a pending payout request. Please wait for it to be processed."
      );
    }

    // Get doctor's current credit balance
    const creditCount = doctor.credits;

    if (creditCount === 0) {
      throw new Error("No credits available for payout");
    }

    if (creditCount < 1) {
      throw new Error("Minimum 1 credit required for payout");
    }

    const totalAmount = creditCount * CREDIT_VALUE;
    const platformFee = creditCount * PLATFORM_FEE_PER_CREDIT;
    const netAmount = creditCount * DOCTOR_EARNINGS_PER_CREDIT;

    // Create payout request
    const payout = await db.payout.create({
      data: {
        doctorId: doctor.id,
        amount: totalAmount,
        credits: creditCount,
        platformFee,
        netAmount,
        paypalEmail: paypalEmailEntry,
        status: "PROCESSING",
      },
    });

    revalidatePath("/doctor");
    return { success: true, payout };
  } catch (error: unknown) {
    console.error("Failed to request payout:", error);

    if (error instanceof Error) {
      throw new Error("Failed to request payout: " + error.message);
    }

    throw new Error("Failed to request payout");
  }
}

/**
 * Get doctor's payout history
 */
export async function getDoctorPayouts() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const doctor = await db.user.findUnique({
      where: {
        clerkUserId: userId,
        role: "DOCTOR",
      },
    });

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const payouts = await db.payout.findMany({
      where: {
        doctorId: doctor.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { payouts };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error("Failed to fetch payouts: " + error.message);
    }

    throw new Error("Failed to fetch payouts");
  }
}

/**
 * Get doctor's earnings summary
 */
export async function getDoctorEarnings() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const doctor = await db.user.findUnique({
      where: {
        clerkUserId: userId,
        role: "DOCTOR",
      },
    });

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    // Get all completed appointments for this doctor
    const completedAppointments = await db.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: "COMPLETED",
      },
    });

    // Calculate this month's completed appointments
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const thisMonthAppointments = completedAppointments.filter(
      (appointment) => new Date(appointment.createdAt) >= currentMonth
    );

    // Base earnings for this month from completed appointments
    const thisMonthGrossEarnings =
      thisMonthAppointments.length * 2 * DOCTOR_EARNINGS_PER_CREDIT;

    // Subtract processed payouts in this month to show net earnings
    const thisMonthProcessedPayouts = await db.payout.findMany({
      where: {
        doctorId: doctor.id,
        status: "PROCESSED",
        processedAt: {
          gte: currentMonth,
        },
      },
    });

    const thisMonthPaidOut = thisMonthProcessedPayouts.reduce(
      (sum, payout) => sum + payout.netAmount,
      0
    );

    const thisMonthEarnings = Math.max(
      0,
      thisMonthGrossEarnings - thisMonthPaidOut
    );

    // Use doctor's actual credits from the user model for lifetime earnings
    const totalEarnings = doctor.credits * DOCTOR_EARNINGS_PER_CREDIT; // $8 per credit to doctor

    // Simple average per month calculation
    const averageEarningsPerMonth =
      totalEarnings > 0
        ? totalEarnings / Math.max(1, new Date().getMonth() + 1)
        : 0;

    // Get current credit balance for payout calculations
    const availableCredits = doctor.credits;
    const availablePayout = availableCredits * DOCTOR_EARNINGS_PER_CREDIT;

    return {
      earnings: {
        totalEarnings,
        thisMonthEarnings,
        completedAppointments: completedAppointments.length,
        averageEarningsPerMonth,
        availableCredits,
        availablePayout,
      },
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error("Failed to fetch doctor earnings: " + error.message);
    }

    throw new Error("Failed to fetch doctor earnings");
  }
}
