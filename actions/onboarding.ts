"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

/**
 * Sets the user's role and related information
 */
export async function setUserRole(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Find user in our database
  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found in database");

  const role = formData.get("role");

  if (!role || !["PATIENT", "DOCTOR"].includes(role.toString())) {
    throw new Error("Invalid role selection");
  }

  try {
    /** --------------------------
     * PATIENT ROLE
     * ------------------------- */
    if (role === "PATIENT") {
      await db.user.update({
        where: { clerkUserId: userId },
        data: { role: "PATIENT" },
      });

      // ❌ Do NOT revalidate during render (safe here because server action)
      revalidatePath("/");

      return { success: true, redirect: "/doctors" };
    }

    /** --------------------------
     * DOCTOR ROLE
     * ------------------------- */
    if (role === "DOCTOR") {
      const specialty = formData.get("specialty")?.toString();
      const experience = parseInt(formData.get("experience") as string, 10);
      const credentialUrl = formData.get("credentialUrl")?.toString();
      const description = formData.get("description")?.toString();

      // Validation
      if (!specialty || !experience || !credentialUrl || !description) {
        throw new Error("All fields are required");
      }

      await db.user.update({
        where: { clerkUserId: userId },
        data: {
          role: "DOCTOR",
          specialty,
          experience,
          credentialUrl,
          description,
          verificationStatus: "PENDING",
        },
      });

      revalidatePath("/");

      return { success: true, redirect: "/doctor/verification" };
    }
  } catch (error) {
    console.error("Failed to set user role:", error);
    throw new Error(`Failed to update user profile: ${error}`);
  }
}

/**
 * Gets the current logged-in user's profile information
 */
export async function getCurrentUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  try {
    return await db.user.findUnique({
      where: { clerkUserId: userId },
    });
  } catch (error) {
    console.error("Failed to get user information:", error);
    return null;
  }
}
