import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { parse } from "node-html-parser";

// Function to estimate token count (rough approximation)
function estimateTokenCount(text: string): number {
  // A rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Model configuration
const MODEL_CONFIG = {
  model: "llama-3.1-8b-instant",
  temperature: 0.1,
  max_completion_tokens: 25192,
  top_p: 0.1,
  stream: false,
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(
  groq: Groq,
  prompt: string,
  retries = MAX_RETRIES
): Promise<string> {
  try {
    const startTime = performance.now();
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      ...MODEL_CONFIG,
    });
    const endTime = performance.now();

    console.log(
      `Generation completed in ${(endTime - startTime).toFixed(2)}ms`
    );

    if ("choices" in chatCompletion) {
      return chatCompletion.choices[0]?.message?.content || "";
    }
    throw new Error("Unexpected response format from Groq");
  } catch (error) {
    if (retries > 0 && error instanceof Error) {
      console.warn(`Generation failed, retrying... (${retries} attempts left)`);
      await sleep(RETRY_DELAY);
      return generateWithRetry(groq, prompt, retries - 1);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY environment variable not set.");
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { htmlContent, originalUrl } = body;

    if (!htmlContent || !originalUrl) {
      return NextResponse.json(
        { error: "Missing htmlContent or originalUrl in request body" },
        { status: 400 }
      );
    }

    // Calculate token count before making the API call
    const prompt = `
      Take the following HTML content and create a minimalist black and white design:
      - Remove all images and unnecessary visual elements
      - Keep the core text content and structure
      - Simplify the layout and styling
      - Add clean typography and spacing
      - Ensure the output is valid HTML only, without any explanations
      - Ensure all links (<a> tags) have valid href attributes.
      Original HTML:
      
      ${htmlContent}

      Minimalist HTML:
    `;

    const estimatedTokens = estimateTokenCount(prompt);
    console.log(`Estimated token count: ${estimatedTokens}`);

    // Initialize Groq client with performance logging
    console.time("Groq initialization");
    const groq = new Groq({ apiKey });
    console.timeEnd("Groq initialization");

    console.log("Sending prompt to Groq...");
    const groqModifiedContent = await generateWithRetry(groq, prompt);
    console.log("Received response from Groq.");

    if (!groqModifiedContent) {
      console.warn("Groq returned empty content.");
      return NextResponse.json(
        { error: "AI failed to generate content" },
        { status: 500 }
      );
    }

    // --- Start Link Rewriting ---
    console.time("Link rewriting");
    console.log("Rewriting links relative to:", originalUrl);
    const root = parse(groqModifiedContent);
    const anchors = root.querySelectorAll("a");

    // Ensure originalUrl has a protocol for URL constructor
    let baseUrl = originalUrl;
    if (
      baseUrl &&
      !baseUrl.startsWith("http://") &&
      !baseUrl.startsWith("https://")
    ) {
      baseUrl = "https://" + baseUrl;
    }
    try {
      // Verify the baseUrl is valid before proceeding
      new URL(baseUrl);
    } catch (e) {
      console.error("Invalid originalUrl provided:", originalUrl, e);
      return NextResponse.json({
        modifiedContent: groqModifiedContent,
        warning: "Could not parse originalUrl to rewrite links.",
      });
    }

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute("href");
      if (href && !href.startsWith("javascript:") && !href.startsWith("#")) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          anchor.setAttribute(
            "href",
            `/?_url=${encodeURIComponent(absoluteUrl)}`
          );
        } catch (error) {
          console.warn(`Could not process or resolve href: ${href}`, error);
        }
      }
    });

    const finalHtmlContent = root.toString();
    console.timeEnd("Link rewriting");
    // --- End Link Rewriting ---

    return NextResponse.json({ modifiedContent: finalHtmlContent });
  } catch (error) {
    console.error("Error processing request with Groq:", error);
    let errorMessage = "Internal server error during AI processing";
    let errorDetails = "";
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || "";
    }
    return NextResponse.json(
      { error: errorMessage, details: errorDetails },
      { status: 500 }
    );
  }
}
