import { toSolidStartHandler } from "better-auth/solid-start";
import { auth } from "@/lib/auth"; // path to your auth file

export const { GET, POST } = toSolidStartHandler(auth);
