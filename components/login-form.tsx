"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth-form.module.css";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage(null);
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim().toLowerCase();
    const password = String(data.get("password") || "");
    const supabase = createClient();

    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: "https://dhv365.nl",
        });

        if (resetError) throw resetError;

        setMessage("Als dit account bestaat, ontvangt u een beveiligde herstelmail.");
        return;
      }

      const {
        data: { user },
        error: loginError,
      } = await supabase.auth.signInWithPassword({ email, password });

      if (loginError) throw loginError;

      await fetch("/api/auth/login-alert", {
        method: "POST",
      }).catch(() => undefined);

      const role = user?.app_metadata?.role;
      router.replace(role === "admin" ? "/admin" : "/portal");
      router.refresh();
    } catch {
      setError(
        mode === "login"
          ? "Inloggen is niet gelukt. Controleer uw gegevens."
          : "De herstelmail kon niet worden aangevraagd.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <form onSubmit={submit} className={styles.form}>
        <h1 className={styles.title}>{mode === "login" ? "Inloggen" : "Wachtwoord herstellen"}</h1>
        {message && <p className={styles.success}>{message}</p>}
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.group}>
          <label htmlFor="email">E-mailadres</label>
          <input type="email" id="email" name="email" required disabled={loading} className={styles.input} />
        </div>

        {mode === "login" && (
          <div className={styles.group}>
            <label htmlFor="password">Wachtwoord</label>
            <input type="password" id="password" name="password" required disabled={loading} className={styles.input} />
          </div>
        )}

        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? "Laden..." : mode === "login" ? "Inloggen" : "Herstelmail aanvragen"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "reset" : "login")}
          className={styles.switchButton}
        >
          {mode === "login" ? "Wachtwoord vergeten?" : "Terug naar inloggen"}
        </button>
      </form>
    </div>
  );
}
