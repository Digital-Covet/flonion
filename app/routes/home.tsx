import { db } from "~/prisma/db";
import { daysAgo } from "~/prisma/time";

export async function loader() {
  const now = new Date().toISOString();
  const thirtyDaysAgo = daysAgo(30);

  const [
    totalBusinesses,
    newBusinesses,
    totalUsers,
    newUsers,
    totalReviews,
    totalFeedback,
    pendingMeetings,
    aiUsage,
  ] = await Promise.all([
    db.business.count(),
    db.business.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.sharedReview.count(),
    db.feedback.count({ where: { status: { in: ["new", "open"] } } }),
    db.meetingRequest.count({ where: { status: "pending" } }),
    db.aiUsage.aggregate({
      _sum: { costUsd: true, promptTokens: true, completionTokens: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const totalCost = aiUsage._sum.costUsd
    ? Number.parseFloat(String(aiUsage._sum.costUsd))
    : 0;
  const totalTokens =
    (aiUsage._sum.promptTokens ?? 0) + (aiUsage._sum.completionTokens ?? 0);

  return {
    stats: {
      totalBusinesses,
      newBusinesses,
      totalUsers,
      newUsers,
      totalReviews,
      openFeedback: totalFeedback,
      pendingMeetings,
      aiCost30d: totalCost,
      aiTokens30d: totalTokens,
    },
  };
}

export default function Home({ loaderData }: { loaderData: Awaited<ReturnType<typeof loader>> }) {
  const { stats } = loaderData;

  const cards = [
    { label: "Total Businesses", value: stats.totalBusinesses },
    { label: "New (30d)", value: stats.newBusinesses },
    { label: "Total Users", value: stats.totalUsers },
    { label: "New Users (30d)", value: stats.newUsers },
    { label: "Total Reviews", value: stats.totalReviews },
    { label: "Open Feedback", value: stats.openFeedback },
    { label: "Pending Meetings", value: stats.pendingMeetings },
    {
      label: "AI Cost (30d)",
      value: `$${stats.aiCost30d.toFixed(4)}`,
    },
    {
      label: "AI Tokens (30d)",
      value: stats.aiTokens30d.toLocaleString(),
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">{card.label}</div>
            <div className="text-2xl font-bold mt-1">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
