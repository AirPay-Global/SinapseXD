import { redirect } from "next/navigation";

// The Decision Centre is the default landing (Design Bible §3).
export default function Home() {
  redirect("/decision");
}
