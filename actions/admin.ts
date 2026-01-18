"use server";

import type { User, VerificationStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

/** ---------- TYPES ---------- **/
interface ActionResponse {
  success?: boolean;
  redirect?: string;
  error?: string;
}

interface PayoutWithDoctor {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  doctorId: string;
  amount: number;
  credits: number;
  platformFee: number;
  netAmount: number;
  paypalEmail: string;
  status: string;
  processedAt: Date | null;
  processedBy: string | null;
  doctor: {
    id: string;
    name: string | null;
    email: string | null;
    specialty: string | null;
    credits: number;
  };
}

/** ---------- VERIFY ADMIN ---------- **/
export async function verifyAdmin(): Promise<boolean> {
  const { userId } = await auth();

  if (!userId) return false;

  try {
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    return user?.role === "ADMIN";
  } catch (error) {
    console.error("Failed to verify admin:", error);
    return false;
  }
}

/** ---------- GET PENDING DOCTORS ---------- **/
export async function getPendingDoctors(): Promise<{ doctors?: User[] }> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) throw new Error("Unauthorized");

  try {
    const pendingDoctors = await db.user.findMany({
      where: {
        role: "DOCTOR",
        verificationStatus: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    return { doctors: pendingDoctors };
  } catch {
    throw new Error("Failed to fetch pending doctors");
  }
}

/** ---------- GET VERIFIED DOCTORS ---------- **/
export async function getVerifiedDoctors(): Promise<{ doctors?: User[]; error?: string }> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) throw new Error("Unauthorized");

  try {
    const verifiedDoctors = await db.user.findMany({
      where: {
        role: "DOCTOR",
        verificationStatus: "VERIFIED",
      },
      orderBy: { name: "asc" },
    });

    return { doctors: verifiedDoctors };
  } catch (error) {
    console.error("Failed to get verified doctors:", error);
    return { error: "Failed to fetch verified doctors" };
  }
}

/** ---------- UPDATE DOCTOR STATUS (VERIFY / REJECT) ---------- **/
export async function updateDoctorStatus(formData: FormData): Promise<ActionResponse> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) throw new Error("Unauthorized");

  const doctorId = formData.get("doctorId") as string | null;
  const status = formData.get("status") as string | null;

  if (!doctorId || !status || !["VERIFIED", "REJECTED"].includes(status)) {
    throw new Error("Invalid input");
  }

  try {
    await db.user.update({
      where: { id: doctorId },
      data: { verificationStatus: status as VerificationStatus },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to update doctor status:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to update doctor status: ${message}`);
  }
}

/** ---------- SUSPEND OR REINSTATE DOCTOR ---------- **/
export async function updateDoctorActiveStatus(formData: FormData): Promise<ActionResponse> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) throw new Error("Unauthorized");

  const doctorId = formData.get("doctorId") as string | null;
  const suspend = formData.get("suspend") === "true";

  if (!doctorId) throw new Error("Doctor ID is required");

  try {
    const status = suspend ? "PENDING" : "VERIFIED";

    await db.user.update({
      where: { id: doctorId },
      data: { verificationStatus: status },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to update doctor active status:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to update doctor status: ${message}`);
  }
}



/** ---------- GET PENDING PAYOUTS ---------- **/
export async function getPendingPayouts(): Promise<{ payouts?: PayoutWithDoctor[] }> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) throw new Error("Unauthorized");

  try {
    const pendingPayouts = await db.payout.findMany({
      where: { status: "PROCESSING" },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
            specialty: true,
            credits: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { payouts: pendingPayouts };
  } catch (error) {
    console.error("Failed to fetch pending payouts:", error);
    throw new Error("Failed to fetch pending payouts");
  }
}

/** ---------- APPROVE PAYOUT ---------- **/
export async function approvePayout(formData: FormData): Promise<ActionResponse> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) throw new Error("Unauthorized");

  const payoutId = formData.get("payoutId") as string | null;
  if (!payoutId) throw new Error("Payout ID is required");

  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const admin = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    const payout = await db.payout.findUnique({
      where: { id: payoutId, status: "PROCESSING" },
      include: { doctor: true },
    });

    if (!payout) throw new Error("Payout request not found or already processed");
    if (payout.doctor.credits < payout.credits)
      throw new Error("Doctor doesn't have enough credits for this payout");

    await db.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          processedBy: admin?.id ?? "unknown",
        },
      });

      await tx.user.update({
        where: { id: payout.doctorId },
        data: { credits: { decrement: payout.credits } },
      });

      await tx.creditTransaction.create({
        data: {
          userId: payout.doctorId,
          amount: -payout.credits,
          type: "ADMIN_ADJUSTMENT",
        },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/doctor");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to approve payout:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to approve payout: ${message}`);
  }
}