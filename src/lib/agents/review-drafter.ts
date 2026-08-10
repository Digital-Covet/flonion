import { ChatDeepSeek } from "@langchain/deepseek";
import { z } from "zod";
import type { SentimentAnalysis } from "./sentiment-analyzer";

const draftReplySchema = z.object({
  draftReply: z.string().describe("The drafted reply to the customer review"),
});

export type DraftReplyResult = z.infer<typeof draftReplySchema>;

function getModel(apiKey: string): ChatDeepSeek {
  return new ChatDeepSeek({
    model: "deepseek-v4-flash",
    temperature: 0.7,
    apiKey,
  });
}

const suggestReviewSchema = z.object({
  suggestedReviews: z
    .array(z.string())
    .length(3)
    .describe("Three distinct improved versions of the user's review"),
});

export type SuggestReviewResult = z.infer<typeof suggestReviewSchema>;

export async function suggestImprovedReview(params: {
  draftText: string;
  starRating: number;
  sentiment: SentimentAnalysis;
  keywords?: string;
  businessName?: string;
  apiKey: string;
}): Promise<SuggestReviewResult> {
  const model = getModel(params.apiKey);

  const hasDraft = params.draftText.trim().length > 0;

  const sentimentSummary = params.sentiment.sentimentWords
    .map(
      (s) =>
        `[${s.category}] "${s.word}" (intensity: ${s.intensity})`,
    )
    .join(", ");

  const keywordsBlock = params.keywords
    ? `
- Business Keywords: ${params.keywords}
  IMPORTANT: The business has highlighted specific keywords above. When generating suggestions, naturally weave these keywords/topics into the review text where they fit authentically. Do NOT force them — if they don't fit the draft's intent, focus on the original content. The keywords represent aspects the business cares about most.`
    : "";

  const businessBlock = params.businessName
    ? `\n- Business Name: ${params.businessName}`
    : "";

  if (!hasDraft) {
    const response = await model.invoke([
      {
        role: "system",
        content: `You are an expert Customer Experience Copywriter. A customer has selected a ${params.starRating}/5 star rating${params.businessName ? ` for ${params.businessName}` : ""} but has not written any review text yet. Your job is to generate 3 distinct, high-quality review drafts from scratch that match the customer's likely experience based on the star rating.${keywordsBlock}${businessBlock}

### STAR RATING ANCHORS

- 1-2 Stars: The customer had a poor experience. Write reviews expressing honest dissatisfaction. Be direct but fair — no insults, just genuine frustration about what went wrong.
- 3 Stars: The customer had a mediocre experience. Write balanced reviews highlighting both what was okay and what could improve. Nuanced and fair.
- 4-5 Stars: The customer had a great experience. Write warm, enthusiastic reviews praising specific aspects. Be genuine, not overly effusive.

### GENERATION RULES

1. Generate 3 COMPLETELY DIFFERENT reviews — different structures, vocabulary, pacing, and voice.
2. Each review should be 2-4 sentences long — realistic length for a genuine customer review.
3. If keywords are provided, naturally weave them in where they fit authentically.
4. If a business name is provided, reference it naturally (not forced into every sentence).
5. Do NOT invent specific details like staff names, exact dates, prices, or menu items.
6. Keep the reviews grounded and believable — they should sound like real human customers.

### THREE VARIATIONS

1. Option 1: "Simple" — Direct, plain, everyday language. Short, crisp sentences. High readability.
2. Option 2: "Professional" — Constructive, detailed, and measured. Structured like a thoughtful review aimed at helping both the business and future customers.
3. Option 3: "Casual" — Conversational and authentic, as if sharing an honest opinion over coffee. Uses natural flow and contractions.

### OUTPUT FORMAT

Return ONLY valid JSON:
{
  "suggestedReviews": [
    "<Option 1: Simple Version>",
    "<Option 2: Professional Version>",
    "<Option 3: Casual Version>"
  ]
}

No markdown. No explanation.`,
      },
      {
        role: "user",
        content: `Generate 3 review drafts for a ${params.starRating}/5 star experience${params.businessName ? ` at ${params.businessName}` : ""}.${params.keywords ? ` Keywords to consider: ${params.keywords}` : ""}`,
      },
    ]);

    const content =
      typeof response.content === "string"
        ? response.content
        : response.content.map((c: any) => ("text" in c ? c.text : "")).join("");

    return suggestReviewSchema.parse(JSON.parse(content));
  }

  const response = await model.invoke([
    {
      role: "system",
      content: `You are an expert Customer Experience Copywriter and Review Enhancement Specialist. Your purpose is to analyze raw, unpolished, or incomplete customer drafts and transform them into clear, authentic, and highly useful public reviews that accurately convey the reviewer's real experience.

### CONTEXT & INPUT DATA

- Star Rating: ${params.starRating}/5
- Overall Sentiment: ${params.sentiment.overallSentiment}
- Sentiment Score: ${params.sentiment.sentimentScore}
- Key Topics: ${params.sentiment.keyTopics.join(", ")}
- Sentiment Details: ${sentimentSummary || "none"}
- Original Draft: "${params.draftText}"${params.businessName ? `
- Business Name: ${params.businessName}` : ""}${params.keywords ? `
- Business Keywords: ${params.keywords}
  IMPORTANT: The business has highlighted specific keywords above. When generating suggestions, naturally weave these keywords/topics into the review text where they fit authentically. Do NOT force them — if they don't fit the draft's intent, focus on the original content. The keywords represent aspects the business cares about most.` : ""}

### CORE TASK

Generate EXACTLY 3 distinct, high-quality review variations based on the original draft and sentiment data. The three versions must represent significantly different perspectives, structures, and voices while staying 100% faithful to the original user experience.

1. Option 1: "Simple"
   - Style: Direct, plain, everyday language. Short, crisp sentences. High readability.
   - Tone: Neutral-to-the-point; understandable in a 5-second scan.
   - Length: Similar to or slightly shorter than the original draft.

2. Option 2: "Professional"
   - Style: Constructive, detailed, and measured feedback. Structured like a thoughtful Google or Yelp review aimed at helping both the business and future customers.
   - Tone: Respectful, balanced, articulate, and objective.
   - Length: Moderate, slightly expanded for clarity.

3. Option 3: "Casual"
   - Style: Conversational and authentic, as if texting or sharing an honest opinion over coffee with a friend. Uses natural flow and contractions.
   - Tone: Warm, relatable, and human (friendly even when critical).
   - Length: Moderate.

### OPERATIONAL REASONING WORKFLOW

Before producing the final JSON output, execute the following internal step-by-step evaluation process:

1. Input & Fact Deconstruction:
   - Extract the core message, key emotions, and specific facts present in the draft.
   - Identify sentiment anchors corresponding to the ${params.starRating}/5 star rating:
     - 1-2 Stars: Honest, firm, direct dissatisfaction. No sugarcoating, but no exaggerated insults.
     - 3 Stars: Balanced, nuanced, highlighting both pros and cons.
     - 4-5 Stars: Warm, appreciative, enthusiastic, and specific about success.

2. Hallucination Prevention Guardrails:
   - Explicitly list the facts present in the draft.
   - DO NOT invent facts, staff names, dates, prices, specific menu items, or locations not explicitly mentioned or directly implied by the user.

3. Drafting & Variation Enforcement:
   - Ensure Option 1, Option 2, and Option 3 use distinct sentence structures, vocabulary, and pacing.
   - Verify that the options are not simple synonym swaps, but genuine re-framings of the core experience.

4. Self-Reflection & Quality Audit:
   - Sentiment Check: Does each option accurately reflect the original rating (${params.starRating}/5) and overall sentiment (${params.sentiment.overallSentiment})?
   - Factual Check: Did any option add unverified details?
   - Distinctness Check: Are all 3 options distinctly different in length, tone, and voice?
   - Format Check: Is the output valid, unformatted JSON adhering strictly to the required schema?

### STRICT CONSTRAINTS

- Preserve Sentiment & Rating: Never flip a negative review to positive or vice-versa.
- Zero Hallucination: Rely strictly on the information provided in the draft and sentiment analysis.
- Tone Alignment: Match the intensity of language to the star rating (${params.starRating}/5).
- Format Integrity: Output ONLY valid JSON. Do not include markdown code blocks (e.g., no backtick-backtick-backtick-json), introductory text, or explanatory footnotes.

### OUTPUT FORMAT

Return JSON matching the following structure:

{
  "suggestedReviews": [
    "<Option 1: Simple Version>",
    "<Option 2: Professional Version>",
    "<Option 3: Casual Version>"
  ]
}`,
    },
    {
      role: "user",
      content: `Original review:

"${params.draftText}"`,
    },
  ]);

  const content =
    typeof response.content === "string"
      ? response.content
      : response.content.map((c: any) => ("text" in c ? c.text : "")).join("");

  return suggestReviewSchema.parse(JSON.parse(content));
}

export async function draftReviewReply(params: {
  comment: string;
  starRating: number;
  reviewerName: string;
  sentiment: SentimentAnalysis;
  apiKey: string;
  tone?: "professional" | "friendly" | "formal";
}): Promise<DraftReplyResult> {
  const model = getModel(params.apiKey);

  const toneInstructions: Record<string, string> = {
    professional:
      "Use a professional, business-appropriate tone. Be concise and solution-oriented.",
    friendly:
      "Use a warm, conversational tone. Be personable and approachable.",
    formal:
      "Use a formal, courteous tone. Follow traditional business etiquette.",
  };

  const intentGuide = {
    complaint:
      "Acknowledge their frustration, apologize sincerely, and offer a concrete resolution or way to make it right.",
    compliment:
      "Thank them warmly, reinforce the positive experience they described, and invite them back.",
    suggestion:
      "Acknowledge their feedback as valuable, explain what action is being taken or considered.",
    question:
      "Address their question directly, provide helpful information, and offer further assistance.",
  };

  const sentimentSummary = params.sentiment.sentimentWords
    .map(
      (s) =>
        `[${s.category}] "${s.word}" (intensity: ${s.intensity})`,
    )
    .join(", ");

  const response = await model.invoke([
    {
      role: "system",
      content: `You are an expert customer review response writer.

TONE:
${toneInstructions[params.tone ?? "professional"]}

SENTIMENT ANALYSIS

Overall sentiment:
${params.sentiment.overallSentiment}

Customer intent:
${params.sentiment.customerIntent}

Key topics:
${params.sentiment.keyTopics.join(", ")}

Sentiment words:
${sentimentSummary || "none detected"}

Strategy:
${intentGuide[params.sentiment.customerIntent]}

Return ONLY valid JSON:

{
  "draftReply": string
}

No markdown.
No explanation.`,
    },
    {
      role: "user",
      content: `Customer: ${params.reviewerName}
Rating: ${params.starRating}/5

"${params.comment}"`,
    },
  ]);

  const content =
    typeof response.content === "string"
      ? response.content
      : response.content.map((c: any) => ("text" in c ? c.text : "")).join("");

  return draftReplySchema.parse(JSON.parse(content));
}
