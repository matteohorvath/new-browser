import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { parse } from "node-html-parser";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable not set.");
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

    // Initialize Gemini client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Updated model name

    const prompt = `
      Take the following HTML content and create a minimalist black and white design:
      - Remove all images and unnecessary visual elements
      - Use only black (#000) and white (#fff) colors
      - Keep the core text content and structure
      - Simplify the layout and styling
      - Add clean typography and spacing
      - Ensure the output is valid HTML only, without any explanations
      - Ensure all links (<a> tags) have valid href attributes.
      Original HTML:
      
      ${htmlContent}

      Minimalist HTML:
    `;

    console.log("Sending prompt to Gemini...");
    // Generate content
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const geminiModifiedContent = response.text();
    console.log("Received response from Gemini.");

    if (!geminiModifiedContent) {
      console.warn("Gemini returned empty content.");
      return NextResponse.json(
        { error: "AI failed to generate content" },
        { status: 500 }
      );
    }

    // --- Start Link Rewriting ---
    console.log("Rewriting links relative to:", originalUrl);
    const root = parse(geminiModifiedContent);
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
      // Handle error - maybe return unmodified content or an error response
      return NextResponse.json({
        modifiedContent: geminiModifiedContent,
        warning: "Could not parse originalUrl to rewrite links.",
      });
    }

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute("href");
      if (href && !href.startsWith("javascript:") && !href.startsWith("#")) {
        try {
          // Resolve the link relative to the original URL's base
          const absoluteUrl = new URL(href, baseUrl).toString();
          // Rewrite the href to use the application's routing
          anchor.setAttribute(
            "href",
            `/?_url=${encodeURIComponent(absoluteUrl)}`
          );
        } catch (error) {
          console.warn(`Could not process or resolve href: ${href}`, error);
          // Optional: remove the href or the anchor if it's invalid
          // anchor.removeAttribute('href');
        }
      }
    });

    const finalHtmlContent = root.toString();
    // --- End Link Rewriting ---

    // Return the modified content with rewritten links
    return NextResponse.json({ modifiedContent: finalHtmlContent });
  } catch (error) {
    console.error("Error processing request with Gemini:", error);
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
