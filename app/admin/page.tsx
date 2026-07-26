import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Footer, Header } from "@/components/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/inloggen");
  if (user.app_metadata?.role !== "admin") redirect("/portal");

  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : user.email;

  return (
    <>
      <Header />
      <main>
        <section className="pageHero">
          <div className="wrap">
            <span className="eyebrow">Secure administration</span>
            <h1>DHV365 Admin</h1>
            <p className="lead">Ingelogd als {displayName}. Alleen geautoriseerde beheerders hebben toegang tot deze omgeving.</p>
          </div>
        </section>

        <article className="wrap content">
          <div className="notice">
            <strong>Admin-toegang actief</strong>
            <p>De beheerdersrol wordt server-side gecontroleerd via Supabase Auth app metadata.</p>
          </div>

          <h2>Beheermodules</h2>
          <ul>
            <li>Opdrachten en planning</li>
            <li>Klanten en beveiligde documenten</li>
            <li>Track &amp; trace en chain-of-custody</li>
            <li>Offertes, facturen en accountbeheer</li>
            <li>Security-events en auditlogs</li>
          </ul>

          <form action="/auth/signout" method="post">
            <button className="button ghost" type="submit">Veilig uitloggen</button>
          </form>
        </article>
      </main>
      <Footer />
    </>
  );
}
