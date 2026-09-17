import type { Route } from "./+types/console.unlock";
import { Form, redirect } from "react-router";
import {
  currentOperator,
  operatorFromToken,
  serializeOperatorCookie,
} from "~/prisma/operator";

/**
 * Temporary unlock page for the operator console.
 *
 * DELETE when real auth lands. This is the bearer-credential door described
 * in the plan — a per-operator token map in the environment.
 *
 * The token is taken from a POSTed form, never a query string, so it does not
 * end up in proxy logs or browser history. This route sits outside the desk
 * layout, whose loader would otherwise redirect here forever.
 */
export async function loader({ request }: Route.LoaderArgs) {
  if (await currentOperator(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const token = form.get("token");

  if (typeof token !== "string" || !operatorFromToken(token)) {
    return { error: "Invalid token" };
  }

  return redirect("/", {
    headers: { "Set-Cookie": await serializeOperatorCookie(token) },
  });
}

export default function ConsoleUnlockPage({
  actionData,
}: Route.ComponentProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <Form
        method="post"
        className="w-80 space-y-3 rounded-lg border bg-white p-6"
      >
        <h1 className="font-bold text-lg">Flonion Desk</h1>
        <label className="block text-sm text-gray-700">
          Operator token
          <input
            type="password"
            name="token"
            autoComplete="off"
            required
            className="mt-1 block w-full rounded border px-2 py-1"
          />
        </label>
        {actionData?.error && (
          <p className="text-sm text-red-600">{actionData.error}</p>
        )}
        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Unlock
        </button>
      </Form>
    </div>
  );
}
