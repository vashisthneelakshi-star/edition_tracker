import { redirect } from "next/navigation";
import { getProfile, canAdminister } from "@/lib/auth/get-profile";
import BulkUsersClient from "./bulk-users-client";

export default async function BulkUsersPage() {
  const { role } = await getProfile();
  if (!canAdminister(role)) redirect("/content-planning");
  return <BulkUsersClient />;
}
