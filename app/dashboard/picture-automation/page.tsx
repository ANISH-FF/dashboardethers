import { getSession } from "@/lib/auth";
import PictureAutomationClient from "./PictureAutomationClient";

export default async function PictureAutomationPage() {
  const session = await getSession();
  // Slugify name: "Tanisha Maity" -> "tanisha_maity", "Hemanya Gupta" -> "hemanya_gupta"
  const userId = session?.name
    ? session.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
    : session?.email
    ? session.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "_")
    : "user";

  return <PictureAutomationClient userId={userId} />;
}
