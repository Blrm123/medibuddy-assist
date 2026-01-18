"use server";

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { auth } from "@clerk/nextjs/server";
import type { User, CreditTransaction } from "@prisma/client";

export type UserWithTransactions = User & {
  transactions: CreditTransaction[];
};

// Monthly credit allocation per subscription plan
const PLAN_CREDITS = {
  free_user: 2,
  standard: 10,
  premium: 24,
};

// Each appointment costs 2 credits
const APPOINTMENT_CREDIT_COST = 2;

/**
 * Allocate monthly credits based on active subscription
 */
export async function checkAndAllocateCredits(user: UserWithTransactions) {
  try {
    if (!user) return null;

    // Only allocate credits to patients
    if (user.role !== "PATIENT") return user;

    const { has: hasSubscription } = await auth();

    const hasBasic = hasSubscription({ plan: "free_user" });
    const hasStandard = hasSubscription({ plan: "standard" });
    const hasPremium = hasSubscription({ plan: "premium" });

    let currentPlan = null;
    let creditsToAllocate = 0;

    if (hasPremium) {
      currentPlan = "premium";
      creditsToAllocate = PLAN_CREDITS.premium;
    } else if (hasStandard) {
      currentPlan = "standard";
      creditsToAllocate = PLAN_CREDITS.standard;
    } else if (hasBasic) {
      currentPlan = "free_user";
      creditsToAllocate = PLAN_CREDITS.free_user;
    }

    // If no subscription → exit
    if (!currentPlan) return user;

   // Check if we already allocated credits for this month
    const currentMonth = format(new Date(), "yyyy-MM");

    // If there's a transaction this month, check if it's for the same plan
    if (user.transactions.length > 0) {
      const latestTransaction = user.transactions[0];
      const transactionMonth = format(
        new Date(latestTransaction.createdAt),
        "yyyy-MM"
      );
      const transactionPlan = latestTransaction.packageId;

      // If we already allocated credits for this month and the plan is the same, just return
      if (
        transactionMonth === currentMonth &&
        transactionPlan === currentPlan
      ) {
        return user;
      }
    }

    // Allocate credits
    const updatedUser = await db.$transaction(async (tx) => {
      // Create transaction record
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: creditsToAllocate,
          type: "CREDIT_PURCHASE",
          packageId: currentPlan,
        },
      });

      // Update user balance
      return tx.user.update({
        where: { id: user.id },
        data: {
          credits: { increment: creditsToAllocate },
        },
      });
    });

    // Revalidate pages
    revalidatePath("/doctors");
    revalidatePath("/appointments");

    return updatedUser;
  } catch (error) {
    console.error("Failed to allocate credits:", error);
    return null;
  }
}
/**
 * Deducts credits for booking an appointment
 */
export async function deductCreditsForAppointment(userId: string, doctorId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    const doctor = await db.user.findUnique({
      where: { id: doctorId },
    });

    // Ensure user exists
    if (!user) {
      throw new Error("User not found");
    }

    // Ensure user has sufficient credits
    if (user.credits < APPOINTMENT_CREDIT_COST) {
      throw new Error("Insufficient credits to book an appointment");
    }

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    // Deduct credits from patient and add to doctor
    const result = await db.$transaction(async (tx) => {
      // Create transaction record for patient (deduction)
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -APPOINTMENT_CREDIT_COST,
          type: "APPOINTMENT_DEDUCTION",
        },
      });

      // Create transaction record for doctor (addition)
      await tx.creditTransaction.create({
        data: {
          userId: doctor.id,
          amount: APPOINTMENT_CREDIT_COST,
          type: "APPOINTMENT_DEDUCTION", // Using same type for consistency
        },
      });

      // Update patient's credit balance (decrement)
      const updatedUser = await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          credits: {
            decrement: APPOINTMENT_CREDIT_COST,
          },
        },
      });

      // Update doctor's credit balance (increment)
      await tx.user.update({
        where: {
          id: doctor.id,
        },
        data: {
          credits: {
            increment: APPOINTMENT_CREDIT_COST,
          },
        },
      });

      return updatedUser;
    });

    return { success: true, user: result };
  } catch (error: unknown) {
    console.error("Failed to deduct credits:", error);

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "Failed to deduct credits" };
  }
}
