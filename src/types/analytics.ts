/** One shared review link, as the campaign analytics return it. */
export type LinkRow = {
  id: string;
  /** First 60 characters of the suggested text, already truncated server-side. */
  text: string;
  rating: number;
  reviewerName: string | null;
  visits: number;
  reviews: number;
  qrScans: number;
  redirects: number;
  aiCopies: number;
  platformRedirects: Record<string, number>;
  createdAt: string;
};

export type AnalyticsData = {
  totalVisits: number;
  totalReviews: number;
  totalQrScans: number;
  totalRedirects: number;
  totalAiCopies: number;
  totalPlatformRedirects: Record<string, number>;
  totalLinks: number;
  reviews: LinkRow[];
};
