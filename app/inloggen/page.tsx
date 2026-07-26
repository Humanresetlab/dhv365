import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Footer, Header } from "@/components/site";
import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/auth-form.module.css";

export const metadata: Metadata = {
  title: "Inloggen",
  description: "Log veilig in op het DHV365-klantportaal.",
  alternates: { canonical: "/inloggen" },
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(user.app_metadata?.role === "admin" ? "/admin" : "/portal");
  }

  return (
    <>
      <Header />
      <main>
        <div className="wrap">
          <section className={styles.shell}>
            <LoginForm />
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
