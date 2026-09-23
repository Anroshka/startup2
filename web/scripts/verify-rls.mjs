// Run only against a disposable staging project after applying the migration.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.RLS_TEST_PROJECT_URL;
const publishable = process.env.RLS_TEST_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (process.env.RLS_TEST_ALLOW_WRITE !== "1" || !url || !publishable || !secret)
  throw new Error("Set RLS_TEST_ALLOW_WRITE=1 and staging URL, publishable key, and secret key.");

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const users = [];
const workspace = { profile: null, jobs: [], applications: [] };
async function makeUser() {
  const email = `jobpilot-rls-${randomUUID()}@example.invalid`;
  const password = randomUUID() + "-A1!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  return { id: data.user.id, client };
}

try {
  const a = await makeUser();
  const b = await makeUser();
  for (const user of [a, b]) {
    const { error } = await user.client.from("workspaces").insert({ user_id: user.id, data: workspace, revision: 1, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  const read = await a.client.from("workspaces").select("user_id").eq("user_id", b.id);
  assert.ifError(read.error);
  assert.equal(read.data.length, 0, "A must not read B");
  const update = await a.client.from("workspaces").update({ revision: 777 }).eq("user_id", b.id).select("revision");
  assert.ifError(update.error);
  assert.equal(update.data.length, 0, "A must not update B");
  const remove = await a.client.from("workspaces").delete().eq("user_id", b.id).select("user_id");
  assert.ifError(remove.error);
  assert.equal(remove.data.length, 0, "A must not delete B");
  const own = await b.client.from("workspaces").select("revision").eq("user_id", b.id).single();
  assert.ifError(own.error);
  assert.equal(own.data.revision, 1, "B's row must remain unchanged");
  process.stdout.write("PASS: two authenticated users are isolated for read, update, and delete.\n");
} finally {
  for (const id of users) {
    await admin.from("workspaces").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
  }
}
