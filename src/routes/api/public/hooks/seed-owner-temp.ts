import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY: dihapus setelah akun owner dibuat.
export const Route = createFileRoute("/api/public/hooks/seed-owner-temp")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const email = "diskominfopurworejo@gmail.com";
        const created = await supabaseAdmin.auth.admin.createUser({
          email,
          password: "diskominfo123",
          email_confirm: true,
          user_metadata: { full_name: "Diskominfo Purworejo" },
        });
        if (created.error || !created.data.user) {
          return new Response(JSON.stringify({ error: created.error?.message }), { status: 500 });
        }
        const { error } = await supabaseAdmin.from("users").insert({
          id: created.data.user.id,
          full_name: "Diskominfo Purworejo",
          email,
          role: "owner",
        });
        return new Response(JSON.stringify({ id: created.data.user.id, error: error?.message }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
