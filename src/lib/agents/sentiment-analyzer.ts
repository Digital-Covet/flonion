import { ChatOpenRouter } from "@langchain/openrouter";
import { z } from "zod";

const sentimentWordSchema = z.object({
  word: z.string().describe("The sentiment-bearing word or phrase from the review"),
  category: z.enum(["praise", "complaint", "suggestion", "emotion"]).describe("What category this word falls into"),
  intensity: z.enum(["low", "medium", "high"]).describe("How strong the sentiment is"),
});

export const sentimentAnalysisSchema = z.object({
  overallSentiment: z.enum(["positive", "negative", "neutral", "mixed"]).describe("Overall sentiment of the review"),
  sentimentScore: z.number().min(-1).max(1).describe("Numeric sentiment score from -1 (very negative) to 1 (very positive)"),
  sentimentWords: z.array(sentimentWordSchema).describe("List of sentiment-bearing words found in the review"),
  keyTopics: z.array(z.string()).describe("Main topics or themes discussed in the review"),
  customerIntent: z.enum(["complaint", "compliment", "suggestion", "question"]).describe("Primary intent of the customer"),
});

export type SentimentAnalysis = z.infer<typeof sentimentAnalysisSchema>;

function getModel(apiKey: string): ChatOpenRouter {
  return new ChatOpenRouter({
    model: "openai/gpt-oss-20b:free",
    temperature: 0,
    apiKey,
  });
}

export async function analyzeSentiment(params: {
  comment: string;
  starRating: number;
  apiKey: string;
}): Promise<SentimentAnalysis> {
  const model = getModel(params.apiKey);

  const starContext =
    params.starRating <= 2
      ? "This is a low-rated review, likely negative."
      : params.starRating >= 4
        ? "This is a high-rated review, likely positive."
        : "This is a mid-rated review, sentiment may be mixed.";

  const response = await model.invoke([
    {
      role: "system",
      content: `You are a sentiment analysis expert for customer reviews.

${starContext}

Analyze the review and return ONLY valid JSON.

The JSON must match this structure:

{
  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentScore": number,
  "sentimentWords": [
    {
      "word": string,
      "category": "praise|complaint|suggestion|emotion",
      "intensity": "low|medium|high"
    }
  ],
  "keyTopics": [string],
  "customerIntent": "complaint|compliment|suggestion|question"
}

Do not wrap the JSON in markdown.
Do not output any explanation.`,
    },
    {
      role: "user",
      content: `Review (star rating: ${params.starRating}/5):

"${params.comment}"`,
    },
  ]);

  const content =
    typeof response.content === "string"
      ? response.content
      : response.content.map((c: any) => ("text" in c ? c.text : "")).join("");

  return sentimentAnalysisSchema.parse(JSON.parse(content));
}
