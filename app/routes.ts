import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("businesses", "routes/businesses.tsx"),
    route("businesses/:id", "routes/business-detail.tsx"),
    route("users", "routes/users.tsx"),
    route("users/:id", "routes/user-detail.tsx"),
    route("reviews", "routes/reviews.tsx"),
    route("meetings", "routes/meetings.tsx"),
    route("marketplace", "routes/marketplace.tsx"),
    route("ai-usage", "routes/ai-usage.tsx"),
    route("feedback", "routes/feedback.tsx"),
    route("audit", "routes/audit.tsx"),
  ]),
  route("console.unlock", "routes/console.unlock.tsx"),
  route("impersonate", "routes/impersonate.tsx"),
  route("export/businesses.csv", "routes/export-businesses.tsx"),
] satisfies RouteConfig;
