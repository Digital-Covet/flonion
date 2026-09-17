import { Outlet, useLocation } from "react-router";
import { requireOperator, type Operator } from "~/prisma/operator";

export async function loader({ request }: { request: Request }) {
  const operator = await requireOperator(request);
  return { operator };
}

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/businesses", label: "Businesses", nested: true },
  { href: "/users", label: "Users", nested: true },
  { href: "/reviews", label: "Reviews" },
  { href: "/meetings", label: "Meetings" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/ai-usage", label: "AI Usage" },
  { href: "/feedback", label: "Support Inbox" },
  { href: "/audit", label: "Audit Log" },
];

function isActive(href: string, pathname: string, nested?: boolean) {
  if (href === "/") return pathname === "/";
  if (nested) return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}

export default function Layout({
  loaderData,
}: {
  loaderData: { operator: Operator };
}) {
  const { operator } = loaderData;
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg">Flonion Desk</h1>
          <p className="text-xs text-gray-500 mt-1">
            Logged in as {operator.name}
          </p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm ${
                isActive(item.href, location.pathname, item.nested)
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
