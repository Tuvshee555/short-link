import { redirect } from "next/navigation";

// On the real domain "/" belongs to the website; this only matters when the app
// is opened on its own address.
export default function Home() {
  redirect("/admin/links");
}
